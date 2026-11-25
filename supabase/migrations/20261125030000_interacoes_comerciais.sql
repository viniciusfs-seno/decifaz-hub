begin;
-- Compatibility: old interaction bodies and legacy commands remain readable.
alter table public.hub_interactions add column kind text,add column occurred_on date,add column result_code text,add column reason text;
alter table public.hub_meetings add column commercial_result jsonb;
revoke insert(commercial_result),update(commercial_result) on public.hub_meetings from authenticated;
revoke insert(kind,occurred_on,result_code,reason),update(kind,occurred_on,result_code,reason) on public.hub_interactions from authenticated;
create table hub_private.commercial_followups(
 workspace_id uuid not null references public.hub_workspaces(id) on delete cascade,lead_id uuid not null,
 activity_id uuid,plan jsonb not null,primary key(workspace_id,lead_id)
);
revoke all on hub_private.commercial_followups from public,anon,authenticated;
create function hub_private.sync_commercial_followup(w uuid,l uuid,m uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare lead public.hub_leads;prior hub_private.commercial_followups;task public.hub_activities;meeting_task public.hub_activities;plan jsonb;assigned uuid;label text;matches integer;link_meeting uuid:=m;project uuid;
begin
 select * into lead from public.hub_leads where workspace_id=w and id=l for update;
 if not found then raise exception 'Estabelecimento indisponível' using errcode='42501';end if;
 plan:=jsonb_build_object('type',coalesce(lead.profile->>'next_action_id',''),'title',coalesce(lead.profile->>'next',''),'details',coalesce(lead.profile->>'next_details',''),'owner',coalesce(lead.profile->>'owner_id',''),'due',coalesce(lead.profile->>'due',''));
 select * into prior from hub_private.commercial_followups where workspace_id=w and lead_id=l;
 plan:=plan||jsonb_build_object('meeting_id',coalesce(m::text,prior.plan->>'meeting_id',''));
 if prior.plan=plan then return prior.activity_id;end if;
 if prior.activity_id is not null then select * into task from public.hub_activities where workspace_id=w and id=prior.activity_id for update nowait;end if;
 if plan->>'type'='' or plan->>'title'='' or plan->>'due'='' then
  if prior.activity_id is not null and task.status in ('Pendente','Em andamento') then update public.hub_activities set status='Cancelada',result='Plano comercial retirado explicitamente' where workspace_id=w and id=task.id;end if;
  insert into hub_private.commercial_followups values(w,l,null,plan) on conflict(workspace_id,lead_id) do update set activity_id=null,plan=excluded.plan;
  return null;
 end if;
 assigned:=nullif(plan->>'owner','')::uuid;
 select p->>'name' into label from jsonb_array_elements(hub_private.workspace_people(w)) p where p->>'id'=assigned::text and (p->>'active')::boolean;
 if label is null then raise exception 'Escolha um responsável ativo por identificador para agendar' using errcode='22023';end if;
 perform 1 from public.hub_members where workspace_id=w and user_id=assigned and active for share;
 if not found then raise exception 'Responsável indisponível' using errcode='22023';end if;
 if not exists(select 1 from public.hub_commercial_classifications where workspace_id=w and kind='action' and id=plan->>'type' and (active or lead.profile->>'next_action_id'=prior.plan->>'type')) then raise exception 'Tipo de ação indisponível' using errcode='22023';end if;
 -- Reuse an existing meeting follow-up or a uniquely matching action created by
 -- the legacy completion command; never clone that command's follow-up.
 if m is not null then
  select project_id into project from public.hub_meetings where workspace_id=w and lead_id=l and id=m;
  if project is not null and not public.hub_can(w,'projects',true) then raise exception 'Acesso ao projeto negado' using errcode='42501';end if;
  select * into meeting_task from public.hub_activities where workspace_id=w and lead_id=l and meeting_id=m for update nowait;
  task:=null;if found and meeting_task.status in ('Pendente','Em andamento') then task:=meeting_task;elsif found then link_meeting:=null;end if;
 end if;
 if task.id is null or task.status not in ('Pendente','Em andamento') then
  select count(*) into matches from public.hub_activities where workspace_id=w and lead_id=l and title=plan->>'title' and due_on=(plan->>'due')::date and assigned_user_id=assigned and (m is null or meeting_id=m) and status in ('Pendente','Em andamento');
  if matches=1 then select * into task from public.hub_activities where workspace_id=w and lead_id=l and title=plan->>'title' and due_on=(plan->>'due')::date and assigned_user_id=assigned and (m is null or meeting_id=m) and status in ('Pendente','Em andamento') for update nowait;else task:=null;end if;
 end if;
 if task.id is null then
  insert into public.hub_activities(workspace_id,lead_id,title,owner,assigned_user_id,due_on,meeting_id,project_proposal_id)
  values(w,l,plan->>'title',label,assigned,(plan->>'due')::date,link_meeting,project) returning * into task;
 else update public.hub_activities set title=plan->>'title',owner=label,assigned_user_id=assigned,due_on=(plan->>'due')::date where workspace_id=w and id=task.id returning * into task;end if;
 insert into hub_private.commercial_followups values(w,l,task.id,plan) on conflict(workspace_id,lead_id) do update set activity_id=excluded.activity_id,plan=excluded.plan;
 return task.id;
end $$;
create function public.hub_save_commercial_lead(w uuid,l uuid,expected_revision bigint,operation_id uuid,body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt hub_private.command_receipts;payload jsonb;answer jsonb;activity uuid;
begin
 if not public.hub_can(w,'commercial',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if operation_id is null then raise exception 'Operação obrigatória' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||operation_id::text,0));payload:=jsonb_build_object('l',l,'revision',expected_revision,'body',body);
 select * into receipt from hub_private.command_receipts r where r.workspace_id=w and r.operation_id=hub_save_commercial_lead.operation_id;
 if found then if receipt.actor_id<>auth.uid() or receipt.kind<>'commercial_lead' or receipt.payload<>payload then raise exception 'Identificador já utilizado' using errcode='22023';end if;return receipt.result;end if;
 answer:=public.hub_save_lead(w,l,expected_revision,body);if answer->>'status'='conflict' then return answer;end if;
 activity:=hub_private.sync_commercial_followup(w,(answer->'current'->>'id')::uuid);
 answer:=answer||jsonb_build_object('activity_id',activity);
 insert into hub_private.command_receipts values(w,operation_id,auth.uid(),'commercial_lead',payload,answer);return answer;
end $$;
create function public.hub_record_commercial_interaction(w uuid,l uuid,expected_revision bigint,operation_id uuid,body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lead public.hub_leads;receipt hub_private.command_receipts;payload jsonb;answer jsonb;interaction uuid;activity uuid;m uuid;meeting public.hub_meetings;outcome text;patch jsonb:='{}';target text;plan jsonb;recorded_on date;actor uuid;
begin
 if not public.hub_can(w,'commercial',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if operation_id is null or jsonb_typeof(body) is distinct from 'object' or length(body::text)>15000
 or exists(select 1 from jsonb_object_keys(body) k where k not in ('kind','occurred_on','summary','outcome','reason','resume_on','meeting_id','meeting_revision','plan','confirm_won'))
 or exists(select 1 from jsonb_each(body) e where e.key in ('kind','occurred_on','summary','outcome','reason','resume_on','meeting_id') and jsonb_typeof(e.value)<>'string')
 or body->>'kind' is null or body->>'kind' not in ('whatsapp','phone','visit','meeting','other') or nullif(btrim(body->>'summary'),'') is null
 or body->>'outcome' is null or body->>'outcome' not in ('recorded','waiting','resume','lost','advanced','won') then raise exception 'Informe tipo, resumo e resultado válidos' using errcode='22023';end if;
 recorded_on:=nullif(body->>'occurred_on','')::date;if recorded_on is null or recorded_on>(clock_timestamp() at time zone 'America/Fortaleza')::date then raise exception 'Informe data efetiva válida' using errcode='22023';end if;
 outcome:=body->>'outcome';
 if outcome in ('lost','resume') and nullif(btrim(body->>'reason'),'') is null then raise exception 'Registre o motivo' using errcode='22023';end if;
 if outcome='resume' and (nullif(body->>'resume_on','') is null or (body->>'resume_on')::date<recorded_on) then raise exception 'Informe a data de retomada' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||operation_id::text,0));payload:=jsonb_build_object('l',l,'revision',expected_revision,'body',body);
 select * into receipt from hub_private.command_receipts r where r.workspace_id=w and r.operation_id=hub_record_commercial_interaction.operation_id;
 if found then if receipt.actor_id<>auth.uid() or receipt.kind<>'commercial_interaction' or receipt.payload<>payload then raise exception 'Identificador já utilizado' using errcode='22023';end if;return receipt.result;end if;
 select * into lead from public.hub_leads where workspace_id=w and id=l for update;if not found then raise exception 'Estabelecimento indisponível' using errcode='42501';end if;
 if expected_revision is distinct from lead.revision then return jsonb_build_object('status','conflict','current',to_jsonb(lead));end if;
 if outcome in ('waiting','resume','advanced') and lead.stage in ('Ganho','Perdido','Arquivado') then raise exception 'Reabra a oportunidade pelo fluxo apropriado antes de registrar esse resultado' using errcode='22023';end if;
 if outcome='won' and (body->'confirm_won' is distinct from 'true'::jsonb or not public.hub_can(w,'admin',true) or not exists(select 1 from public.hub_proposals where workspace_id=w and lead_id=l and status='Aceita')) then raise exception 'Ganho exige Administração, aceite registrado e confirmação explícita' using errcode='42501';end if;
 if body->>'kind'='meeting' then
  m:=nullif(body->>'meeting_id','')::uuid;select * into meeting from public.hub_meetings where workspace_id=w and lead_id=l and id=m for update;
  if not found or meeting.state<>'Realizada' then raise exception 'Selecione uma reunião realizada deste estabelecimento' using errcode='22023';end if;
  if meeting.project_id is not null and not public.hub_can(w,'projects',true) then raise exception 'Acesso ao projeto negado' using errcode='42501';end if;
  if nullif(body->>'meeting_revision','')::bigint is distinct from meeting.revision then return jsonb_build_object('status','conflict','current',to_jsonb(lead),'meeting_conflict',true);end if;
  if recorded_on<>meeting.meeting_on then raise exception 'Use a data da reunião selecionada' using errcode='22023';end if;
  update public.hub_meetings set commercial_result=jsonb_build_object('summary',body->>'summary','outcome',outcome,'reason',coalesce(body->>'reason',''),'occurred_on',recorded_on,'actor_id',auth.uid(),'recorded_at',clock_timestamp()) where workspace_id=w and lead_id=l and id=m;
 else
  if nullif(body->>'meeting_id','') is not null then raise exception 'Referência de reunião só se aplica a reunião' using errcode='22023';end if;
  insert into public.hub_interactions(workspace_id,lead_id,body,kind,occurred_on,result_code,reason) values(w,l,btrim(body->>'summary'),body->>'kind',recorded_on,outcome,nullif(body->>'reason','')) returning id into interaction;
 end if;
 target:=case when outcome='lost' then 'Perdido' when outcome='won' then 'Ganho' when outcome='advanced' and lead.stage in ('Identificado','Em pesquisa','Qualificado','Contato planejado') then 'Abordado' else lead.stage end;
 patch:=jsonb_build_object('commercial_outcome',outcome,'commercial_reason',coalesce(body->>'reason',''),'resume_on',case when outcome='resume' then body->>'resume_on' else '' end);
 plan:=body->'plan';
 if plan is not null and plan<>'null'::jsonb then
  if jsonb_typeof(plan)<>'object' or exists(select 1 from jsonb_object_keys(plan) k where k not in ('next_action_id','next','next_details','owner_id','due')) or exists(select 1 from jsonb_each(plan) e where jsonb_typeof(e.value)<>'string')
  or nullif(btrim(plan->>'next'),'') is null or nullif(plan->>'next_action_id','') is null or nullif(plan->>'owner_id','') is null or nullif(plan->>'due','') is null then raise exception 'Acompanhamento exige ação, responsável e prazo' using errcode='22023';end if;
  if outcome in ('lost','won') then raise exception 'Não programe abordagem em uma oportunidade encerrada' using errcode='22023';end if;
  if outcome='resume' and plan->>'due'<>body->>'resume_on' then raise exception 'O acompanhamento deve usar a data de retomada' using errcode='22023';end if;
  patch:=patch||plan;
 elsif outcome='resume' then raise exception 'Retomada exige acompanhamento com responsável e prazo' using errcode='22023';
 end if;
 if outcome in ('lost','won') then patch:=patch||jsonb_build_object('next_action_id','','next','','due','');end if;
 update public.hub_leads set stage=target,profile=profile||patch where workspace_id=w and id=l returning * into lead;
 if plan is not null and plan<>'null'::jsonb then
  delete from hub_private.commercial_followups p where p.workspace_id=w and p.lead_id=l and exists(select 1 from public.hub_activities a where a.workspace_id=w and a.id=p.activity_id and a.status in ('Concluída','Cancelada'));
 end if;
 if plan is not null and plan<>'null'::jsonb or outcome in ('lost','won') then activity:=hub_private.sync_commercial_followup(w,l,m);end if;
 answer:=jsonb_build_object('status','saved','current',to_jsonb(lead),'interaction_id',interaction,'activity_id',activity,'meeting_id',m);
 insert into hub_private.command_receipts values(w,operation_id,auth.uid(),'commercial_interaction',payload,answer);return answer;
end $$;
revoke all on function hub_private.sync_commercial_followup(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.hub_save_commercial_lead(uuid,uuid,bigint,uuid,jsonb),public.hub_record_commercial_interaction(uuid,uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.hub_save_commercial_lead(uuid,uuid,bigint,uuid,jsonb),public.hub_record_commercial_interaction(uuid,uuid,bigint,uuid,jsonb) to authenticated;
create or replace function public.hub_save_commercial_triage(p_workspace uuid,p_lead uuid,p_record jsonb,p_scores smallint[],p_completed boolean,p_profile jsonb,p_name text,p_segment text,p_city text,p_qualify boolean,expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_lead public.hub_leads;current_triage public.hub_triages;
begin
 if not public.hub_can(p_workspace,'commercial',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if jsonb_typeof(p_record) is distinct from 'object' or jsonb_typeof(p_profile) is distinct from 'object' or length(p_record::text)>40000 or nullif(btrim(p_name),'') is null or length(p_name)>300 or exists(select 1 from jsonb_each(p_profile)e where e.key not in('region','address','instagram','website','whatsapp','other','services','owner','next','due','contact','contactInfo','origin','verification','noDueReason','needs','segment_id','origin_id','origin_other','owner_id','next_action_id','next_details','postal_code','uf','municipality_id','municipality_mode','district','street','number','complement','location_url','phone_kind','phone_normalized','verification_code','verification_criteria','verification_note') or e.key<>'services' and jsonb_typeof(e.value)<>'string' or e.key='services' and jsonb_typeof(e.value)<>'array') then raise exception 'Dados de triagem inválidos' using errcode='22023';end if;
 select * into current_lead from public.hub_leads where workspace_id=p_workspace and id=p_lead for update;
 if not found then raise exception 'Registro indisponível' using errcode='42501';end if;
 if expected_revision is distinct from current_lead.revision then
  select * into current_triage from public.hub_triages where workspace_id=p_workspace and lead_id=p_lead;
  return jsonb_build_object('status','conflict','current',to_jsonb(current_lead),'triage',to_jsonb(current_triage));end if;
 perform public.hub_save_triage(p_workspace,p_lead,p_record,p_scores,p_completed,p_profile,p_name,p_segment,p_city,p_qualify);
 perform hub_private.sync_commercial_followup(p_workspace,p_lead);
 select * into current_lead from public.hub_leads where workspace_id=p_workspace and id=p_lead;
 select * into current_triage from public.hub_triages where workspace_id=p_workspace and lead_id=p_lead;
 return jsonb_build_object('status','saved','current',to_jsonb(current_lead),'triage',to_jsonb(current_triage));
end $$;
create or replace function public.hub_crm_export(w uuid,q text default '',s text default '',o text default '',p text default '',sort_by text default 'Recentes')
returns text language plpgsql stable security definer set search_path='' as $$
declare content text;
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if sort_by not in ('Recentes','Nome','Prazo') or length(coalesce(q,''))>300 then raise exception 'Recorte inválido' using errcode='22023'; end if;
 select string_agg(hub_private.csv_cell(name)||';'||hub_private.csv_cell(segment)||';'||hub_private.csv_cell(city)||';'||hub_private.csv_cell(stage)||';'||hub_private.csv_cell(profile->>'owner')||';'||hub_private.csv_cell(profile->>'next')||';'||hub_private.csv_cell(profile->>'due')||';'||hub_private.csv_cell(profile->>'segment_id')||';'||hub_private.csv_cell(profile->>'origin_id')||';'||hub_private.csv_cell(profile->>'owner_id')||';'||hub_private.csv_cell(profile->>'municipality_id')||';'||hub_private.csv_cell(profile->>'uf')||';'||hub_private.csv_cell(profile->>'postal_code')||';'||hub_private.csv_cell(profile->>'origin_other')||';'||hub_private.csv_cell(profile->>'commercial_outcome')||';'||hub_private.csv_cell(profile->>'commercial_reason')||';'||hub_private.csv_cell(profile->>'resume_on'),E'\r\n' order by case when sort_by='Nome' then name end collate "C",case when sort_by='Prazo' then nullif(profile->>'due','') end nulls last,case when sort_by='Recentes' then created_at end desc,id) into content
 from hub_private.crm_filter(w,q,s,o,p);
 return '"Nome da empresa";"Segmento";"Cidade";"Etapa";"Responsável";"Próxima ação";"Prazo";"segment_id";"origin_id";"owner_id";"municipality_id";"UF";"CEP";"Outra origem";"Resultado comercial";"Motivo comercial";"Retomada"'||E'\r\n'||coalesce(content,'');
end $$;
notify pgrst,'reload schema';
commit;
