begin;

create table public.hub_triages (
  workspace_id uuid not null,
  lead_id uuid not null,
  record jsonb not null,
  scores smallint[] not null,
  completed boolean not null default false,
  primary key (workspace_id, lead_id),
  foreign key (workspace_id, lead_id) references public.hub_leads(workspace_id, id),
  check (jsonb_typeof(record) = 'object'),
  check (cardinality(scores) = 7 and array_ndims(scores) = 1 and array_lower(scores, 1) = 1),
  check (coalesce(scores[1] between 0 and 3, true) and coalesce(scores[2] between 0 and 3, true) and
         coalesce(scores[3] between 0 and 2, true) and coalesce(scores[4] between 0 and 2, true) and
         coalesce(scores[5] between 0 and 2, true) and coalesce(scores[6] between 0 and 2, true) and coalesce(scores[7] between 0 and 1, true)),
  check (not completed or (
    array_position(scores, null) is null and
    coalesce(nullif(btrim(record->>'observations'), ''), nullif(btrim(record->>'reports'), ''), nullif(btrim(record->>'evidence'), '')) is not null and
    nullif(btrim(record->>'approach'), '') is not null and
    nullif(btrim(record->>'owner'), '') is not null and
    nullif(btrim(record->>'next'), '') is not null and
    nullif(btrim(record->>'due'), '') is not null
  ))
);

create table public.hub_meetings (
  workspace_id uuid not null,
  lead_id uuid not null,
  id uuid not null default gen_random_uuid(),
  meeting_on date not null,
  state text not null check (state in ('Agendada', 'Realizada', 'Cancelada')),
  record jsonb not null,
  primary key (workspace_id, lead_id, id),
  foreign key (workspace_id, lead_id) references public.hub_leads(workspace_id, id),
  check (jsonb_typeof(record) = 'object'),
  check (nullif(btrim(record->>'participants'), '') is not null),
  check (state <> 'Realizada' or nullif(btrim(record->>'summary'), '') is not null)
);

alter table public.hub_triages enable row level security;
alter table public.hub_meetings enable row level security;
revoke all on public.hub_triages, public.hub_meetings from public, anon, authenticated;
grant select on public.hub_triages, public.hub_meetings to authenticated;
grant insert (workspace_id, lead_id, record, scores, completed),
  update (record, scores, completed) on public.hub_triages to authenticated;
grant insert (workspace_id, lead_id, id, meeting_on, state, record),
  update (meeting_on, state, record) on public.hub_meetings to authenticated;
create policy hub_triages_member on public.hub_triages for all to authenticated
  using (workspace_id in (select workspace_id from public.hub_members where user_id = (select auth.uid())))
  with check (workspace_id in (select workspace_id from public.hub_members where user_id = (select auth.uid())));
create policy hub_meetings_member on public.hub_meetings for all to authenticated
  using (workspace_id in (select workspace_id from public.hub_members where user_id = (select auth.uid())))
  with check (workspace_id in (select workspace_id from public.hub_members where user_id = (select auth.uid())));

alter table public.hub_leads add column stage text not null default 'Identificado' check (
  stage in ('Identificado', 'Em pesquisa', 'Qualificado', 'Contato planejado', 'Abordado', 'Reunião marcada',
            'Diagnóstico realizado', 'Proposta enviada', 'Negociação', 'Ganho', 'Perdido', 'Arquivado'));
alter table public.hub_leads add column profile jsonb not null default '{}' check (jsonb_typeof(profile) = 'object');
grant update (stage, profile) on public.hub_leads to authenticated;

create function public.hub_save_triage(
  p_workspace uuid, p_lead uuid, p_record jsonb, p_scores smallint[], p_completed boolean, p_profile jsonb,
  p_name text, p_segment text, p_city text, p_qualify boolean
) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_completed and (nullif(btrim(p_segment), '') is null or nullif(btrim(p_city), '') is null) then
    raise exception 'Segmento e cidade são necessários para concluir a triagem';
  end if;
  update public.hub_leads
    set name = p_name, segment = p_segment, city = p_city, profile = profile || p_profile,
        stage = case when p_completed and p_qualify and stage in ('Identificado', 'Em pesquisa') then 'Qualificado' else stage end
    where workspace_id = p_workspace and id = p_lead;
  if not found then return false; end if;
  insert into public.hub_triages (workspace_id, lead_id, record, scores, completed)
    values (p_workspace, p_lead, p_record, p_scores, p_completed)
    on conflict (workspace_id, lead_id) do update
      set record = excluded.record, scores = excluded.scores, completed = excluded.completed;
  return true;
end;
$$;

create function public.hub_save_meeting(
  p_workspace uuid, p_lead uuid, p_id uuid, p_date date, p_state text, p_record jsonb, p_follow_due date, p_advance boolean
) returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.hub_leads
    set stage = case
        when p_advance and p_state = 'Realizada' and stage in ('Identificado', 'Em pesquisa', 'Qualificado', 'Contato planejado', 'Abordado', 'Reunião marcada') then 'Diagnóstico realizado'
        when p_advance and p_state = 'Agendada' and stage in ('Identificado', 'Em pesquisa', 'Qualificado', 'Contato planejado', 'Abordado') then 'Reunião marcada'
        else stage end,
        profile = case when p_state = 'Realizada' then profile || jsonb_build_object('needs', p_record->>'summary') else profile end
    where workspace_id = p_workspace and id = p_lead;
  if not found then return false; end if;
  insert into public.hub_meetings (workspace_id, lead_id, id, meeting_on, state, record)
    values (p_workspace, p_lead, p_id, p_date, p_state, p_record)
    on conflict (workspace_id, lead_id, id) do update
      set meeting_on = excluded.meeting_on, state = excluded.state, record = excluded.record;
  if p_follow_due is not null and p_state <> 'Cancelada' then
    if nullif(btrim(p_record->>'owner'), '') is null then
      raise exception 'Informe o responsável pelo acompanhamento';
    end if;
    insert into public.hub_activities (workspace_id, lead_id, title, due_on, meeting_id, owner)
      values (p_workspace, p_lead, p_record->>'next', p_follow_due, p_id, p_record->>'owner')
      on conflict (workspace_id, lead_id, meeting_id) do update
        set title = excluded.title, due_on = excluded.due_on, owner = excluded.owner;
  end if;
  return true;
end;
$$;

alter table public.hub_activities add column meeting_id uuid, add column owner text not null default '';
alter table public.hub_activities add constraint hub_activity_meeting_link
  foreign key (workspace_id, lead_id, meeting_id) references public.hub_meetings(workspace_id, lead_id, id);
alter table public.hub_activities add unique (workspace_id, lead_id, meeting_id);
grant insert (meeting_id, owner), update (owner) on public.hub_activities to authenticated;

revoke execute on function public.hub_save_triage(uuid, uuid, jsonb, smallint[], boolean, jsonb, text, text, text, boolean) from public, anon;
revoke execute on function public.hub_save_meeting(uuid, uuid, uuid, date, text, jsonb, date, boolean) from public, anon;
grant execute on function public.hub_save_triage(uuid, uuid, jsonb, smallint[], boolean, jsonb, text, text, text, boolean) to authenticated;
grant execute on function public.hub_save_meeting(uuid, uuid, uuid, date, text, jsonb, date, boolean) to authenticated;

create function public.hub_dashboard(p_workspace uuid, p_today date)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'funnel', (select coalesce(jsonb_object_agg(stage, amount), '{}'::jsonb)
      from (select stage, count(*) amount from public.hub_leads where workspace_id = p_workspace group by stage) stages),
    'priorities', (select coalesce(jsonb_object_agg(priority, amount), '{}'::jsonb)
      from (select case when points >= 11 then 'A' when points >= 7 then 'B' else 'C' end as priority, count(*) amount
        from (select (select sum(value) from unnest(scores) as value) as points from public.hub_triages
          where workspace_id = p_workspace and completed) scores group by 1) priorities),
    'scheduled', (select count(*) from public.hub_meetings where workspace_id = p_workspace and state = 'Agendada'),
    'diagnosed', (select count(*) from public.hub_meetings where workspace_id = p_workspace and state = 'Realizada'),
    'pending', (select count(*) from public.hub_activities where workspace_id = p_workspace and status in ('Pendente', 'Em andamento')),
    'overdue', (select count(*) from public.hub_activities where workspace_id = p_workspace and status in ('Pendente', 'Em andamento') and due_on < p_today)
  )
  where exists (select 1 from public.hub_workspaces where id = p_workspace);
$$;
revoke execute on function public.hub_dashboard(uuid, date) from public, anon;
grant execute on function public.hub_dashboard(uuid, date) to authenticated;
commit;
