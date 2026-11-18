begin;
create table public.hub_contracts(
 workspace_id uuid not null references public.hub_workspaces(id),id uuid not null,
 lead_id uuid not null,proposal_id uuid,proposal_version integer,project_ids uuid[] not null default '{}',
 title text not null check(btrim(title)<>''),owner text not null,owner_id uuid,
 status text not null check(status in ('Rascunho','Vigente','Encerrado','Cancelado')),
 starts_on date not null,ends_on date,renews_on date,notice_days integer not null default 30 check(notice_days between 0 and 365),
 cancel_notice_days integer not null default 30 check(cancel_notice_days between 0 and 365),
 revision bigint not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(workspace_id,id),foreign key(workspace_id,lead_id) references public.hub_leads(workspace_id,id),
 check(ends_on is null or ends_on>=starts_on),check(renews_on is null or renews_on>=starts_on)
);
create index hub_contracts_dates on public.hub_contracts(workspace_id,status,ends_on,renews_on);
create table hub_private.contract_values(workspace_id uuid not null,id uuid not null,amount numeric(12,2) not null check(amount>=0),monthly numeric(12,2) not null check(monthly>=0),conditions text not null,source_snapshot jsonb,
 primary key(workspace_id,id),foreign key(workspace_id,id) references public.hub_contracts(workspace_id,id));
create table hub_private.registry_commands(workspace_id uuid not null,operation_id uuid not null,actor_id uuid not null,payload jsonb not null,result jsonb not null,primary key(workspace_id,operation_id));
revoke all on hub_private.contract_values,hub_private.registry_commands from public,anon,authenticated;
alter table public.hub_contracts enable row level security;
revoke all on public.hub_contracts from public,anon,authenticated;
grant select on public.hub_contracts to authenticated;
create policy contract_read on public.hub_contracts for select to authenticated using(public.hub_can(workspace_id,'commercial'));
create table public.hub_registry_events(
 id bigint generated always as identity primary key,workspace_id uuid not null,kind text not null,record_id uuid not null,lead_id uuid,project_id uuid,contract_id uuid,
 actor_id uuid,occurred_at timestamptz not null default clock_timestamp(),action text not null,financial boolean not null default false,
 before_record jsonb,after_record jsonb,revision bigint
);
create index hub_registry_events_record on public.hub_registry_events(workspace_id,kind,record_id,id desc);
create index hub_registry_events_actor on public.hub_registry_events(workspace_id,actor_id,id desc);
alter table public.hub_registry_events enable row level security;
revoke all on public.hub_registry_events from public,anon,authenticated;
grant select on public.hub_registry_events to authenticated;
create policy registry_read on public.hub_registry_events for select to authenticated using(public.hub_can(workspace_id,case when financial then 'finance' else 'commercial' end));

create function hub_private.registry_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb; k text; rid uuid; l uuid; p uuid; c uuid; fin boolean:=false;
begin
 a:=to_jsonb(new);if TG_OP='UPDATE' then b:=to_jsonb(old);if a=b then return new;end if;end if;
 case TG_TABLE_NAME
 when 'hub_contracts' then k:='contract';rid:=new.id;l:=new.lead_id;c:=new.id;
 when 'contract_values' then k:='contract';rid:=new.id;c:=new.id;fin:=true;select lead_id into l from public.hub_contracts where workspace_id=new.workspace_id and id=new.id;
 when 'hub_projects' then k:='project';rid:=new.proposal_id;l:=new.lead_id;p:=rid;a:=a-'approved';b:=b-'approved';
 when 'hub_meetings' then k:='meeting';rid:=new.id;l:=new.lead_id;
 when 'hub_expenses' then k:='expense';rid:=new.id;fin:=true;
 else raise exception 'Fonte não suportada';end case;
 insert into public.hub_registry_events(workspace_id,kind,record_id,lead_id,project_id,contract_id,actor_id,action,financial,before_record,after_record,revision)
 values((a->>'workspace_id')::uuid,k,rid,l,p,c,auth.uid(),case when TG_OP='INSERT' then 'Cadastro registrado' else 'Alteração confirmada' end,fin,b,a,(a->>'revision')::bigint);
 return new;
end $$;
revoke all on function hub_private.registry_audit() from public,anon,authenticated;
create trigger hub_contract_audit after insert or update on public.hub_contracts for each row execute function hub_private.registry_audit();
create trigger hub_contract_values_audit after insert or update on hub_private.contract_values for each row execute function hub_private.registry_audit();
create trigger hub_project_registry after insert or update on public.hub_projects for each row execute function hub_private.registry_audit();
create trigger hub_meeting_registry after insert or update on public.hub_meetings for each row execute function hub_private.registry_audit();
create trigger hub_expense_registry after insert or update on public.hub_expenses for each row execute function hub_private.registry_audit();
create function public.hub_contract_detail(w uuid,c uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 select to_jsonb(t) into result from public.hub_contracts t where workspace_id=w and id=c;
 if result is null then raise exception 'Contrato indisponível' using errcode='42501';end if;
 if public.hub_can(w,'finance') then result:=result||jsonb_build_object('financial',(select to_jsonb(v)-'workspace_id'-'id' from hub_private.contract_values v where workspace_id=w and id=c));end if;
 return result;
end $$;
create function public.hub_save_contract(w uuid,c uuid,expected_revision bigint,operation_id uuid,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare oldrow public.hub_contracts; saved public.hub_contracts; cmd hub_private.registry_commands; payload jsonb; answer jsonb; src public.hub_proposals; projects uuid[]; person uuid;
begin
 if not public.hub_can(w,'admin',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if c is null or operation_id is null or jsonb_typeof(body) is distinct from 'object' or length(body::text)>50000 or nullif(btrim(body->>'title'),'') is null or nullif(btrim(body->>'owner'),'') is null or nullif(btrim(body->>'confirmation'),'') is null then raise exception 'Informe título, responsável e confirmação da alteração' using errcode='22023';end if;
 if (body->>'amount')::numeric<>round((body->>'amount')::numeric,2) or (body->>'monthly')::numeric<>round((body->>'monthly')::numeric,2) then raise exception 'Valores devem ter até dois decimais' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(body) k where k not in ('lead_id','proposal_id','project_ids','title','owner','owner_id','status','starts_on','ends_on','renews_on','notice_days','cancel_notice_days','amount','monthly','conditions','confirmation')) then raise exception 'Campo inválido' using errcode='22023';end if;
 payload:=jsonb_build_object('contract',c,'revision',expected_revision,'body',body);perform pg_advisory_xact_lock(hashtextextended(w::text||operation_id::text,0));
 select * into cmd from hub_private.registry_commands r where r.workspace_id=w and r.operation_id=hub_save_contract.operation_id;
 if found then if cmd.actor_id<>auth.uid() or cmd.payload<>payload then raise exception 'Operação já utilizada' using errcode='22023';end if;return cmd.result;end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||'contract'||c::text,0));
 select * into oldrow from public.hub_contracts where workspace_id=w and id=c for update;
 if found and expected_revision is distinct from oldrow.revision then return jsonb_build_object('status','conflict','current',public.hub_contract_detail(w,c));end if;
 if not found and expected_revision is not null then raise exception 'Contrato indisponível' using errcode='42501';end if;
 if not exists(select 1 from public.hub_leads where workspace_id=w and id=(body->>'lead_id')::uuid) then raise exception 'Estabelecimento indisponível' using errcode='42501';end if;
 if oldrow.id is not null and (oldrow.lead_id<>(body->>'lead_id')::uuid or oldrow.proposal_id is distinct from nullif(body->>'proposal_id','')::uuid) then raise exception 'Origem do contrato é imutável; cadastre outro contrato' using errcode='22023';end if;
 projects:=array(select value::uuid from jsonb_array_elements_text(coalesce(body->'project_ids','[]')));
 if cardinality(projects)>50 or exists(select 1 from unnest(projects) p where not exists(select 1 from public.hub_projects x where x.workspace_id=w and x.lead_id=(body->>'lead_id')::uuid and x.proposal_id=p)) then raise exception 'Projeto fora do estabelecimento/espaço' using errcode='42501';end if;
 person:=nullif(body->>'owner_id','')::uuid;
 if person is not null and not exists(select 1 from public.hub_members where workspace_id=w and user_id=person and active) then raise exception 'Responsável indisponível' using errcode='22023';end if;
 if nullif(body->>'proposal_id','') is not null then
  select * into src from public.hub_proposals where workspace_id=w and id=(body->>'proposal_id')::uuid and lead_id=(body->>'lead_id')::uuid;
  if not found then raise exception 'Proposta indisponível' using errcode='42501';end if;
 end if;
 insert into public.hub_contracts(workspace_id,id,lead_id,proposal_id,proposal_version,project_ids,title,owner,owner_id,status,starts_on,ends_on,renews_on,notice_days,cancel_notice_days)
 values(w,c,(body->>'lead_id')::uuid,src.id,src.version,projects,btrim(body->>'title'),body->>'owner',person,body->>'status',(body->>'starts_on')::date,nullif(body->>'ends_on','')::date,nullif(body->>'renews_on','')::date,(body->>'notice_days')::integer,coalesce((body->>'cancel_notice_days')::integer,30))
 on conflict(workspace_id,id) do update set project_ids=excluded.project_ids,title=excluded.title,owner=excluded.owner,owner_id=excluded.owner_id,status=excluded.status,starts_on=excluded.starts_on,ends_on=excluded.ends_on,renews_on=excluded.renews_on,notice_days=excluded.notice_days,cancel_notice_days=excluded.cancel_notice_days,revision=hub_contracts.revision+1,updated_at=clock_timestamp() returning * into saved;
 insert into hub_private.contract_values values(w,c,(body->>'amount')::numeric,(body->>'monthly')::numeric,coalesce(body->>'conditions',''),case when src.id is not null then jsonb_build_object('id',src.id,'version',src.version,'status',src.status,'record',src.record) end)
 on conflict(workspace_id,id) do update set amount=excluded.amount,monthly=excluded.monthly,conditions=excluded.conditions;
 insert into public.hub_registry_events(workspace_id,kind,record_id,lead_id,contract_id,actor_id,action,financial,after_record,revision) values(w,'contract',c,saved.lead_id,c,auth.uid(),'Confirmação administrativa',true,jsonb_build_object('confirmation',body->>'confirmation','status',saved.status),saved.revision);
 answer:=jsonb_build_object('status','saved','current',public.hub_contract_detail(w,c));insert into hub_private.registry_commands values(w,operation_id,auth.uid(),payload,answer);return answer;
end $$;
create function public.hub_registry_people(w uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(nullif(u.raw_user_meta_data->>'full_name',''),'Integrante '||left(m.user_id::text,8)),'active',m.active)),'[]') from public.hub_members m join auth.users u on u.id=m.user_id where m.workspace_id=w);
end $$;
create function public.hub_registry_timeline(w uuid,k text default '',r uuid default null,actor uuid default null,before_id bigint default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(to_jsonb(e) order by e.id desc),'[]') from (select * from public.hub_registry_events where workspace_id=w and (not financial or public.hub_can(w,'finance')) and (k='' or kind=k) and (r is null or record_id=r or project_id=r or contract_id=r) and (actor is null or actor_id=actor) and (before_id is null or id<before_id) order by id desc limit 50)e);
end $$;
create table public.hub_private_documents(
 workspace_id uuid not null,id uuid not null,kind text not null check(kind='contract'),record_id uuid not null,object_path text not null unique,label text not null,
 uploaded_by uuid not null default auth.uid(),uploaded_at timestamptz not null default clock_timestamp(),metadata jsonb not null,
 primary key(workspace_id,id)
);
alter table public.hub_private_documents enable row level security;revoke all on public.hub_private_documents from public,anon,authenticated;grant select on public.hub_private_documents to authenticated;
create policy document_read on public.hub_private_documents for select to authenticated using(public.hub_can(workspace_id,'finance'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('hub-private-documents','hub-private-documents',false,10485760,array['application/pdf']);
create function hub_private.document_access(path text,writing boolean) returns boolean language plpgsql stable security definer set search_path='' as $$
declare parts text[]; w uuid; rid uuid;begin
 parts:=string_to_array(path,'/');if cardinality(parts)<>4 or path !~ '^[0-9a-f-]{36}/contract/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' then return false;end if;
 begin w:=parts[1]::uuid;rid:=parts[3]::uuid;exception when invalid_text_representation then return false;end;
 if writing then return public.hub_can(w,'admin',true) and exists(select 1 from public.hub_contracts where workspace_id=w and id=rid);end if;
 return public.hub_can(w,'finance') and exists(select 1 from public.hub_private_documents where workspace_id=w and object_path=path);
end $$;
revoke all on function hub_private.document_access(text,boolean) from public,anon;grant execute on function hub_private.document_access(text,boolean) to authenticated;
create policy hub_document_upload on storage.objects for insert to authenticated with check(bucket_id='hub-private-documents' and hub_private.document_access(name,true));
create policy hub_document_download on storage.objects for select to authenticated using(bucket_id='hub-private-documents' and hub_private.document_access(name,false));
create function public.hub_attach_document(w uuid,d uuid,k text,r uuid,path text,label text) returns uuid language plpgsql security definer set search_path='' as $$
declare meta jsonb;existing public.hub_private_documents;begin
 if k<>'contract' or not public.hub_can(w,'admin',true) or not hub_private.document_access(path,true) or split_part(path,'/',1)<>w::text or split_part(path,'/',3)<>r::text or split_part(path,'/',4)<>d::text||'.pdf' or nullif(btrim(label),'') is null then raise exception 'Acesso negado' using errcode='42501';end if;
 select * into existing from public.hub_private_documents where workspace_id=w and id=d;
 if found then if existing.object_path<>path or existing.record_id<>r or existing.label<>label then raise exception 'Anexo imutável' using errcode='22023';end if;return d;end if;
 select metadata into meta from storage.objects where bucket_id='hub-private-documents' and name=path;
 if not found then raise exception 'Envie o PDF antes de registrar o anexo' using errcode='22023';end if;
 insert into public.hub_private_documents values(w,d,k,r,path,btrim(label),auth.uid(),clock_timestamp(),meta);
 insert into public.hub_registry_events(workspace_id,kind,record_id,contract_id,actor_id,action,financial,after_record) values(w,'contract',r,r,auth.uid(),'Documento assinado anexado (informado)',true,jsonb_build_object('document_id',d,'label',btrim(label)));
 return d;
end $$;
create function public.hub_due_overview(w uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'America/Fortaleza')::date;begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 return jsonb_build_object('contracts',(select coalesce(jsonb_agg(to_jsonb(c) order by coalesce(renews_on,ends_on),id),'[]') from public.hub_contracts c where workspace_id=w and status='Vigente' and (ends_on-cancel_notice_days<=today+30 or renews_on-notice_days<=today+30)),'today',today);
end $$;
revoke all on function public.hub_contract_detail(uuid,uuid),public.hub_save_contract(uuid,uuid,bigint,uuid,jsonb),public.hub_registry_people(uuid),public.hub_registry_timeline(uuid,text,uuid,uuid,bigint),public.hub_attach_document(uuid,uuid,text,uuid,text,text),public.hub_due_overview(uuid) from public,anon;
grant execute on function public.hub_contract_detail(uuid,uuid),public.hub_save_contract(uuid,uuid,bigint,uuid,jsonb),public.hub_registry_people(uuid),public.hub_registry_timeline(uuid,text,uuid,uuid,bigint),public.hub_attach_document(uuid,uuid,text,uuid,text,text),public.hub_due_overview(uuid) to authenticated;
commit;
