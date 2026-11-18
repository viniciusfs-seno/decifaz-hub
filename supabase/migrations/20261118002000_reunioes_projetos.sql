begin;
alter table public.hub_meetings add column project_id uuid,add column contract_id uuid,add column revision bigint not null default 0;
alter table public.hub_meetings add foreign key(workspace_id,project_id) references public.hub_projects(workspace_id,proposal_id),add foreign key(workspace_id,contract_id) references public.hub_contracts(workspace_id,id);
create function hub_private.linked_meeting_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if old.project_id is not null and current_user='authenticated' then raise exception 'Use a gravação com revisão para reunião de projeto' using errcode='42501';end if;
  new.revision:=old.revision+1;
 end if;
 if new.project_id is not null and not exists(select 1 from public.hub_projects where workspace_id=new.workspace_id and proposal_id=new.project_id and lead_id=new.lead_id) then raise exception 'Projeto fora do estabelecimento' using errcode='42501';end if;
 if new.contract_id is not null and not exists(select 1 from public.hub_contracts where workspace_id=new.workspace_id and id=new.contract_id and lead_id=new.lead_id) then raise exception 'Contrato fora do estabelecimento' using errcode='42501';end if;
 return new;
end $$;
revoke all on function hub_private.linked_meeting_guard() from public,anon,authenticated;
create trigger linked_meeting_guard before insert or update on public.hub_meetings for each row execute function hub_private.linked_meeting_guard();
create index meetings_project on public.hub_meetings(workspace_id,project_id,meeting_on,id);
create function public.hub_save_project_meeting(w uuid,p uuid,m uuid,expected_revision bigint,operation_id uuid,body jsonb,follow boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare pr public.hub_projects;oldrow public.hub_meetings;row public.hub_meetings;cmd hub_private.registry_commands;payload jsonb;answer jsonb;c uuid;rec jsonb;begin
 if not public.hub_can(w,'projects',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if p is null or m is null or operation_id is null or jsonb_typeof(body) is distinct from 'object' or length(body::text)>50000 then raise exception 'Dados inválidos' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(body) k where k not in ('date','state','contract_id','participants','agenda','summary','decisions','owner','next','due','callUrl')) then raise exception 'Campo inválido' using errcode='22023';end if;
 if nullif(btrim(body->>'participants'),'') is null or nullif(btrim(body->>'owner'),'') is null or body->>'state' not in ('Agendada','Realizada','Cancelada') or nullif(body->>'date','') is null or (body->>'state'='Realizada' and nullif(btrim(body->>'summary'),'') is null) then raise exception 'Informe participantes, responsável, data, situação e ata quando realizada' using errcode='22023';end if;
 if coalesce(body->>'callUrl','')<>'' and (body->>'callUrl' !~ '^https://[^ /]+' or body->>'callUrl' ~ '^https://[^/]*@') then raise exception 'Chamada exige HTTPS sem credenciais' using errcode='22023';end if;
 if follow and (body->>'state'='Cancelada' or nullif(btrim(body->>'next'),'') is null or nullif(body->>'due','') is null) then raise exception 'Atividade exige ação e prazo; reunião cancelada não cria acompanhamento' using errcode='22023';end if;
 select * into pr from public.hub_projects where workspace_id=w and proposal_id=p;if not found then raise exception 'Projeto indisponível' using errcode='42501';end if;
 c:=nullif(body->>'contract_id','')::uuid;if c is not null and not exists(select 1 from public.hub_contracts where workspace_id=w and id=c and lead_id=pr.lead_id) then raise exception 'Contrato indisponível' using errcode='42501';end if;
 payload:=jsonb_build_object('project',p,'meeting',m,'revision',expected_revision,'body',body,'follow',follow);perform pg_advisory_xact_lock(hashtextextended(w::text||operation_id::text,0));
 select * into cmd from hub_private.registry_commands r where r.workspace_id=w and r.operation_id=hub_save_project_meeting.operation_id;
 if found then if cmd.actor_id<>auth.uid() or cmd.payload<>payload then raise exception 'Operação já usada' using errcode='22023';end if;return cmd.result;end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||'meeting'||m::text,0));
 select * into oldrow from public.hub_meetings where workspace_id=w and id=m for update;
 if found and (oldrow.lead_id<>pr.lead_id or oldrow.project_id is not null and oldrow.project_id<>p) then raise exception 'Origem indisponível' using errcode='42501';end if;
 if oldrow.id is not null and oldrow.revision is distinct from expected_revision then return jsonb_build_object('status','conflict','current',to_jsonb(oldrow));end if;
 if oldrow.id is null and expected_revision is not null then raise exception 'Reunião indisponível' using errcode='42501';end if;
 rec:=coalesce(oldrow.record,'{"answers":{},"checked":[],"tools":"","objections":"","budget":""}'::jsonb)||(body-'date'-'state'-'contract_id');
 insert into public.hub_meetings(workspace_id,lead_id,id,meeting_on,state,record,project_id,contract_id) values(w,pr.lead_id,m,(body->>'date')::date,body->>'state',rec,p,c)
 on conflict(workspace_id,lead_id,id) do update set meeting_on=excluded.meeting_on,state=excluded.state,record=excluded.record,project_id=excluded.project_id,contract_id=excluded.contract_id returning * into row;
 if follow then
  if exists(select 1 from public.hub_activities where workspace_id=w and lead_id=pr.lead_id and meeting_id=m and status not in ('Pendente','Em andamento')) then raise exception 'Acompanhamento anterior já encerrado; crie outra atividade na ficha' using errcode='22023';end if;
  insert into public.hub_activities(workspace_id,lead_id,meeting_id,project_proposal_id,title,owner,due_on) values(w,pr.lead_id,m,p,body->>'next',body->>'owner',(body->>'due')::date)
  on conflict(workspace_id,lead_id,meeting_id) do update set title=excluded.title,owner=excluded.owner,due_on=excluded.due_on,project_proposal_id=excluded.project_proposal_id;
 end if;
 answer:=jsonb_build_object('status','saved','current',to_jsonb(row));insert into hub_private.registry_commands values(w,operation_id,auth.uid(),payload,answer);return answer;
end $$;
revoke all on function public.hub_save_project_meeting(uuid,uuid,uuid,bigint,uuid,jsonb,boolean) from public,anon;
grant execute on function public.hub_save_project_meeting(uuid,uuid,uuid,bigint,uuid,jsonb,boolean) to authenticated;
-- Add links without exposing the proposal's protected snapshot in project events.
create or replace function hub_private.registry_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb;a jsonb;k text;rid uuid;l uuid;p uuid;c uuid;fin boolean:=false;begin
 a:=to_jsonb(new);if TG_OP='UPDATE' then b:=to_jsonb(old);if a=b then return new;end if;end if;
 case TG_TABLE_NAME
 when 'hub_contracts' then k:='contract';rid:=new.id;l:=new.lead_id;c:=new.id;
 when 'contract_values' then k:='contract';rid:=new.id;c:=new.id;fin:=true;select lead_id into l from public.hub_contracts where workspace_id=new.workspace_id and id=new.id;
 when 'hub_projects' then k:='project';rid:=new.proposal_id;l:=new.lead_id;p:=rid;a:=a-'approved';b:=b-'approved';
 when 'hub_meetings' then k:='meeting';rid:=new.id;l:=new.lead_id;p:=new.project_id;c:=new.contract_id;
 when 'hub_expenses' then k:='expense';rid:=new.id;fin:=true;
 else raise exception 'Fonte não suportada';end case;
 insert into public.hub_registry_events(workspace_id,kind,record_id,lead_id,project_id,contract_id,actor_id,action,financial,before_record,after_record,revision)
 values((a->>'workspace_id')::uuid,k,rid,l,p,c,auth.uid(),case when TG_OP='INSERT' then 'Cadastro registrado' else 'Alteração confirmada' end,fin,b,a,(a->>'revision')::bigint);return new;
end $$;
commit;
