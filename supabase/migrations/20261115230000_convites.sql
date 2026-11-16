begin;
create table public.hub_invites (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hub_workspaces(id),
 recipient_email text not null,
 roles text[] not null,
 created_by uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default (clock_timestamp()+interval '7 days'),
 status text not null default 'pending' check(status in ('pending','accepted','revoked')),
 accepted_by uuid, accepted_at timestamptz,
 acceptance_outcome text check(acceptance_outcome in ('linked','existing_member')),
 revoked_by uuid, revoked_at timestamptz,
 check(expires_at>created_at),
 check((status='pending' and accepted_by is null and accepted_at is null and acceptance_outcome is null and revoked_by is null and revoked_at is null)
  or (status='accepted' and accepted_by is not null and accepted_at is not null and acceptance_outcome is not null and revoked_by is null and revoked_at is null)
  or (status='revoked' and revoked_by is not null and revoked_at is not null and accepted_by is null and accepted_at is null and acceptance_outcome is null)),
 check(recipient_email=lower(btrim(recipient_email)) and length(recipient_email)<=254 and recipient_email~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 check(coalesce(array_ndims(roles),0)=1 and cardinality(roles)>0 and roles<@array['admin','commercial','operations','finance']::text[]
  and array_position(case when coalesce(array_ndims(roles),0)=1 then roles else '{}'::text[] end,null) is null)
);
create index hub_invites_space on public.hub_invites(workspace_id,created_at desc);
create index hub_invites_recipient on public.hub_invites(recipient_email,created_at desc);
alter table public.hub_invites enable row level security;
revoke all on public.hub_invites from public,anon,authenticated;

-- Private, transaction-scoped context, never accepted from a client parameter.
create table hub_private.invite_acceptance (
 transaction_id bigint not null,
 workspace_id uuid not null,
 member_id uuid not null,
 invite_id uuid not null,
 grantor_id uuid not null,
 accepted_by uuid not null,
 primary key(transaction_id,workspace_id,member_id)
);
revoke all on hub_private.invite_acceptance from public,anon,authenticated;
alter table public.hub_role_audit add column grantor_id uuid,
 add column accepted_by uuid, add column invite_id uuid;
alter table public.hub_role_audit add constraint hub_role_audit_invite_context check(
 (invite_id is null and accepted_by is null)
 or (invite_id is not null and accepted_by is not null and grantor_id is not null
  and actor_id is not null and actor_id=accepted_by and operation='created')
);
create or replace function hub_private.audit_member_roles() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); context hub_private.invite_acceptance%rowtype;
begin
 if tg_op='UPDATE' and new.role is not distinct from old.role and new.extra_roles is not distinct from old.extra_roles then return new; end if;
 if tg_op='INSERT' then
  select * into context from hub_private.invite_acceptance
   where transaction_id=txid_current() and workspace_id=new.workspace_id and member_id=new.user_id;
  if found and (actor is distinct from context.accepted_by or actor is distinct from new.user_id) then
   raise check_violation using message='Contexto de aceite inconsistente';
  end if;
 end if;
 insert into public.hub_role_audit(workspace_id,actor_id,actor_source,member_id,operation,before_roles,after_roles,before_revision,after_revision,grantor_id,accepted_by,invite_id)
 values(new.workspace_id,actor,case when actor is null then 'system' else 'member' end,new.user_id,
  case when tg_op='INSERT' then 'created' else 'changed' end,
  case when tg_op='INSERT' then '{}'::text[] else array[old.role]||old.extra_roles end,
  array[new.role]||new.extra_roles,case when tg_op='INSERT' then null else old.role_revision end,new.role_revision,
  coalesce(context.grantor_id,actor),context.accepted_by,context.invite_id);
 delete from hub_private.invite_acceptance where transaction_id=txid_current()
  and workspace_id=new.workspace_id and member_id=new.user_id;
 return new;
end;
$$;
revoke all on function hub_private.audit_member_roles() from public,anon,authenticated;

create function hub_private.verified_email() returns text
language sql stable security definer set search_path='' as $$
 select lower(btrim(email)) from auth.users where id=auth.uid() and email_confirmed_at is not null;
$$;
revoke all on function hub_private.verified_email() from public,anon,authenticated;

create function public.hub_create_invite(w uuid,e text,r text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target text:=lower(btrim(e)); chosen text[]; invitation uuid;
begin
 perform 1 from public.hub_workspaces where id=w for update;
 if not public.hub_can(w,'admin',true) then raise insufficient_privilege; end if;
 if target is null or length(target)>254 or target!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  or r is null or coalesce(array_ndims(r),0)<>1 or cardinality(r)=0 then return jsonb_build_object('status','invalid'); end if;
 if array_position(r,null) is not null or not(r<@array['admin','commercial','operations','finance']::text[]) then return jsonb_build_object('status','invalid'); end if;
 select array_agg(distinct value order by value) into chosen from unnest(r) as selected_roles(value);
 if exists(select 1 from public.hub_members m join auth.users u on u.id=m.user_id where m.workspace_id=w and lower(btrim(u.email))=target) then
  return jsonb_build_object('status','existing_member');
 end if;
 select id into invitation from public.hub_invites where workspace_id=w and recipient_email=target and status='pending' and expires_at>clock_timestamp();
 if found then return jsonb_build_object('status','pending_exists','id',invitation);end if;
 insert into public.hub_invites(workspace_id,recipient_email,roles,created_by) values(w,target,chosen,auth.uid()) returning id into invitation;
 return jsonb_build_object('status','created','id',invitation);
end;
$$;

create function public.hub_list_invites(w uuid)
returns table(id uuid,recipient_email text,roles text[],state text,created_at timestamptz,expires_at timestamptz,accepted_at timestamptz,acceptance_outcome text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'admin',true) then raise insufficient_privilege;end if;
 return query select i.id,i.recipient_email,i.roles,
  case when i.status='pending' and i.expires_at<=statement_timestamp() then 'expired' else i.status end,
  i.created_at,i.expires_at,i.accepted_at,i.acceptance_outcome
 from public.hub_invites i where i.workspace_id=w order by i.created_at desc,i.id;
end;
$$;

create function public.hub_revoke_invite(i uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare w uuid;
begin
 select workspace_id into w from public.hub_invites where id=i;
 perform 1 from public.hub_workspaces where id=w for update;
 if not public.hub_can(w,'admin',true) then raise insufficient_privilege;end if;
 update public.hub_invites set status='revoked',revoked_by=auth.uid(),revoked_at=clock_timestamp()
  where id=i and status='pending' and expires_at>clock_timestamp();
 return found;
end;
$$;

create function public.hub_my_invites()
returns table(id uuid,workspace_name text,roles text[],state text,expires_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare target text:=hub_private.verified_email();
begin
 if target is null then raise insufficient_privilege;end if;
 return query select i.id,w.name,i.roles,
  case when i.status='pending' and i.expires_at<=statement_timestamp() then 'expired' else i.status end,i.expires_at
 from public.hub_invites i join public.hub_workspaces w on w.id=i.workspace_id
 where i.recipient_email=target order by i.created_at desc,i.id;
end;
$$;

create function public.hub_accept_invite(i uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); target text; w uuid; invitation public.hub_invites%rowtype; inserted uuid; outcome text;
begin
 if a is null then return jsonb_build_object('status','unavailable');end if;
 select workspace_id into w from public.hub_invites where id=i;
 perform 1 from public.hub_workspaces where id=w for update;
 select * into invitation from public.hub_invites where id=i for update;
 if not found then return jsonb_build_object('status','unavailable');end if;
 select lower(btrim(email)) into target from auth.users where id=a and email_confirmed_at is not null for share;
 if target is null or target<>invitation.recipient_email then return jsonb_build_object('status','unavailable');end if;
 if invitation.status='accepted' and invitation.accepted_by=a then
  return jsonb_build_object('status','accepted','outcome',invitation.acceptance_outcome,'workspace_id',w,'repeated',true);
 end if;
 if invitation.status<>'pending' or invitation.expires_at<=clock_timestamp() then return jsonb_build_object('status','unavailable');end if;
 if not exists(select 1 from public.hub_members where workspace_id=w and user_id=invitation.created_by and 'admin'=any(array[role]||extra_roles)) then
  return jsonb_build_object('status','issuer_unavailable');
 end if;
 outcome:='existing_member';
 if not exists(select 1 from public.hub_members where workspace_id=w and user_id=a) then
  insert into hub_private.invite_acceptance values(txid_current(),w,a,i,invitation.created_by,a);
  insert into public.hub_members(workspace_id,user_id,role,extra_roles)
   values(w,a,invitation.roles[1],coalesce(invitation.roles[2:],'{}')) on conflict(workspace_id,user_id) do nothing returning user_id into inserted;
  delete from hub_private.invite_acceptance where transaction_id=txid_current() and workspace_id=w and member_id=a;
  if inserted is not null then outcome:='linked';end if;
 end if;
 update public.hub_invites set status='accepted',accepted_by=a,accepted_at=clock_timestamp(),acceptance_outcome=outcome where id=i;
 return jsonb_build_object('status','accepted','outcome',outcome,'workspace_id',w,'repeated',false);
end;
$$;
revoke all on function public.hub_create_invite(uuid,text,text[]),public.hub_list_invites(uuid),public.hub_revoke_invite(uuid),public.hub_my_invites(),public.hub_accept_invite(uuid) from public,anon;
grant execute on function public.hub_create_invite(uuid,text,text[]),public.hub_list_invites(uuid),public.hub_revoke_invite(uuid),public.hub_my_invites(),public.hub_accept_invite(uuid) to authenticated;
commit;
