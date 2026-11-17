begin;
create table public.hub_activity_events(
 id bigint generated always as identity primary key, workspace_id uuid not null references public.hub_workspaces(id),
 activity_id uuid not null, lead_id uuid not null, project_id uuid, actor_id uuid,
 occurred_at timestamptz not null default clock_timestamp(), before_status text, after_status text not null,
 owner text not null default '', support boolean not null default false
);
create index hub_activity_events_period on public.hub_activity_events(workspace_id,occurred_at,id);
alter table public.hub_activity_events enable row level security;
revoke all on public.hub_activity_events from public,anon,authenticated;
grant select on public.hub_activity_events to authenticated;
create policy activity_event_read on public.hub_activity_events for select to authenticated
 using(public.hub_can(workspace_id,case when project_id is null then 'commercial' else 'projects' end));
create table hub_private.metric_capture(source text primary key,started_at timestamptz not null default clock_timestamp());
insert into hub_private.metric_capture(source) values('activity_status');
revoke all on hub_private.metric_capture from public,anon,authenticated;
create function hub_private.audit_activity_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.status is not distinct from old.status then return new; end if;
 insert into public.hub_activity_events(workspace_id,activity_id,lead_id,project_id,actor_id,before_status,after_status,owner,support)
 values(new.workspace_id,new.id,new.lead_id,new.project_proposal_id,auth.uid(),case when TG_OP='UPDATE' then old.status end,new.status,new.owner,new.support);
 return new;
end $$;
revoke all on function hub_private.audit_activity_status() from public,anon,authenticated;
create trigger hub_activity_status_audit after insert or update of status on public.hub_activities for each row execute function hub_private.audit_activity_status();
create function public.hub_metric_history(w uuid,from_on date,to_on date,owner_filter text default '',stage_filter text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; financial boolean;
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if from_on is null or to_on is null or from_on>to_on or to_on-from_on>1830 then raise exception 'Período inválido (máximo cinco anos)' using errcode='22023'; end if;
 financial:=public.hub_can(w,'finance');
 with events as (
  select (l.created_at at time zone 'America/Fortaleza')::date d,'cadastros' k,1::numeric v from public.hub_leads l where l.workspace_id=w and (coalesce(owner_filter,'')='' or l.profile->>'owner'=owner_filter) and (coalesce(stage_filter,'')='' or l.stage=stage_filter)
  union all select m.meeting_on,'reunioes',1 from public.hub_meetings m join public.hub_leads l on l.workspace_id=m.workspace_id and l.id=m.lead_id where m.workspace_id=w and (coalesce(owner_filter,'')='' or m.record->>'owner'=owner_filter) and (coalesce(stage_filter,'')='' or l.stage=stage_filter)
  union all select nullif(p.record->>'sentAt','')::date,'propostas_enviadas',1 from public.hub_proposals p join public.hub_leads l on l.workspace_id=p.workspace_id and l.id=p.lead_id where p.workspace_id=w and (coalesce(owner_filter,'')='' or l.profile->>'owner'=owner_filter) and (coalesce(stage_filter,'')='' or l.stage=stage_filter)
  union all select nullif(p.delivery->>'acceptedAt','')::date,'entregas_aceitas',1 from public.hub_projects p join public.hub_leads l on l.workspace_id=p.workspace_id and l.id=p.lead_id where p.workspace_id=w and (coalesce(owner_filter,'')='' or p.owner=owner_filter) and (coalesce(stage_filter,'')='' or l.stage=stage_filter)
  union all select (a.occurred_at at time zone 'America/Fortaleza')::date,case when a.support then 'suporte_concluido' else 'atividades_concluidas' end,1 from public.hub_activity_events a join public.hub_leads l on l.workspace_id=a.workspace_id and l.id=a.lead_id where a.workspace_id=w and a.after_status='Concluída' and (coalesce(owner_filter,'')='' or a.owner=owner_filter) and (coalesce(stage_filter,'')='' or l.stage=stage_filter)
  union all select (a.occurred_at at time zone 'America/Fortaleza')::date,case when a.after_record->>'stage'='Ganho' then 'entradas_ganho' else 'entradas_perdido' end,1 from public.hub_lead_audit a join public.hub_leads l on l.workspace_id=a.workspace_id and l.id=a.lead_id where a.workspace_id=w and a.before_record is not null and a.before_record->>'stage' is distinct from a.after_record->>'stage' and a.after_record->>'stage' in ('Ganho','Perdido') and (coalesce(owner_filter,'')='' or a.after_record->'profile'->>'owner'=owner_filter) and (coalesce(stage_filter,'')='' or l.stage=stage_filter)
  union all select f.due_on,'receita_prevista',f.amount from public.hub_receivables f join public.hub_projects p on p.workspace_id=f.workspace_id and p.proposal_id=f.proposal_id join public.hub_leads l on l.workspace_id=p.workspace_id and l.id=p.lead_id where financial and f.workspace_id=w and (coalesce(owner_filter,'')='' or p.owner=owner_filter) and (coalesce(stage_filter,'')='' or l.stage=stage_filter)
  union all select f.received_on,'receita_realizada',f.amount from public.hub_receipts f join public.hub_projects p on p.workspace_id=f.workspace_id and p.proposal_id=f.proposal_id join public.hub_leads l on l.workspace_id=p.workspace_id and l.id=p.lead_id where financial and f.workspace_id=w and f.reversed_at is null and (coalesce(owner_filter,'')='' or p.owner=owner_filter) and (coalesce(stage_filter,'')='' or l.stage=stage_filter)
 ), months as (select generate_series(date_trunc('month',from_on::timestamp),date_trunc('month',to_on::timestamp),interval '1 month')::date as bucket), totals as (
 select date_trunc('month',d)::date as bucket,k,sum(v) amount from events where d between from_on and to_on group by 1,2
 ) select jsonb_agg(jsonb_build_object('month',m.bucket,'cadastros',coalesce((select amount from totals where bucket=m.bucket and k='cadastros'),0),'reunioes',coalesce((select amount from totals where bucket=m.bucket and k='reunioes'),0),'propostas_enviadas',coalesce((select amount from totals where bucket=m.bucket and k='propostas_enviadas'),0),'entregas_aceitas',coalesce((select amount from totals where bucket=m.bucket and k='entregas_aceitas'),0),'atividades_concluidas',coalesce((select amount from totals where bucket=m.bucket and k='atividades_concluidas'),0),'suporte_concluido',coalesce((select amount from totals where bucket=m.bucket and k='suporte_concluido'),0),'entradas_ganho',coalesce((select amount from totals where bucket=m.bucket and k='entradas_ganho'),0),'entradas_perdido',coalesce((select amount from totals where bucket=m.bucket and k='entradas_perdido'),0))||case when financial then jsonb_build_object('receita_prevista',coalesce((select amount from totals where bucket=m.bucket and k='receita_prevista'),0),'receita_realizada',coalesce((select amount from totals where bucket=m.bucket and k='receita_realizada'),0)) else '{}'::jsonb end order by m.bucket) into result from months m;
 return jsonb_build_object('rows',coalesce(result,'[]'),'financial',financial,'from',from_on,'to',to_on,'activity_capture_since',(select started_at from hub_private.metric_capture where source='activity_status'),'lead_first_observed',(select min(occurred_at) from public.hub_lead_audit where workspace_id=w));
end $$;
revoke all on function public.hub_metric_history(uuid,date,date,text,text) from public,anon;
grant execute on function public.hub_metric_history(uuid,date,date,text,text) to authenticated;
commit;
