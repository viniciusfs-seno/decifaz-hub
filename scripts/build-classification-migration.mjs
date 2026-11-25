import fs from 'node:fs'
import {initialClassifications} from '../src/commercial-classifications.ts'
const municipalities=fs.readFileSync('public/referencias/municipios-ibge.json','utf8'),escape=s=>s.replaceAll("'","''")
const values=initialClassifications.map(c=>`('${c.kind}','${c.id}','${escape(c.label)}',${c.parent_id?"'"+c.parent_id+"'":'null'})`).join(',\n')
let sql=`begin;
create table public.hub_municipalities(id text primary key check(id~'^\\d{7}$'),name text not null,uf text not null check(uf~'^[A-Z]{2}$'));
alter table public.hub_municipalities enable row level security;
revoke all on public.hub_municipalities from public,anon,authenticated; grant select on public.hub_municipalities to authenticated;
create policy official_reference on public.hub_municipalities for select to authenticated using(true);
-- IBGE official snapshot; source, date and digest in public/referencias/municipios-ibge.meta.json.
insert into public.hub_municipalities select id,name,uf from jsonb_to_recordset($ibge$${municipalities}$ibge$::jsonb) as x(id text,name text,uf text);
create table public.hub_commercial_classifications(
 workspace_id uuid not null references public.hub_workspaces(id) on delete cascade,kind text not null check(kind in('segment','origin','action')),id text not null check(id~'^[a-z0-9][a-z0-9:_-]{0,79}$'),label text not null check(length(btrim(label)) between 1 and 150),parent_id text,active boolean not null default true,revision bigint not null default 0,updated_by uuid,updated_at timestamptz not null default now(),primary key(workspace_id,kind,id),foreign key(workspace_id,kind,parent_id) references public.hub_commercial_classifications(workspace_id,kind,id),check(parent_id is null or kind='segment' and parent_id<>id)
);
create table public.hub_commercial_classification_audit(id bigint generated always as identity primary key,workspace_id uuid not null references public.hub_workspaces(id) on delete cascade,kind text not null,classification_id text not null,actor_id uuid not null,occurred_at timestamptz not null default clock_timestamp(),before_record jsonb,after_record jsonb not null);
alter table public.hub_commercial_classifications enable row level security;alter table public.hub_commercial_classification_audit enable row level security;
revoke all on public.hub_commercial_classifications,public.hub_commercial_classification_audit from public,anon,authenticated;
grant select on public.hub_commercial_classifications,public.hub_commercial_classification_audit to authenticated;
create policy classifications_read on public.hub_commercial_classifications for select to authenticated using(public.hub_can(workspace_id,'commercial'));
create policy classifications_audit on public.hub_commercial_classification_audit for select to authenticated using(public.hub_can(workspace_id,'admin'));
create function hub_private.seed_commercial_classifications(w uuid) returns void language sql security definer set search_path='' as $$
 insert into public.hub_commercial_classifications(workspace_id,kind,id,label,parent_id) select w,kind,id,label,parent_id from(values ${values}) as x(kind,id,label,parent_id) on conflict do nothing;
$$;
select hub_private.seed_commercial_classifications(id) from public.hub_workspaces;
create function hub_private.seed_workspace_commercial() returns trigger language plpgsql security definer set search_path='' as $$begin perform hub_private.seed_commercial_classifications(new.id);return new;end $$;
create trigger hub_workspace_commercial_defaults after insert on public.hub_workspaces for each row execute function hub_private.seed_workspace_commercial();
create function public.hub_commercial_classifications(w uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 return(select coalesce(jsonb_agg(to_jsonb(x) order by x.kind,x.label,x.id),'[]') from(select kind,id,label,parent_id,active,revision from public.hub_commercial_classifications where workspace_id=w)x);end $$;
create function public.hub_save_commercial_classification(w uuid,k text,i text,n text,parent text,enabled boolean,expected_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare actual public.hub_commercial_classifications;saved public.hub_commercial_classifications;
begin
 if not public.hub_can(w,'admin') then raise exception 'Acesso negado' using errcode='42501';end if;
 if k not in('segment','origin','action') or i is null or i!~'^[a-z0-9][a-z0-9:_-]{0,79}$' or n is null or length(btrim(n)) not between 1 and 150 or enabled is null then raise exception 'Classificação inválida' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||k||i,0));
 select * into actual from public.hub_commercial_classifications where workspace_id=w and kind=k and id=i for update;
 if found and expected_revision is distinct from actual.revision or not found and expected_revision is not null then return jsonb_build_object('status','conflict','current',to_jsonb(actual));end if;
 if parent is not null and (k<>'segment' or parent=i or not exists(select 1 from public.hub_commercial_classifications where workspace_id=w and kind=k and id=parent and parent_id is null and active)) then raise exception 'Categoria principal indisponível' using errcode='22023';end if;
 insert into public.hub_commercial_classifications(workspace_id,kind,id,label,parent_id,active,updated_by) values(w,k,i,btrim(n),parent,enabled,auth.uid()) on conflict(workspace_id,kind,id) do update set label=excluded.label,parent_id=excluded.parent_id,active=excluded.active,updated_by=auth.uid(),updated_at=clock_timestamp(),revision=public.hub_commercial_classifications.revision+1 returning * into saved;
 insert into public.hub_commercial_classification_audit(workspace_id,kind,classification_id,actor_id,before_record,after_record) values(w,k,i,auth.uid(),case when actual.id is not null then to_jsonb(actual) end,to_jsonb(saved));
 return jsonb_build_object('status','saved','current',to_jsonb(saved));end $$;
create function hub_private.validate_commercial_lead() returns trigger language plpgsql security definer set search_path='' as $$
declare previous jsonb:=case when tg_op='UPDATE' then old.profile else '{}'::jsonb end;c public.hub_commercial_classifications;key text;k text;person uuid;digits text;code text;checked text[];
begin
 for key,k in select * from(values('segment_id','segment'),('origin_id','origin'),('next_action_id','action'))x(a,b) loop
  if nullif(new.profile->>key,'') is not null then
   select * into c from public.hub_commercial_classifications where workspace_id=new.workspace_id and kind=k and id=new.profile->>key for share;
   if not found or (new.profile->>key is distinct from previous->>key and not c.active) then raise exception 'Classificação indisponível; preserve o legado ou selecione uma opção ativa' using errcode='22023';end if;
   if key='segment_id' then
    if tg_op='UPDATE' and coalesce(previous->>'segment_id','')='' and old.segment<>'' then new.profile:=new.profile||jsonb_build_object('segment_legacy',old.segment);end if;new.segment:=c.label;
   elsif key='origin_id' then
    if coalesce(previous->>'origin_id','')='' and coalesce(previous->>'origin','')<>'' then new.profile:=new.profile||jsonb_build_object('origin_legacy',previous->>'origin');end if;new.profile:=new.profile||jsonb_build_object('origin',c.label);
   end if;
  end if;
 end loop;
 if new.profile->>'origin_id'='other' and nullif(btrim(new.profile->>'origin_other'),'') is null then raise exception 'Especifique a outra origem' using errcode='22023';end if;
 person:=nullif(new.profile->>'owner_id','')::uuid;
 if person is not null and (new.profile->>'owner_id' is distinct from previous->>'owner_id') then
  perform 1 from public.hub_members where workspace_id=new.workspace_id and user_id=person and active for share;
  if not found then raise exception 'Selecione um integrante ativo deste espaço' using errcode='22023';end if;
 end if;
 if person is not null then
  new.profile:=new.profile||jsonb_build_object('owner',coalesce((select p->>'name' from jsonb_array_elements(hub_private.workspace_people(new.workspace_id))p where p->>'id'=person::text),new.profile->>'owner'));
 end if;
 if nullif(new.profile->>'municipality_id','') is not null and not exists(select 1 from public.hub_municipalities where id=new.profile->>'municipality_id' and uf=new.profile->>'uf' and name=new.city) then raise exception 'Município e UF não correspondem à referência IBGE' using errcode='22023';end if;
 if coalesce(new.profile->>'uf','')<>'' and new.profile->>'uf' not in('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then raise exception 'UF inválida' using errcode='22023';end if;
 if coalesce(new.profile->>'postal_code','')<>'' and new.profile->>'postal_code'!~'^\\d{8}$' then raise exception 'CEP deve conter oito dígitos' using errcode='22023';end if;
 if new.profile->>'phone_kind'='br' and coalesce(new.profile->>'whatsapp','')<>'' then
  digits:=regexp_replace(new.profile->>'whatsapp','\\D','','g');if length(digits) in(12,13) and left(digits,2)='55' then digits:=substr(digits,3);end if;
  if not(length(digits)=10 and substr(digits,3,1)~'^[2-5]$' or length(digits)=11 and substr(digits,3,1)='9') or left(digits,2) not in(${[...new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '))].map(x=>"'"+x+"'").join(',')}) then raise exception 'Telefone brasileiro inválido; informe DDD ou mantenha como internacional/legado' using errcode='22023';end if;
  new.profile:=new.profile||jsonb_build_object('phone_normalized','+55'||digits);
 elsif new.profile->>'phone_kind'='international' and coalesce(new.profile->>'whatsapp','')<>'' then
  digits:=regexp_replace(new.profile->>'whatsapp','[[:space:]().-]','','g');if digits!~'^\\+[1-9]\\d{7,14}$' then raise exception 'Telefone internacional exige + e código do país' using errcode='22023';end if;new.profile:=new.profile||jsonb_build_object('phone_normalized',digits);
 else new.profile:=new.profile-'phone_normalized';end if;
 code:=new.profile->>'verification_code';
 new.profile:=new.profile-'verification_by'-'verification_at';
 if code is distinct from previous->>'verification_code' or new.profile->>'verification_criteria' is distinct from previous->>'verification_criteria' or new.profile->>'verification_note' is distinct from previous->>'verification_note' then
  if coalesce(code,'')<>'' then
   if code not in('unassessed','pending','partial','checked') then raise exception 'Verificação inválida' using errcode='22023';end if;
   checked:=string_to_array(coalesce(new.profile->>'verification_criteria',''),',');
   if exists(select 1 from unnest(checked)x where x not in('identity','location','contact')) or code='partial' and cardinality(checked) not between 1 and 2 or code='checked' and (not checked @> array['identity','location','contact'] or nullif(btrim(new.profile->>'verification_note'),'') is null or new.segment='' or new.city='' or coalesce(nullif(new.profile->>'whatsapp',''),nullif(new.profile->>'website',''),nullif(new.profile->>'instagram',''),nullif(new.profile->>'contactInfo','')) is null) then raise exception 'Confira os critérios e registre a evidência da verificação' using errcode='22023';end if;
   new.profile:=new.profile||jsonb_build_object('verification_by',coalesce(auth.uid()::text,''),'verification_at',clock_timestamp()::text);
  end if;
 else
  if previous?'verification_by' then new.profile:=new.profile||jsonb_build_object('verification_by',previous->>'verification_by','verification_at',previous->>'verification_at');end if;
 end if;return new;end $$;
create trigger hub_commercial_lead_validate before insert or update on public.hub_leads for each row execute function hub_private.validate_commercial_lead();
`;
const extra=['segment_id','origin_id','origin_other','owner_id','next_action_id','next_details','postal_code','uf','municipality_id','municipality_mode','district','street','number','complement','location_url','phone_kind','phone_normalized','verification_code','verification_criteria','verification_note']
let original=fs.readFileSync('supabase/migrations/20261117010000_ficha_estabelecimento.sql','utf8').split('create function public.hub_save_lead')[1].split('revoke all on function')[0]
original='create or replace function public.hub_save_lead'+original.replace("'needs','services')", "'needs','services',"+extra.map(x=>"'"+x+"'").join(',')+")")
sql+=original+`\nrevoke all on function hub_private.seed_commercial_classifications(uuid),hub_private.seed_workspace_commercial(),hub_private.validate_commercial_lead() from public,anon,authenticated;
revoke all on function public.hub_commercial_classifications(uuid),public.hub_save_commercial_classification(uuid,text,text,text,text,boolean,bigint) from public,anon;
grant execute on function public.hub_commercial_classifications(uuid),public.hub_save_commercial_classification(uuid,text,text,text,text,boolean,bigint) to authenticated;
commit;\n`;
// Existing search and CSV share the same filter, including legacy labels and IDs.
const crm=fs.readFileSync('supabase/migrations/20261117020000_crm_paginado.sql','utf8')
let filter=crm.slice(crm.indexOf('create function hub_private.crm_filter'),crm.indexOf('create function public.hub_crm_page')).replace('create function','create or replace function').replace("l.profile->>'contact'", "l.profile->>'contact',l.profile->>'postal_code',l.profile->>'street',l.profile->>'origin',l.profile->>'origin_id',(select c.label from public.hub_commercial_classifications c where c.workspace_id=l.workspace_id and c.kind='segment' and c.id=l.profile->>'segment_id')").replace("l.profile->>'owner'=o", "l.profile->>'owner'=o or 'id:'||(l.profile->>'owner_id')=o")
let csv=crm.slice(crm.indexOf('create function public.hub_crm_export'),crm.indexOf('revoke all on function hub_private.crm_filter')).replace('create function','create or replace function').replace("hub_private.csv_cell(profile->>'due'),", "hub_private.csv_cell(profile->>'due')||';'||hub_private.csv_cell(profile->>'segment_id')||';'||hub_private.csv_cell(profile->>'origin_id')||';'||hub_private.csv_cell(profile->>'owner_id')||';'||hub_private.csv_cell(profile->>'municipality_id')||';'||hub_private.csv_cell(profile->>'uf')||';'||hub_private.csv_cell(profile->>'postal_code')||';'||hub_private.csv_cell(profile->>'origin_other'),").replace('"Nome";"Segmento"','"Nome da empresa";"Segmento"').replace('"Próxima ação";"Prazo"', '"Próxima ação";"Prazo";"segment_id";"origin_id";"owner_id";"municipality_id";"UF";"CEP";"Outra origem"')
sql=sql.replace('commit;\n',()=>filter+'\n'+csv+"\nnotify pgrst,'reload schema';\ncommit;\n")
let importer=fs.readFileSync('supabase/migrations/20261118020000_importacao_csv.sql','utf8');importer=importer.slice(importer.indexOf('create function public.hub_import_lead'),importer.indexOf('revoke all on function public.hub_import_lead')).replace('create function','create or replace function').replace("'owner','needs')", "'owner','needs','segment_id','origin_id','origin_other','owner_id','municipality_id','uf','postal_code','district','street','number','complement','phone_kind')").replace("if coalesce(body->'profile'->>'whatsapp','')<>'' and length", "if coalesce(body->'profile'->>'phone_kind','') not in('international','legacy') and coalesce(body->'profile'->>'whatsapp','')<>'' and length")
importer=importer.replace(' if cardinality(errors)>0 then',` for k in select unnest(array['segment_id','origin_id']) loop
  if coalesce(body->'profile'->>k,'')<>'' and not exists(select 1 from public.hub_commercial_classifications where workspace_id=w and kind=case k when 'segment_id' then 'segment' else 'origin' end and id=body->'profile'->>k and active) then errors:=array_append(errors,'Identificador de classificação indisponível: selecione opção ativa no espaço ou preserve texto legado.');end if;
 end loop;
 if coalesce(body->'profile'->>'owner_id','')<>'' and not exists(select 1 from public.hub_members where workspace_id=w and user_id::text=body->'profile'->>'owner_id' and active) then errors:=array_append(errors,'Responsável deve ser um identificador de integrante ativo deste espaço.');end if;
 if coalesce(body->'profile'->>'municipality_id','')<>'' and not exists(select 1 from public.hub_municipalities where id=body->'profile'->>'municipality_id' and uf=body->'profile'->>'uf' and name=body->>'city') then errors:=array_append(errors,'Confira município, código IBGE e UF.');end if;
 if body->'profile'->>'origin_id'='other' and nullif(btrim(body->'profile'->>'origin_other'),'') is null then errors:=array_append(errors,'Especifique a outra origem.');end if;
 if cardinality(errors)>0 then`)
sql=sql.replace('commit;\n',()=>importer+'\ncommit;\n')
fs.writeFileSync('supabase/migrations/20261125010000_cadastro_classificacoes.sql',sql);console.log('Migração aditiva gerada; sem conversão de registros legados.')
