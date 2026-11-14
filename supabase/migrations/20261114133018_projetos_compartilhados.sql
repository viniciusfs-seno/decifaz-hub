begin;
create table public.hub_projects (
 workspace_id uuid not null,
 proposal_id uuid not null,
 lead_id uuid not null,
 approved jsonb not null,
 owner text not null default '',
 due_on date,
 status text not null default 'Planejado' check (status in ('Planejado','Em andamento','Em homologação','Entregue')),
 deliverables text not null default '',
 primary key(workspace_id,proposal_id),
 foreign key(workspace_id,proposal_id) references public.hub_proposals(workspace_id,id),
 foreign key(workspace_id,lead_id) references public.hub_leads(workspace_id,id)
);
create index hub_projects_lead_idx on public.hub_projects(workspace_id,lead_id);
alter table public.hub_projects enable row level security;
revoke all on public.hub_projects from public, anon, authenticated;
grant select, update(owner,due_on,status,deliverables) on public.hub_projects to authenticated;
create policy hub_projects_read on public.hub_projects for select to authenticated
 using (workspace_id in (select workspace_id from public.hub_members where user_id=(select auth.uid())));
create policy hub_projects_update on public.hub_projects for update to authenticated
 using (workspace_id in (select workspace_id from public.hub_members where user_id=(select auth.uid())))
 with check (workspace_id in (select workspace_id from public.hub_members where user_id=(select auth.uid())));

create function hub_private.open_project(w uuid,p uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.hub_members where workspace_id=w and user_id=auth.uid()) then return false; end if;
 insert into public.hub_projects(workspace_id,proposal_id,lead_id,approved,deliverables)
 select workspace_id,id,lead_id,record || jsonb_build_object('version',version),record->>'scope'
 from public.hub_proposals where workspace_id=w and id=p and status='Aceita'
 on conflict(workspace_id,proposal_id) do nothing;
 return exists(select 1 from public.hub_projects where workspace_id=w and proposal_id=p);
end;
$$;
revoke all on function hub_private.open_project(uuid,uuid) from public,anon;
grant execute on function hub_private.open_project(uuid,uuid) to authenticated;
create function public.hub_open_project(w uuid,p uuid)
returns boolean language sql security invoker set search_path='' as $$
 select hub_private.open_project(w,p);
$$;
revoke all on function public.hub_open_project(uuid,uuid) from public,anon;
grant execute on function public.hub_open_project(uuid,uuid) to authenticated;
commit;
