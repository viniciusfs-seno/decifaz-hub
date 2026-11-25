begin;
-- Explicit, dated events only. No reconstruction of old interactions.
create function hub_private.commercial_metric_rows(w uuid,from_on date,to_on date,owner_filter text,stage_filter text)
returns table(metric text,id text,lead_id uuid,title text,on_day date,outcome text,days integer)
language sql stable security definer set search_path='' as $$
 with leads as(select * from public.hub_leads l where workspace_id=w and (coalesce(owner_filter,'')='' or l.profile->>'owner'=owner_filter) and (coalesce(stage_filter,'')='' or l.stage=stage_filter)),
 meeting_results as(
 select m.id,m.lead_id,m.commercial_result value from public.hub_meetings m where m.workspace_id=w and m.commercial_result is not null
 union
 select e.record_id,e.lead_id,e.after_record->'commercial_result' from public.hub_registry_events e where e.workspace_id=w and e.kind='meeting' and e.after_record->'commercial_result' is not null
 ),events as(
 select i.id::text id,i.lead_id,i.occurred_on on_day,i.result_code outcome,i.created_at recorded_at from public.hub_interactions i where i.workspace_id=w and i.kind is not null and i.occurred_on is not null and i.result_code is not null
 union all
 select 'meeting:'||r.id||':'||(r.value->>'recorded_at'),r.lead_id,hub_private.notice_commercial_date(r.value->>'occurred_on'),r.value->>'outcome',(r.value->>'recorded_at')::timestamptz from meeting_results r where r.value->>'recorded_at' is not null
 ),first_approach as(select lead_id,min(on_day) approach_on from events where outcome='advanced' group by lead_id)
 select 'result',e.id,l.id,l.name,e.on_day,e.outcome,null::integer from events e join leads l on l.id=e.lead_id where e.on_day between from_on and to_on
 union all
 select 'pending',s.source_key,l.id,l.name||' · '||s.title,s.due_on,case when s.due_on<(current_timestamp at time zone 'America/Fortaleza')::date then 'overdue' else 'pending' end,null::integer
 from hub_private.commercial_due_sources(w) s left join public.hub_activities a on a.workspace_id=w and s.kind='commercial-activity' and a.id=s.record_id join leads l on l.id=case when s.kind='commercial-activity' then a.lead_id else s.record_id end where s.remind and s.due_on between from_on and to_on
 union all
 select 'resume',l.id::text,l.id,l.name,hub_private.notice_commercial_date(l.profile->>'resume_on'),'resume',null::integer from leads l where l.stage not in('Ganho','Perdido','Arquivado') and l.profile->>'commercial_outcome'='resume' and hub_private.notice_commercial_date(l.profile->>'resume_on') between from_on and to_on
 union all
 select 'approach',l.id::text,l.id,l.name,(l.created_at at time zone 'America/Fortaleza')::date,case when f.approach_on between (l.created_at at time zone 'America/Fortaleza')::date and to_on then 'observed' when f.approach_on<(l.created_at at time zone 'America/Fortaleza')::date then 'before_registration' else 'unavailable' end,
 case when f.approach_on between (l.created_at at time zone 'America/Fortaleza')::date and to_on then f.approach_on-(l.created_at at time zone 'America/Fortaleza')::date else null end
 from leads l left join first_approach f on f.lead_id=l.id where (l.created_at at time zone 'America/Fortaleza')::date between from_on and to_on
$$;
revoke all on function hub_private.commercial_metric_rows(uuid,date,date,text,text) from public,anon,authenticated;
create function public.hub_commercial_metrics(w uuid,from_on date,to_on date,owner_filter text default '',stage_filter text default '',metric_filter text default 'result',skip integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;coverage timestamptz;legacy integer;
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 if from_on is null or to_on is null or from_on>to_on or to_on-from_on>1830 or skip<0 or skip>100000 or metric_filter not in('result','pending','resume','approach') then raise exception 'Recorte inválido' using errcode='22023';end if;
 select min(x) into coverage from(
 select min(created_at) x from public.hub_interactions where workspace_id=w and kind is not null and occurred_on is not null and result_code is not null
 union all select min((commercial_result->>'recorded_at')::timestamptz) from public.hub_meetings where workspace_id=w and commercial_result is not null
 )c;
 select count(*) into legacy from public.hub_interactions i join public.hub_leads l on l.workspace_id=i.workspace_id and l.id=i.lead_id where i.workspace_id=w and (i.kind is null or i.occurred_on is null or i.result_code is null) and (coalesce(owner_filter,'')='' or l.profile->>'owner'=owner_filter) and (coalesce(stage_filter,'')='' or l.stage=stage_filter);
 with rows as materialized(select * from hub_private.commercial_metric_rows(w,from_on,to_on,owner_filter,stage_filter))
 select jsonb_build_object(
 'results',(select coalesce(jsonb_object_agg(outcome,n),'{}') from(select outcome,count(*) n from rows where metric='result' group by outcome)g),
 'pending',(select count(*) from rows where metric='pending'),'overdue',(select count(*) from rows where metric='pending' and outcome='overdue'),
 'resumptions',(select count(*) from rows where metric='resume'),
 'approach_cohort',(select count(*) from rows where metric='approach'),'approach_observed',(select count(days) from rows where metric='approach'),
 'approach_days',(select round(avg(days),1) from rows where metric='approach'),
 'approach_excluded',(select count(*) from rows where metric='approach' and outcome='before_registration'),
 'response_days',null,'response_reason','Sem eventos correlacionados de envio e resposta do cliente.',
 'coverage_since',coverage,'legacy_uncovered',legacy,
 'total',(select count(*) from rows where metric=metric_filter),
 'rows',(select coalesce(jsonb_agg(to_jsonb(x) order by on_day,id),'[]') from(select * from rows where metric=metric_filter order by on_day,id limit 25 offset skip)x)
 ) into result;return result;
end $$;
create function public.hub_commercial_metrics_csv(w uuid,from_on date,to_on date,owner_filter text default '',stage_filter text default '') returns text
language plpgsql stable security definer set search_path='' as $$
declare content text;report jsonb;
begin
 report:=public.hub_commercial_metrics(w,from_on,to_on,owner_filter,stage_filter);
 select string_agg(hub_private.csv_cell(metric)||';'||hub_private.csv_cell(title)||';'||hub_private.csv_cell(on_day::text)||';'||hub_private.csv_cell(outcome)||';'||hub_private.csv_cell(days::text),E'\r\n' order by metric,on_day,id) into content from hub_private.commercial_metric_rows(w,from_on,to_on,owner_filter,stage_filter);
 return 'Métrica;Registro autorizado;Data;Resultado;Dias até abordagem'||E'\r\n'||coalesce(content,'')||E'\r\n'||'Cobertura de eventos;'||hub_private.csv_cell(report->>'coverage_since')||E'\r\n'||'Legados sem cobertura;'||(report->>'legacy_uncovered')||E'\r\n'||'Coorte de cadastros;'||(report->>'approach_cohort')||E'\r\n'||'Abordagens observadas;'||(report->>'approach_observed')||E'\r\n'||'Resposta do cliente;Indisponível: sem eventos correlacionados';
end $$;
revoke all on function public.hub_commercial_metrics(uuid,date,date,text,text,text,integer),public.hub_commercial_metrics_csv(uuid,date,date,text,text) from public,anon;
grant execute on function public.hub_commercial_metrics(uuid,date,date,text,text,text,integer),public.hub_commercial_metrics_csv(uuid,date,date,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
