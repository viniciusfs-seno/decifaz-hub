begin;
alter table public.hub_activities add column revision bigint not null default 0,
 add column assigned_user_id uuid,add column result text not null default '',add column completed_at timestamptz;
create index hub_activities_assignee on public.hub_activities(workspace_id,assigned_user_id,status,due_on,id);
create table public.hub_activity_audit(
 id bigint generated always as identity primary key,workspace_id uuid not null,
 activity_id uuid not null,actor_id uuid,occurred_at timestamptz not null default clock_timestamp(),
 before_record jsonb,after_record jsonb not null,project_id uuid
);
alter table public.hub_activity_audit enable row level security;
create index hub_activity_audit_recent on public.hub_activity_audit(workspace_id,activity_id,occurred_at desc,id desc);
revoke all on public.hub_activity_audit from public,anon,authenticated;
grant select on public.hub_activity_audit to authenticated;
create policy activity_audit_read on public.hub_activity_audit for select to authenticated
 using(public.hub_can(workspace_id,case when project_id is null then 'commercial' else 'projects' end));
create function hub_private.activity_revision() returns trigger language plpgsql set search_path='' as $$
begin
 new.revision:=case when TG_OP='INSERT' then 0 else old.revision+1 end;
 if TG_OP='INSERT' then new.completed_at:=case when new.status='Concluída' then clock_timestamp() else null end;
 elsif new.status is distinct from old.status then new.completed_at:=case when new.status='Concluída' then clock_timestamp() else null end;end if;
 return new;
end $$;
create function hub_private.audit_activity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.hub_activity_audit(workspace_id,activity_id,actor_id,before_record,after_record,project_id)
 values(new.workspace_id,new.id,auth.uid(),case when TG_OP='UPDATE' then to_jsonb(old) end,to_jsonb(new),new.project_proposal_id);
 return new;
end $$;
revoke all on function hub_private.activity_revision(),hub_private.audit_activity() from public,anon,authenticated;
create trigger hub_activity_revision before insert or update on public.hub_activities for each row execute function hub_private.activity_revision();
create trigger hub_activity_audit after insert or update on public.hub_activities for each row execute function hub_private.audit_activity();
create function public.hub_work_assignees(w uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(nullif(u.raw_user_meta_data->>'full_name',''),'Integrante '||left(m.user_id::text,8))) order by m.user_id),'[]')
 from public.hub_members m join auth.users u on u.id=m.user_id where m.workspace_id=w and m.active);
end $$;
create function public.hub_save_activity(w uuid,a uuid,expected_revision bigint,operation_id uuid,body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare task public.hub_activities; receipt hub_private.command_receipts; payload jsonb; answer jsonb; lead uuid; project uuid; assigned uuid; follow jsonb; follow_id uuid; next_assigned uuid; conclusion boolean;
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 if operation_id is null or jsonb_typeof(body) is distinct from 'object' or length(body::text)>30000
 or exists(select 1 from jsonb_object_keys(body) k where k not in ('lead_id','project_id','title','owner','assigned_user_id','due','status','result','followup'))
 or nullif(btrim(body->>'title'),'') is null or nullif(btrim(body->>'owner'),'') is null or body->>'status' not in ('Pendente','Em andamento','Concluída','Cancelada') or body->>'status' is null then raise exception 'Informe título, responsável e situação válidos' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||operation_id::text,0));
 payload:=jsonb_build_object('a',a,'revision',expected_revision,'body',body);
 select * into receipt from hub_private.command_receipts r where r.workspace_id=w and r.operation_id=hub_save_activity.operation_id;
 if found then
  if receipt.actor_id<>auth.uid() or receipt.kind<>'activity' or receipt.payload<>payload then raise exception 'Identificador já utilizado' using errcode='22023';end if;
  if not public.hub_can(w,case when receipt.result->'current'->>'project_proposal_id' is null then 'commercial' else 'projects' end,true) then raise exception 'Acesso negado' using errcode='42501';end if;
  return receipt.result;
 end if;
 if a is not null then
  select * into task from public.hub_activities where workspace_id=w and id=a for update;
  if not found then raise exception 'Atividade indisponível' using errcode='42501';end if;
  lead:=task.lead_id;project:=task.project_proposal_id;
 else lead:=(body->>'lead_id')::uuid;project:=nullif(body->>'project_id','')::uuid;end if;
 if not public.hub_can(w,case when project is null then 'commercial' else 'projects' end,true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if a is not null and expected_revision is distinct from task.revision then return jsonb_build_object('status','conflict','current',to_jsonb(task));end if;
 if not exists(select 1 from public.hub_leads where workspace_id=w and id=lead) or project is not null and not exists(select 1 from public.hub_projects where workspace_id=w and proposal_id=project and lead_id=lead) then raise exception 'Vínculo indisponível' using errcode='42501';end if;
 assigned:=nullif(body->>'assigned_user_id','')::uuid;
 if assigned is not null and not exists(select 1 from public.hub_members where workspace_id=w and user_id=assigned and active) then raise exception 'Responsável não é integrante ativo deste espaço' using errcode='22023';end if;
 follow:=body->'followup';
 if follow is not null and follow<>'null'::jsonb then
  if body->>'status'<>'Concluída' or a is null or task.status='Concluída' or jsonb_typeof(follow)<>'object' or nullif(btrim(follow->>'title'),'') is null or nullif(btrim(follow->>'owner'),'') is null or nullif(follow->>'due','') is null then raise exception 'Acompanhamento exige conclusão, título, responsável e prazo' using errcode='22023';end if;
  next_assigned:=nullif(follow->>'assigned_user_id','')::uuid;
  if next_assigned is not null and not exists(select 1 from public.hub_members where workspace_id=w and user_id=next_assigned and active) then raise exception 'Responsável indisponível' using errcode='22023';end if;
 end if;
 conclusion:=body->>'status'='Concluída' and (a is null or task.status<>'Concluída');
 if a is null then
  insert into public.hub_activities(workspace_id,lead_id,project_proposal_id,title,owner,due_on,status,result,assigned_user_id)
  values(w,lead,project,btrim(body->>'title'),body->>'owner',nullif(body->>'due','')::date,body->>'status',coalesce(body->>'result',''),assigned) returning * into task;
 else
  update public.hub_activities set title=btrim(body->>'title'),owner=body->>'owner',due_on=nullif(body->>'due','')::date,status=body->>'status',result=coalesce(body->>'result',''),assigned_user_id=assigned where workspace_id=w and id=a returning * into task;
 end if;
 if follow is not null and follow<>'null'::jsonb then
  insert into public.hub_activities(workspace_id,lead_id,project_proposal_id,support,title,owner,due_on,assigned_user_id)
  values(w,lead,project,task.support,btrim(follow->>'title'),follow->>'owner',(follow->>'due')::date,next_assigned) returning id into follow_id;
 end if;
 if conclusion and nullif(btrim(body->>'result'),'') is not null then
  insert into public.hub_interactions(workspace_id,lead_id,body) values(w,lead,'Atividade concluída: '||task.title||E'\nResultado: '||(body->>'result'));
 end if;
 -- Only replace the matching commercial next action; preserve unrelated edits.
 if conclusion and public.hub_can(w,'commercial',true) then
  update public.hub_leads set profile=profile||jsonb_build_object('next',coalesce(follow->>'title',''),'owner',coalesce(follow->>'owner',profile->>'owner',''),'due',coalesce(follow->>'due',''))
  where workspace_id=w and id=lead and profile->>'next'=task.title
   and coalesce(profile->>'due','')=coalesce(task.due_on::text,'');
 end if;
 answer:=jsonb_build_object('status','saved','current',to_jsonb(task),'followup_id',follow_id);
 insert into hub_private.command_receipts values(w,operation_id,auth.uid(),'activity',payload,answer);
 return answer;
end $$;
revoke all on function public.hub_work_assignees(uuid),public.hub_save_activity(uuid,uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.hub_work_assignees(uuid),public.hub_save_activity(uuid,uuid,bigint,uuid,jsonb) to authenticated;
do $$ declare t text;begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['hub_leads','hub_triages','hub_interactions','hub_activities'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
  end loop;
 end if;
end $$;
-- Change clock: a small authorized poll recovers missed Realtime events.
create table hub_private.workspace_versions(workspace_id uuid primary key references public.hub_workspaces(id) on delete cascade,version bigint not null default 0);
revoke all on hub_private.workspace_versions from public,anon,authenticated;
create function hub_private.bump_workspace_version() returns trigger language plpgsql security definer set search_path='' as $$
declare w uuid;begin
 w:=case when TG_OP='DELETE' then old.workspace_id else new.workspace_id end;
 if exists(select 1 from public.hub_workspaces where id=w) then
  insert into hub_private.workspace_versions values(w,1) on conflict(workspace_id) do update set version=hub_private.workspace_versions.version+1;
 end if;
 return case when TG_OP='DELETE' then old else new end;
end $$;
revoke all on function hub_private.bump_workspace_version() from public,anon,authenticated;
create trigger hub_leads_changed after insert or update or delete on public.hub_leads for each row execute function hub_private.bump_workspace_version();
create trigger hub_triages_changed after insert or update or delete on public.hub_triages for each row execute function hub_private.bump_workspace_version();
create trigger hub_interactions_changed after insert or update or delete on public.hub_interactions for each row execute function hub_private.bump_workspace_version();
create trigger hub_activities_changed after insert or update or delete on public.hub_activities for each row execute function hub_private.bump_workspace_version();
create function public.hub_workspace_version(w uuid) returns bigint language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 return coalesce((select version from hub_private.workspace_versions where workspace_id=w),0);
end $$;
revoke all on function public.hub_workspace_version(uuid) from public,anon;
grant execute on function public.hub_workspace_version(uuid) to authenticated;
commit;
