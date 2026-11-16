begin;
-- Existing memberships stay active; this state is scoped to a workspace, not Auth.
alter table public.hub_members add column active boolean not null default true;
create or replace function public.hub_can(w uuid,module text,writing boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hub_members where workspace_id=w and user_id=auth.uid() and active
 and case module
 when 'commercial' then not writing or (array[role]||extra_roles)&&array['admin','commercial']
 when 'projects' then not writing or (array[role]||extra_roles)&&array['admin','operations']
 when 'finance' then (array[role]||extra_roles)&&array['admin','finance']
 when 'admin' then 'admin'=any(array[role]||extra_roles)
 else false end);
$$;
alter policy hub_members_own on public.hub_members using(user_id=(select auth.uid()) and active);
alter policy hub_workspace_read on public.hub_workspaces using(public.hub_can(id,'commercial'));

create or replace function hub_private.advance_role_revision() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.role is distinct from old.role or new.extra_roles is distinct from old.extra_roles or new.active is distinct from old.active then
  new.role_revision:=old.role_revision+1;
 else new.role_revision:=old.role_revision;end if;
 return new;
end;
$$;

alter table public.hub_role_audit add column before_active boolean default true,
 add column after_active boolean not null default true;
update public.hub_role_audit set before_active=null where operation='created';
alter table public.hub_role_audit alter column before_active drop default;
alter table public.hub_role_audit drop constraint hub_role_audit_operation_check,
 drop constraint hub_role_audit_check1;
alter table public.hub_role_audit add constraint hub_role_audit_operation_check
 check(operation in ('created','changed','deactivated','reactivated')),
 add constraint hub_role_audit_lifecycle check(
  (operation='created' and before_revision is null and cardinality(before_roles)=0 and after_revision=0 and before_active is null)
  or (before_revision is not null and after_revision=before_revision+1 and before_active is not null and (
   (operation='changed' and before_active=after_active and before_roles is distinct from after_roles)
   or (operation='deactivated' and before_active and not after_active and before_roles=after_roles)
   or (operation='reactivated' and not before_active and after_active and before_roles=after_roles)
  ))
 );
create or replace function hub_private.audit_member_roles() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); context hub_private.invite_acceptance%rowtype; action text;
begin
 if tg_op='UPDATE' and new.role is not distinct from old.role and new.extra_roles is not distinct from old.extra_roles and new.active is not distinct from old.active then return new;end if;
 if tg_op='INSERT' then
  select * into context from hub_private.invite_acceptance
   where transaction_id=txid_current() and workspace_id=new.workspace_id and member_id=new.user_id;
  if found and (actor is distinct from context.accepted_by or actor is distinct from new.user_id) then raise check_violation using message='Contexto de aceite inconsistente';end if;
  action:='created';
 else action:=case when new.active is distinct from old.active then case when new.active then 'reactivated' else 'deactivated' end else 'changed' end;
 end if;
 insert into public.hub_role_audit(workspace_id,actor_id,actor_source,member_id,operation,before_roles,after_roles,before_revision,after_revision,grantor_id,accepted_by,invite_id,before_active,after_active)
 values(new.workspace_id,actor,case when actor is null then 'system' else 'member' end,new.user_id,action,
  case when tg_op='INSERT' then '{}'::text[] else array[old.role]||old.extra_roles end,array[new.role]||new.extra_roles,
  case when tg_op='INSERT' then null else old.role_revision end,new.role_revision,
  coalesce(context.grantor_id,actor),context.accepted_by,context.invite_id,
  case when tg_op='INSERT' then null else old.active end,new.active);
 delete from hub_private.invite_acceptance where transaction_id=txid_current() and workspace_id=new.workspace_id and member_id=new.user_id;
 return new;
end;
$$;

create or replace function public.hub_set_roles(w uuid,u uuid,r text[]) returns boolean
language plpgsql security definer set search_path='' as $$
declare chosen text[];
begin
 perform 1 from public.hub_workspaces where id=w for update;
 if not public.hub_can(w,'admin',true) then return false;end if;
 if r is null or coalesce(array_ndims(r),0)<>1 or cardinality(r)=0 then return false;end if;
 if array_position(r,null) is not null or not(r<@array['admin','commercial','operations','finance']::text[]) then return false;end if;
 select array_agg(distinct value order by value) into chosen from unnest(r) as selected_roles(value);
 if not('admin'=any(chosen)) and exists(select 1 from public.hub_members where workspace_id=w and user_id=u and active and 'admin'=any(array[role]||extra_roles))
 and (select count(*) from public.hub_members where workspace_id=w and active and 'admin'=any(array[role]||extra_roles))<=1 then return false;end if;
 insert into public.hub_members(workspace_id,user_id,role,extra_roles) values(w,u,chosen[1],coalesce(chosen[2:],'{}'))
 on conflict(workspace_id,user_id) do update set role=excluded.role,extra_roles=excluded.extra_roles;
 -- Deliberately never reactivate an existing membership through a role change.
 return true;
end;
$$;

drop function public.hub_list_members(uuid);
create function public.hub_list_members(w uuid)
returns table(user_id uuid,email text,roles text[],revision text,active boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'admin',true) then raise insufficient_privilege using message='Sem permissão para consultar a equipe deste espaço';end if;
 return query select m.user_id,u.email::text,array[m.role]||m.extra_roles,m.role_revision::text,m.active
 from public.hub_members m join auth.users u on u.id=m.user_id where m.workspace_id=w order by lower(u.email),m.user_id;
end;
$$;
revoke all on function public.hub_list_members(uuid) from public,anon;
grant execute on function public.hub_list_members(uuid) to authenticated;

-- Both editors use one revision, including conflicts between roles and state.
create or replace function public.hub_update_member_roles(w uuid,u uuid,r text[],expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_member public.hub_members%rowtype;
begin
 perform 1 from public.hub_workspaces where id=w for update;
 if not public.hub_can(w,'admin',true) then raise insufficient_privilege using message='Sem permissão para alterar a equipe deste espaço';end if;
 select * into current_member from public.hub_members where workspace_id=w and user_id=u for update;
 if not found then return jsonb_build_object('status','missing');end if;
 if expected_revision is null or expected_revision<0 then return jsonb_build_object('status','rejected');end if;
 if current_member.role_revision<>expected_revision then
  return jsonb_build_object('status','conflict','roles',array[current_member.role]||current_member.extra_roles,'revision',current_member.role_revision::text,'active',current_member.active);
 end if;
 if not public.hub_set_roles(w,u,r) then return jsonb_build_object('status','rejected');end if;
 select * into current_member from public.hub_members where workspace_id=w and user_id=u;
 return jsonb_build_object('status','saved','roles',array[current_member.role]||current_member.extra_roles,'revision',current_member.role_revision::text,'active',current_member.active);
end;
$$;
create function public.hub_update_member_active(w uuid,u uuid,enabled boolean,expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_member public.hub_members%rowtype;
begin
 perform 1 from public.hub_workspaces where id=w for update;
 if not public.hub_can(w,'admin',true) then raise insufficient_privilege using message='Sem permissão para alterar a equipe deste espaço';end if;
 select * into current_member from public.hub_members where workspace_id=w and user_id=u for update;
 if not found then return jsonb_build_object('status','missing');end if;
 if enabled is null or expected_revision is null or expected_revision<0 then return jsonb_build_object('status','rejected');end if;
 if current_member.role_revision<>expected_revision then
  return jsonb_build_object('status','conflict','roles',array[current_member.role]||current_member.extra_roles,'revision',current_member.role_revision::text,'active',current_member.active);
 end if;
 if not enabled and current_member.active and 'admin'=any(array[current_member.role]||current_member.extra_roles)
 and (select count(*) from public.hub_members where workspace_id=w and active and 'admin'=any(array[role]||extra_roles))<=1 then
  return jsonb_build_object('status','rejected');
 end if;
 update public.hub_members set active=enabled where workspace_id=w and user_id=u;
 select * into current_member from public.hub_members where workspace_id=w and user_id=u;
 return jsonb_build_object('status','saved','roles',array[current_member.role]||current_member.extra_roles,'revision',current_member.role_revision::text,'active',current_member.active);
end;
$$;
revoke all on function public.hub_update_member_active(uuid,uuid,boolean,bigint) from public,anon;
grant execute on function public.hub_update_member_active(uuid,uuid,boolean,bigint) to authenticated;

-- Keep the versioned accept implementation, adding only the active-member gates.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.hub_accept_invite(uuid)'::regprocedure);
 if position('if invitation.status=''accepted''' in definition)=0 or position('user_id=invitation.created_by and ''admin''' in definition)=0 then
  raise exception 'Implementação de convite inesperada; revise a migração';
 end if;
 definition:=replace(definition,' if invitation.status=''accepted''', $g$
 if exists(select 1 from public.hub_members where workspace_id=w and user_id=a and not active) then
  return jsonb_build_object('status','inactive_member');
 end if;
 if invitation.status='accepted'$g$);
 definition:=replace(definition,'user_id=invitation.created_by and ''admin''','user_id=invitation.created_by and active and ''admin''');
 execute definition;
end $$;
commit;
