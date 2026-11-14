begin;

create table public.hub_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '')
);

create table public.hub_members (
  workspace_id uuid not null references public.hub_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (workspace_id, user_id)
);

create table public.hub_leads (
  workspace_id uuid not null references public.hub_workspaces(id),
  id uuid not null default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  segment text not null default '',
  city text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create table public.hub_interactions (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  lead_id uuid not null,
  author_id uuid not null default auth.uid(),
  body text not null check (btrim(body) <> ''),
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  foreign key (workspace_id, lead_id) references public.hub_leads(workspace_id, id)
);

create table public.hub_activities (
  workspace_id uuid not null,
  id uuid not null default gen_random_uuid(),
  lead_id uuid not null,
  title text not null check (btrim(title) <> ''),
  due_on date,
  status text not null default 'Pendente' check (status in ('Pendente', 'Em andamento', 'Concluída', 'Cancelada')),
  primary key (workspace_id, id),
  foreign key (workspace_id, lead_id) references public.hub_leads(workspace_id, id)
);

create index hub_members_user_idx on public.hub_members (user_id, workspace_id);
create index hub_interactions_lead_idx on public.hub_interactions (workspace_id, lead_id, created_at);
create index hub_activities_lead_idx on public.hub_activities (workspace_id, lead_id);

alter table public.hub_members enable row level security;
create policy hub_members_own on public.hub_members for select to authenticated
  using (user_id = (select auth.uid()));

-- Membership is provisioned administratively after inviting the two users.
revoke all on public.hub_members, public.hub_workspaces, public.hub_leads,
  public.hub_interactions, public.hub_activities from public, anon, authenticated;
grant select on public.hub_members, public.hub_workspaces to authenticated;
grant select on public.hub_leads, public.hub_interactions, public.hub_activities to authenticated;
grant insert (workspace_id, name, segment, city, notes),
  update (name, segment, city, notes) on public.hub_leads to authenticated;
grant insert (workspace_id, lead_id, body) on public.hub_interactions to authenticated;
grant insert (workspace_id, lead_id, title, due_on, status),
  update (title, due_on, status) on public.hub_activities to authenticated;

alter table public.hub_workspaces enable row level security;
create policy hub_workspace_read on public.hub_workspaces for select to authenticated
  using (id in (select workspace_id from public.hub_members where user_id = (select auth.uid())));

alter table public.hub_leads enable row level security;
create policy hub_leads_member on public.hub_leads for all to authenticated
  using (workspace_id in (select workspace_id from public.hub_members where user_id = (select auth.uid())))
  with check (workspace_id in (select workspace_id from public.hub_members where user_id = (select auth.uid())));

alter table public.hub_interactions enable row level security;
create policy hub_interactions_read on public.hub_interactions for select to authenticated
  using (workspace_id in (select workspace_id from public.hub_members where user_id = (select auth.uid())));
create policy hub_interactions_add on public.hub_interactions for insert to authenticated
  with check (author_id = (select auth.uid()) and workspace_id in
    (select workspace_id from public.hub_members where user_id = (select auth.uid())));

alter table public.hub_activities enable row level security;
create policy hub_activities_member on public.hub_activities for all to authenticated
  using (workspace_id in (select workspace_id from public.hub_members where user_id = (select auth.uid())))
  with check (workspace_id in (select workspace_id from public.hub_members where user_id = (select auth.uid())));

commit;
