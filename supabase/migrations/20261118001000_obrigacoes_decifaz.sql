begin;
create table public.hub_internal_obligations(
 workspace_id uuid not null references public.hub_workspaces(id),id uuid not null,title text not null check(btrim(title)<>''),supplier text not null,category text not null,
 owner text not null,owner_id uuid,amount numeric(12,2) not null check(amount>0),frequency integer not null check(frequency in (0,1,3,6,12)),anchor_on date not null,
 payment_method text not null default '',status text not null check(status in ('Ativa','Pausada','Cancelada')),auto_renew boolean not null default false,cancel_by date,panel_url text not null default '',
 lead_id uuid,project_id uuid,contract_id uuid,revision bigint not null default 0,created_at timestamptz not null default now(),primary key(workspace_id,id)
);
create table public.hub_internal_bills(
 workspace_id uuid not null,id uuid not null default gen_random_uuid(),obligation_id uuid not null,competency date not null,due_on date not null,amount numeric(12,2) not null check(amount>0),
 status text not null default 'Prevista' check(status in ('Prevista','Paga','Suspensa','Cancelada')),paid_on date,paid_amount numeric(12,2),revision bigint not null default 0,
 primary key(workspace_id,id),unique(workspace_id,obligation_id,competency),foreign key(workspace_id,obligation_id) references public.hub_internal_obligations(workspace_id,id),
 check((status='Paga')=(paid_on is not null and paid_amount is not null))
);
create table public.hub_internal_payments(
 workspace_id uuid not null,id uuid not null,bill_id uuid not null,paid_on date not null,amount numeric(12,2) not null check(amount>0),evidence text not null,actor_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),reversed_at timestamptz,reversal_reason text,primary key(workspace_id,id),foreign key(workspace_id,bill_id) references public.hub_internal_bills(workspace_id,id)
);
create unique index internal_payment_active on public.hub_internal_payments(workspace_id,bill_id) where reversed_at is null;
create index internal_bills_due on public.hub_internal_bills(workspace_id,status,due_on,competency,id);
do $$ declare t text;begin
 foreach t in array array['hub_internal_obligations','hub_internal_bills','hub_internal_payments'] loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
  execute format('create policy internal_finance on public.%I for select to authenticated using(public.hub_can(workspace_id,''finance''))',t);
 end loop;
end $$;
create function hub_private.internal_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb:=to_jsonb(new);b jsonb;rid uuid;c uuid;p uuid;l uuid;k text;begin
 if TG_OP='UPDATE' then b:=to_jsonb(old);if a=b then return new;end if;end if;
 if TG_TABLE_NAME='hub_internal_obligations' then rid:=new.id;k:='obligation';c:=new.contract_id;p:=new.project_id;l:=new.lead_id;
 elsif TG_TABLE_NAME='hub_internal_bills' then rid:=new.id;k:='bill';select contract_id,project_id,lead_id into c,p,l from public.hub_internal_obligations where workspace_id=new.workspace_id and id=new.obligation_id;
 else rid:=new.bill_id;k:='payment';select o.contract_id,o.project_id,o.lead_id into c,p,l from public.hub_internal_bills b join public.hub_internal_obligations o on o.workspace_id=b.workspace_id and o.id=b.obligation_id where b.workspace_id=new.workspace_id and b.id=new.bill_id;end if;
 insert into public.hub_registry_events(workspace_id,kind,record_id,contract_id,project_id,lead_id,actor_id,action,financial,before_record,after_record,revision)
 values(new.workspace_id,k,rid,c,p,l,auth.uid(),case when TG_OP='INSERT' then 'Registro financeiro criado' else 'Registro financeiro atualizado' end,true,b,a,(a->>'revision')::bigint);
 return new;
end $$;
revoke all on function hub_private.internal_audit() from public,anon,authenticated;
create trigger internal_obligation_audit after insert or update on public.hub_internal_obligations for each row execute function hub_private.internal_audit();
create trigger internal_bill_audit after insert or update on public.hub_internal_bills for each row execute function hub_private.internal_audit();
create trigger internal_payment_audit after insert or update on public.hub_internal_payments for each row execute function hub_private.internal_audit();
create function hub_private.obligation_due(anchor date,months integer) returns date language sql immutable set search_path='' as $$
 select (first_day+(least(extract(day from anchor)::integer,extract(day from first_day+interval '1 month - 1 day')::integer)-1))::date
 from (select (date_trunc('month',anchor)+make_interval(months=>months))::date first_day)x
$$;
revoke all on function hub_private.obligation_due(date,integer) from public,anon,authenticated;
create function hub_private.generate_obligation(w uuid,o uuid,through_on date) returns integer language plpgsql set search_path='' as $$
declare cfg public.hub_internal_obligations;d date;i integer:=0;generated integer:=0;begin
 select * into cfg from public.hub_internal_obligations where workspace_id=w and id=o for update;
 if not found or cfg.status<>'Ativa' then return 0;end if;
 loop
  d:=hub_private.obligation_due(cfg.anchor_on,i*cfg.frequency);exit when d>through_on;
  insert into public.hub_internal_bills(workspace_id,obligation_id,competency,due_on,amount) values(w,o,date_trunc('month',d)::date,d,cfg.amount) on conflict(workspace_id,obligation_id,competency) do nothing;
  if found then generated:=generated+1;end if;
  exit when cfg.frequency=0;i:=i+1;if i>132 then raise exception 'Geração limitada a onze anos por plano; cadastre o próximo vencimento conhecido' using errcode='22023';end if;
 end loop;return generated;
end $$;
revoke all on function hub_private.generate_obligation(uuid,uuid,date) from public,anon,authenticated;
create function public.hub_generate_internal(w uuid,through_on date) returns integer language plpgsql security definer set search_path='' as $$
declare o uuid;n integer:=0;begin
 if not public.hub_can(w,'finance',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if through_on is null or through_on>(now() at time zone 'America/Fortaleza')::date+366 then raise exception 'Use horizonte de até um ano' using errcode='22023';end if;
 for o in select id from public.hub_internal_obligations where workspace_id=w order by id loop n:=n+hub_private.generate_obligation(w,o,through_on);end loop;return n;
end $$;
create function public.hub_save_internal_obligation(w uuid,o uuid,expected_revision bigint,operation_id uuid,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare oldrow public.hub_internal_obligations;row public.hub_internal_obligations;cmd hub_private.registry_commands;payload jsonb;answer jsonb;l uuid;c uuid;p uuid;person uuid;today date:=(now() at time zone 'America/Fortaleza')::date;begin
 if not public.hub_can(w,'finance',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if o is null or operation_id is null or jsonb_typeof(body)<>'object' or length(body::text)>30000 or nullif(btrim(body->>'title'),'') is null or nullif(btrim(body->>'supplier'),'') is null or nullif(btrim(body->>'category'),'') is null or nullif(btrim(body->>'owner'),'') is null or nullif(btrim(body->>'confirmation'),'') is null or (body->>'amount')::numeric<>round((body->>'amount')::numeric,2) then raise exception 'Informe dados, valor com centavos e confirmação' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(body) k where k not in ('title','supplier','category','owner','owner_id','amount','frequency','anchor_on','payment_method','status','auto_renew','cancel_by','panel_url','lead_id','project_id','contract_id','confirmation')) then raise exception 'Campo inválido' using errcode='22023';end if;
 if (body->>'anchor_on')::date<today-3660 then raise exception 'Use o próximo vencimento conhecido, no máximo dez anos atrás' using errcode='22023';end if;
 if coalesce(body->>'panel_url','')<>'' and (body->>'panel_url' !~ '^https://[^ /]+' or body->>'panel_url' ~* '^https://[^/]*@|[?&#](token|key|secret|password)=') then raise exception 'Painel exige HTTPS sem credenciais ou token' using errcode='22023';end if;
 payload:=jsonb_build_object('o',o,'revision',expected_revision,'body',body);perform pg_advisory_xact_lock(hashtextextended(w::text||operation_id::text,0));
 select * into cmd from hub_private.registry_commands r where r.workspace_id=w and r.operation_id=hub_save_internal_obligation.operation_id;
 if found then if cmd.actor_id<>auth.uid() or cmd.payload<>payload then raise exception 'Operação já usada' using errcode='22023';end if;return cmd.result;end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||'obligation'||o::text,0));
 select * into oldrow from public.hub_internal_obligations where workspace_id=w and id=o for update;
 if found and expected_revision is distinct from oldrow.revision then return jsonb_build_object('status','conflict','current',to_jsonb(oldrow));end if;
 if oldrow.id is null and expected_revision is not null then raise exception 'Registro indisponível' using errcode='42501';end if;
 if oldrow.id is not null and (oldrow.frequency<>(body->>'frequency')::integer or oldrow.anchor_on<>(body->>'anchor_on')::date) then raise exception 'Periodicidade e vencimento base são imutáveis; crie outro plano para mudar a regra' using errcode='22023';end if;
 c:=nullif(body->>'contract_id','')::uuid;p:=nullif(body->>'project_id','')::uuid;l:=nullif(body->>'lead_id','')::uuid;person:=nullif(body->>'owner_id','')::uuid;
 if c is not null then select lead_id into l from public.hub_contracts where workspace_id=w and id=c;if not found then raise exception 'Contrato indisponível' using errcode='42501';end if;end if;
 if p is not null then if not exists(select 1 from public.hub_projects where workspace_id=w and proposal_id=p and (l is null or lead_id=l)) then raise exception 'Projeto indisponível' using errcode='42501';end if;select lead_id into l from public.hub_projects where workspace_id=w and proposal_id=p;end if;
 if l is not null and not exists(select 1 from public.hub_leads where workspace_id=w and id=l) then raise exception 'Estabelecimento indisponível' using errcode='42501';end if;
 if person is not null and not exists(select 1 from public.hub_members where workspace_id=w and user_id=person and active) then raise exception 'Responsável indisponível' using errcode='22023';end if;
 insert into public.hub_internal_obligations(workspace_id,id,title,supplier,category,owner,owner_id,amount,frequency,anchor_on,payment_method,status,auto_renew,cancel_by,panel_url,lead_id,project_id,contract_id)
 values(w,o,body->>'title',body->>'supplier',body->>'category',body->>'owner',person,(body->>'amount')::numeric,(body->>'frequency')::integer,(body->>'anchor_on')::date,coalesce(body->>'payment_method',''),body->>'status',coalesce((body->>'auto_renew')::boolean,false),nullif(body->>'cancel_by','')::date,coalesce(body->>'panel_url',''),l,p,c)
 on conflict(workspace_id,id) do update set title=excluded.title,supplier=excluded.supplier,category=excluded.category,owner=excluded.owner,owner_id=excluded.owner_id,amount=excluded.amount,payment_method=excluded.payment_method,status=excluded.status,auto_renew=excluded.auto_renew,cancel_by=excluded.cancel_by,panel_url=excluded.panel_url,lead_id=excluded.lead_id,project_id=excluded.project_id,contract_id=excluded.contract_id,revision=hub_internal_obligations.revision+1 returning * into row;
 update public.hub_internal_bills set amount=row.amount,status=case row.status when 'Ativa' then 'Prevista' when 'Pausada' then 'Suspensa' else 'Cancelada' end,revision=revision+1
 where workspace_id=w and obligation_id=o and paid_on is null and due_on>today and (amount<>row.amount or status<>case row.status when 'Ativa' then 'Prevista' when 'Pausada' then 'Suspensa' else 'Cancelada' end);
 perform hub_private.generate_obligation(w,o,today+366);
 insert into public.hub_registry_events(workspace_id,kind,record_id,actor_id,action,financial,after_record,revision) values(w,'obligation',o,auth.uid(),'Confirmação financeira',true,jsonb_build_object('confirmation',body->>'confirmation','status',row.status),row.revision);
 answer:=jsonb_build_object('status','saved','current',to_jsonb(row));insert into hub_private.registry_commands values(w,operation_id,auth.uid(),payload,answer);return answer;
end $$;
create function public.hub_pay_internal_bill(w uuid,b uuid,expected_revision bigint,operation_id uuid,paid_on date,amount numeric,evidence text) returns jsonb language plpgsql security definer set search_path='' as $$
declare bill public.hub_internal_bills;cmd hub_private.registry_commands;payload jsonb;answer jsonb;begin
 if not public.hub_can(w,'finance',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if operation_id is null or paid_on is null or paid_on>(now() at time zone 'America/Fortaleza')::date or amount is null or amount<=0 or amount<>round(amount,2) or nullif(btrim(evidence),'') is null then raise exception 'Confirme data, valor e referência do pagamento manual' using errcode='22023';end if;
 payload:=jsonb_build_object('bill',b,'revision',expected_revision,'date',paid_on,'amount',amount,'evidence',evidence);perform pg_advisory_xact_lock(hashtextextended(w::text||operation_id::text,0));
 select * into cmd from hub_private.registry_commands r where r.workspace_id=w and r.operation_id=hub_pay_internal_bill.operation_id;
 if found then if cmd.actor_id<>auth.uid() or cmd.payload<>payload then raise exception 'Operação já usada' using errcode='22023';end if;return cmd.result;end if;
 select * into bill from public.hub_internal_bills where workspace_id=w and id=b for update;if not found then raise exception 'Ocorrência indisponível' using errcode='42501';end if;
 if bill.revision is distinct from expected_revision then return jsonb_build_object('status','conflict','current',to_jsonb(bill));end if;
 if bill.status<>'Prevista' then raise exception 'Somente ocorrência prevista pode receber baixa' using errcode='22023';end if;
 insert into public.hub_internal_payments(workspace_id,id,bill_id,paid_on,amount,evidence,actor_id) values(w,operation_id,b,paid_on,amount,btrim(evidence),auth.uid());
 update public.hub_internal_bills x set status='Paga',paid_on=hub_pay_internal_bill.paid_on,paid_amount=hub_pay_internal_bill.amount,revision=x.revision+1 where x.workspace_id=w and x.id=b returning * into bill;
 answer:=jsonb_build_object('status','paid','current',to_jsonb(bill));insert into hub_private.registry_commands values(w,operation_id,auth.uid(),payload,answer);return answer;
end $$;
alter table public.hub_private_documents drop constraint hub_private_documents_kind_check;
alter table public.hub_private_documents add check(kind in ('contract','bill'));
create or replace function hub_private.document_access(path text,writing boolean) returns boolean language plpgsql stable security definer set search_path='' as $$
declare parts text[];w uuid;rid uuid;begin
 parts:=string_to_array(path,'/');if cardinality(parts)<>4 or path !~ '^[0-9a-f-]{36}/(contract|bill)/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' then return false;end if;
 begin w:=parts[1]::uuid;rid:=parts[3]::uuid;exception when invalid_text_representation then return false;end;
 if writing then return case parts[2] when 'contract' then public.hub_can(w,'admin',true) and exists(select 1 from public.hub_contracts where workspace_id=w and id=rid) else public.hub_can(w,'finance',true) and exists(select 1 from public.hub_internal_bills where workspace_id=w and id=rid) end;end if;
 return public.hub_can(w,'finance') and exists(select 1 from public.hub_private_documents where workspace_id=w and object_path=path);
end $$;
create or replace function public.hub_attach_document(w uuid,d uuid,k text,r uuid,path text,label text) returns uuid language plpgsql security definer set search_path='' as $$
declare meta jsonb;existing public.hub_private_documents;begin
 if k not in ('contract','bill') or not hub_private.document_access(path,true) or split_part(path,'/',1)<>w::text or split_part(path,'/',2)<>k or split_part(path,'/',3)<>r::text or split_part(path,'/',4)<>d::text||'.pdf' or nullif(btrim(label),'') is null then raise exception 'Acesso negado' using errcode='42501';end if;
 select * into existing from public.hub_private_documents where workspace_id=w and id=d;if found then if existing.object_path<>path or existing.label<>label then raise exception 'Anexo imutável' using errcode='22023';end if;return d;end if;
 select metadata into meta from storage.objects where bucket_id='hub-private-documents' and name=path;if not found then raise exception 'Envie o PDF antes de registrar o anexo' using errcode='22023';end if;
 insert into public.hub_private_documents values(w,d,k,r,path,btrim(label),auth.uid(),clock_timestamp(),meta);
 insert into public.hub_registry_events(workspace_id,kind,record_id,actor_id,action,financial,after_record) values(w,k,r,auth.uid(),case k when 'contract' then 'Documento assinado anexado (informado)' else 'Comprovante privado anexado' end,true,jsonb_build_object('document_id',d,'label',btrim(label)));return d;
end $$;
revoke all on function public.hub_generate_internal(uuid,date),public.hub_save_internal_obligation(uuid,uuid,bigint,uuid,jsonb),public.hub_pay_internal_bill(uuid,uuid,bigint,uuid,date,numeric,text) from public,anon;
grant execute on function public.hub_generate_internal(uuid,date),public.hub_save_internal_obligation(uuid,uuid,bigint,uuid,jsonb),public.hub_pay_internal_bill(uuid,uuid,bigint,uuid,date,numeric,text) to authenticated;
commit;
