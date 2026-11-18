begin;
create function hub_private.import_matches(w uuid,body jsonb)
returns table(id uuid,name text,city text,revision bigint) language sql stable set search_path='' as $$
 select l.id,l.name,l.city,l.revision from public.hub_leads l where l.workspace_id=w and (
  (hub_private.crm_normalize(btrim(l.name))=hub_private.crm_normalize(btrim(body->>'name')) and hub_private.crm_normalize(btrim(l.city))=hub_private.crm_normalize(btrim(body->>'city')))
  or (length(regexp_replace(coalesce(body->'profile'->>'whatsapp',''),'\D','','g'))>=10 and
      regexp_replace(coalesce(l.profile->>'whatsapp',''),'\D','','g')=regexp_replace(body->'profile'->>'whatsapp','\D','','g'))
  or (length(coalesce(body->'profile'->>'website',''))>5 and lower(regexp_replace(regexp_replace(l.profile->>'website','^https?://(www\.)?','','i'),'/$',''))=lower(regexp_replace(regexp_replace(body->'profile'->>'website','^https?://(www\.)?','','i'),'/$','')))
 ) order by l.id
$$;
revoke all on function hub_private.import_matches(uuid,jsonb) from public,anon,authenticated;
create function public.hub_import_lead(w uuid,operation_id uuid,body jsonb,initial_stage text,decision text default 'preview',target uuid default null,expected_revision bigint default null,acknowledged uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare matches jsonb; ids uuid[]; errors text[]:='{}'; k text; receipt hub_private.command_receipts; payload jsonb; answer jsonb;
begin
 if not public.hub_can(w,'commercial',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if operation_id is null or jsonb_typeof(body) is distinct from 'object' or length(body::text)>40000 then raise exception 'Linha inválida' using errcode='22023';end if;
 if initial_stage not in ('Identificado','Em pesquisa') or initial_stage is null then errors:=array_append(errors,'Escolha Identificado ou Em pesquisa; demais etapas exigem o fluxo comercial.');end if;
 if nullif(btrim(body->>'name'),'') is null then errors:=array_append(errors,'Nome obrigatório: mapeie uma coluna com o nome do estabelecimento.');end if;
 if length(body->>'name')>300 then errors:=array_append(errors,'Nome deve ter até 300 caracteres.');end if;
 if exists(select 1 from jsonb_object_keys(body) f where f not in ('name','segment','city','notes','profile')) then errors:=array_append(errors,'A linha contém campos que não podem ser importados.');end if;
 if body ? 'profile' and jsonb_typeof(body->'profile') is distinct from 'object' then errors:=array_append(errors,'Perfil inválido.');
 else
  for k in select jsonb_object_keys(coalesce(body->'profile','{}')) loop
   if k not in ('region','address','whatsapp','instagram','website','other','contact','contactInfo','origin','owner','needs') or jsonb_typeof(body->'profile'->k) is distinct from 'string' then errors:=array_append(errors,'Coluna não importável: use somente os campos do modelo.');end if;
  end loop;
  if coalesce(body->'profile'->>'whatsapp','')<>'' and length(regexp_replace(body->'profile'->>'whatsapp','\D','','g')) not in (10,11,12,13) then errors:=array_append(errors,'WhatsApp: informe DDD e número, com código 55 opcional.');end if;
  if coalesce(body->'profile'->>'website','')<>'' and body->'profile'->>'website' !~* '^https?://[^ /]+\.[^ /]+' then errors:=array_append(errors,'Site: informe URL completa iniciada em https:// ou http://.');end if;
 end if;
 if cardinality(errors)>0 then return jsonb_build_object('status','invalid','errors',errors,'matches','[]'::jsonb);end if;
 payload:=jsonb_build_object('body',body,'stage',initial_stage,'decision',decision,'target',target,'revision',expected_revision,'acknowledged',acknowledged);
 -- Serializes duplicate detection against other imports in the same workspace.
 perform pg_advisory_xact_lock(hashtextextended(w::text||'csv-import',0));
 select * into receipt from hub_private.command_receipts r where r.workspace_id=w and r.operation_id=hub_import_lead.operation_id;
 if found and decision='preview' then
  if receipt.actor_id<>auth.uid() or receipt.kind<>'import' or receipt.payload->'body'<>body or receipt.payload->>'stage'<>initial_stage then raise exception 'Identificador já usado em outra operação' using errcode='22023';end if;
  return receipt.result;
 elsif found then
  if receipt.actor_id<>auth.uid() or receipt.kind<>'import' or receipt.payload<>payload then raise exception 'Operação já concluída com outra seleção' using errcode='22023';end if;
  return receipt.result;
 end if;
 select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb),coalesce(array_agg(m.id),'{}'::uuid[]) into matches,ids from hub_private.import_matches(w,body) m;
 if decision='preview' then return jsonb_build_object('status',case when cardinality(ids)>0 then 'review' else 'ready' end,'matches',matches,'errors',errors);end if;
 if decision='skip' then answer:=jsonb_build_object('status','skipped');
 elsif decision='create' then
  if not ids<@coalesce(acknowledged,'{}') then return jsonb_build_object('status','review','matches',matches,'errors','[]'::jsonb);end if;
  answer:=public.hub_save_lead(w,null,null,body);
  if initial_stage='Em pesquisa' then update public.hub_leads set stage=initial_stage where workspace_id=w and id=(answer->'current'->>'id')::uuid;end if;
  answer:=jsonb_build_object('status','created','lead_id',answer->'current'->>'id');
 elsif decision='update' then
  if target is null or not target=any(ids) then return jsonb_build_object('status','review','matches',matches,'errors','[]'::jsonb);end if;
  answer:=public.hub_save_lead(w,target,expected_revision,body);
  if answer->>'status'='conflict' then return answer;end if;
  answer:=jsonb_build_object('status','updated','lead_id',target);
 else raise exception 'Escolha criar, atualizar ou ignorar' using errcode='22023';end if;
 insert into hub_private.command_receipts values(w,operation_id,auth.uid(),'import',payload,answer);
 return answer;
end $$;
revoke all on function public.hub_import_lead(uuid,uuid,jsonb,text,text,uuid,bigint,uuid[]) from public,anon;
grant execute on function public.hub_import_lead(uuid,uuid,jsonb,text,text,uuid,bigint,uuid[]) to authenticated;
commit;
