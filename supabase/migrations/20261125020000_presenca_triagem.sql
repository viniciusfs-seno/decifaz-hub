begin;
create function hub_private.validate_digital_presence() returns trigger language plpgsql security definer set search_path='' as $$
declare key text;value jsonb;clean jsonb;before_value jsonb;result jsonb:='{}';
begin
 if not(new.record?'digital') then return new;end if;
 if jsonb_typeof(new.record->'digital')<>'object' or length(new.record::text)>40000 then raise exception 'Presença digital inválida' using errcode='22023';end if;
 for key,value in select * from jsonb_each(new.record->'digital') loop
  if key not in('site','instagram','whatsapp','catalog','scheduling','ecommerce','ordering','booking','crm','whatsapp_automation','other') or jsonb_typeof(value)<>'object' then raise exception 'Recurso digital desconhecido' using errcode='22023';end if;
  clean:=value-'checked_by'-'checked_at';
  if jsonb_typeof(clean->'url') is distinct from 'string' or jsonb_typeof(clean->'evidence') is distinct from 'string' or jsonb_typeof(clean->'observation') is distinct from 'string' or exists(select 1 from jsonb_each(clean)e where e.key in('presence','source','subtype','label') and jsonb_typeof(e.value)<>'string') then raise exception 'Campos da avaliação devem ser textos' using errcode='22023';end if;
  if exists(select 1 from jsonb_object_keys(clean)k where k not in('presence','quality','url','evidence','observation','source','subtype','label')) or clean->>'presence' is null or clean->>'presence' not in('unchecked','not_found','identified') or clean->>'source' is null or clean->>'source' not in('observed','reported','hypothesis') then raise exception 'Informe presença e origem da informação' using errcode='22023';end if;
  if clean->>'presence'<>'identified' and clean->>'quality' is not null or clean->>'presence'='identified' and (clean->>'quality' is null or clean->>'quality' not in('unassessed','good','regular','poor')) then raise exception 'Qualidade somente se aplica ao recurso identificado' using errcode='22023';end if;
  if clean->>'source'='hypothesis' and coalesce(clean->>'quality','unassessed')<>'unassessed' then raise exception 'Hipótese não confirma qualidade' using errcode='22023';end if;
  if coalesce(clean->>'url','')<>'' and (clean->>'url'!~* '^https?://[^ /]+\.[^ /]+' or clean->>'url'~'^https?://[^/]*@') then raise exception 'URL inválida; não inclua credenciais' using errcode='22023';end if;
  if clean->>'presence'<>'unchecked' and nullif(btrim(clean->>'url'),'') is null and nullif(btrim(clean->>'evidence'),'') is null then raise exception 'Registre a URL ou evidência da pesquisa' using errcode='22023';end if;
  if clean->>'quality' in('regular','poor') and nullif(btrim(clean->>'observation'),'') is null then raise exception 'Descreva a limitação observada ou relatada' using errcode='22023';end if;
  if key='other' and nullif(btrim(clean->>'label'),'') is null then raise exception 'Especifique a outra solução digital' using errcode='22023';end if;
  if key='catalog' and coalesce(clean->>'subtype','') not in('','menu','products','services','tours','portfolio') then raise exception 'Subtipo de catálogo inválido' using errcode='22023';end if;
  before_value:=case when tg_op='UPDATE' then old.record->'digital'->key end;
  if clean is distinct from before_value-'checked_by'-'checked_at' then clean:=clean||jsonb_build_object('checked_by',auth.uid(),'checked_at',clock_timestamp());else clean:=before_value;end if;
  result:=result||jsonb_build_object(key,clean);
 end loop;
 new.record:=jsonb_set(new.record,'{digital}',result);return new;
end $$;
create trigger hub_triage_digital_validate before insert or update on public.hub_triages for each row execute function hub_private.validate_digital_presence();
create table public.hub_triage_audit(id bigint generated always as identity primary key,workspace_id uuid not null references public.hub_workspaces(id) on delete cascade,lead_id uuid not null,actor_id uuid,occurred_at timestamptz not null default clock_timestamp(),before_record jsonb,after_record jsonb not null);
alter table public.hub_triage_audit enable row level security;
revoke all on public.hub_triage_audit from public,anon,authenticated;grant select on public.hub_triage_audit to authenticated;
create policy triage_history_read on public.hub_triage_audit for select to authenticated using(public.hub_can(workspace_id,'commercial'));
create index hub_triage_audit_page on public.hub_triage_audit(workspace_id,lead_id,id desc);
create function hub_private.audit_commercial_triage() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='INSERT' or new.record is distinct from old.record or new.scores is distinct from old.scores or new.completed is distinct from old.completed then
 insert into public.hub_triage_audit(workspace_id,lead_id,actor_id,before_record,after_record) values(new.workspace_id,new.lead_id,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));end if;return new;end $$;
create trigger hub_commercial_triage_audit after insert or update on public.hub_triages for each row execute function hub_private.audit_commercial_triage();
create function public.hub_save_commercial_triage(p_workspace uuid,p_lead uuid,p_record jsonb,p_scores smallint[],p_completed boolean,p_profile jsonb,p_name text,p_segment text,p_city text,p_qualify boolean,expected_revision bigint)
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
 select * into current_lead from public.hub_leads where workspace_id=p_workspace and id=p_lead;
 select * into current_triage from public.hub_triages where workspace_id=p_workspace and lead_id=p_lead;
 return jsonb_build_object('status','saved','current',to_jsonb(current_lead),'triage',to_jsonb(current_triage));
end $$;
revoke all on function hub_private.validate_digital_presence() from public,anon,authenticated;
revoke all on function hub_private.audit_commercial_triage() from public,anon,authenticated;
revoke all on function public.hub_save_commercial_triage(uuid,uuid,jsonb,smallint[],boolean,jsonb,text,text,text,boolean,bigint) from public,anon;
grant execute on function public.hub_save_commercial_triage(uuid,uuid,jsonb,smallint[],boolean,jsonb,text,text,text,boolean,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
