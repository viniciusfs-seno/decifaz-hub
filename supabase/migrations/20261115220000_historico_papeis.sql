begin;
create table public.hub_role_audit (
 workspace_id uuid not null references public.hub_workspaces(id),
 id uuid not null default gen_random_uuid(),
 occurred_at timestamptz not null default clock_timestamp(),
 actor_id uuid,
 actor_source text not null check(actor_source in ('member','system')),
 member_id uuid not null,
 operation text not null check(operation in ('created','changed')),
 before_roles text[] not null,
 after_roles text[] not null,
 before_revision bigint,
 after_revision bigint not null check(after_revision>=0),
 primary key(workspace_id,id),
 check((actor_source='member')=(actor_id is not null)),
 check((operation='created' and before_revision is null and cardinality(before_roles)=0 and after_revision=0)
  or (operation='changed' and before_revision is not null and after_revision=before_revision+1))
);
create index hub_role_audit_recent on public.hub_role_audit(workspace_id,occurred_at desc,id);
alter table public.hub_role_audit enable row level security;
revoke all on public.hub_role_audit from public,anon,authenticated;
grant select on public.hub_role_audit to authenticated;
create policy hub_role_audit_admin_read on public.hub_role_audit for select to authenticated
using(public.hub_can(workspace_id,'admin',true));

create function hub_private.audit_member_roles() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if tg_op='UPDATE' and new.role is not distinct from old.role and new.extra_roles is not distinct from old.extra_roles then return new; end if;
 insert into public.hub_role_audit(workspace_id,actor_id,actor_source,member_id,operation,before_roles,after_roles,before_revision,after_revision)
 values(new.workspace_id,actor,case when actor is null then 'system' else 'member' end,new.user_id,
  case when tg_op='INSERT' then 'created' else 'changed' end,
  case when tg_op='INSERT' then '{}'::text[] else array[old.role]||old.extra_roles end,
  array[new.role]||new.extra_roles,case when tg_op='INSERT' then null else old.role_revision end,new.role_revision);
 return new;
end;
$$;
revoke all on function hub_private.audit_member_roles() from public,anon,authenticated;
create trigger hub_member_role_audit after insert or update on public.hub_members
for each row execute function hub_private.audit_member_roles();
commit;
