begin;
-- Expand only: old frontend/Edge keep working while every member is admin.
alter table public.hub_members add column role text not null default 'admin'
 check (role in ('admin','commercial','operations','finance'));
alter table public.hub_members alter column role drop default;
create function public.hub_can(w uuid, module text, writing boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hub_members where workspace_id=w and user_id=auth.uid()
 and case module
 when 'commercial' then not writing or role in ('admin','commercial')
 when 'projects' then not writing or role in ('admin','operations')
 when 'finance' then role in ('admin','finance')
 when 'admin' then role='admin'
 else false end);
$$;
revoke all on function public.hub_can(uuid,text,boolean) from public,anon;
grant execute on function public.hub_can(uuid,text,boolean) to authenticated;


create table hub_private.access_release (singleton boolean primary key default true check(singleton), hardened boolean not null);
insert into hub_private.access_release values(true,false);
revoke all on hub_private.access_release from public,anon,authenticated;
create function hub_private.guard_member_role() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.role<>'admin' and (
  not coalesce((select hardened from hub_private.access_release where singleton),false)
  or has_column_privilege('authenticated','public.hub_proposals','record','SELECT')
  or has_column_privilege('authenticated','public.hub_projects','approved','SELECT')
 ) then raise check_violation using message='Revogue os JSONs brutos antes de atribuir papeis restritos'; end if;
 return new;
end;
$$;
revoke all on function hub_private.guard_member_role() from public,anon,authenticated;
create trigger hub_member_role_release before insert or update of role on public.hub_members
for each row execute function hub_private.guard_member_role();
create view public.hub_proposals_visible with (security_barrier=true) as
select workspace_id,id,lead_id,series_id,version,meeting_id,status,record from public.hub_proposals
where public.hub_can(workspace_id,'commercial');
create view public.hub_projects_visible with (security_barrier=true) as
select workspace_id,proposal_id,lead_id,owner,due_on,status,deliverables,delivery,approved from public.hub_projects
where public.hub_can(workspace_id,'projects');
revoke all on public.hub_proposals_visible,public.hub_projects_visible from public,anon,authenticated;
grant select on public.hub_proposals_visible,public.hub_projects_visible to authenticated;
commit;
