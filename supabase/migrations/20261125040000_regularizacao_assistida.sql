begin;
create function hub_private.regularization_issues(l public.hub_leads,missing boolean default false) returns jsonb
language plpgsql immutable set search_path='' as $$
declare issues jsonb:='[]';p jsonb:=l.profile;k text;v text;
begin
 for k,v in select * from(values('segment',l.segment),('origin',p->>'origin'),('owner',p->>'owner'))x(k,v) loop
  if coalesce(p->>(case k when 'segment' then 'segment_id' when 'origin' then 'origin_id' else 'owner_id' end),'')='' and nullif(btrim(v),'') is not null then
   issues:=issues||jsonb_build_object('field',k,'state','legacy','old_value',v);
  elsif missing and coalesce(v,'')='' then issues:=issues||jsonb_build_object('field',k,'state','optional','old_value','');end if;
 end loop;
 if coalesce(l.city,'')<>'' and coalesce(p->>'municipality_id','')='' and not p?'location_checked_at' then issues:=issues||jsonb_build_object('field','location','state','legacy','old_value',concat_ws(' · ',nullif(p->>'address',''),l.city));
 elsif missing and l.city='' then issues:=issues||jsonb_build_object('field','location','state','optional','old_value',coalesce(p->>'address',''));end if;
 if coalesce(p->>'whatsapp','')<>'' and coalesce(p->>'phone_kind','legacy')='legacy' and not p?'contact_checked_at' then issues:=issues||jsonb_build_object('field','contact','state','legacy','old_value',p->>'whatsapp');
 elsif coalesce(p->>'website','')~'(^[[:space:]]|[[:space:]]|^(javascript|data|file):)' then issues:=issues||jsonb_build_object('field','contact','state','invalid','old_value',p->>'website');
 elsif missing and coalesce(nullif(p->>'whatsapp',''),nullif(p->>'website',''),nullif(p->>'instagram',''),'')='' then issues:=issues||jsonb_build_object('field','contact','state','optional','old_value','');end if;
 return issues;
end $$;
revoke all on function hub_private.regularization_issues(public.hub_leads,boolean) from public,anon,authenticated;
create table hub_private.regularization_reviews(workspace_id uuid not null references public.hub_workspaces(id) on delete cascade,lead_id uuid not null,field text not null,actor_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),fingerprint jsonb not null,primary key(workspace_id,lead_id,field));
revoke all on hub_private.regularization_reviews from public,anon,authenticated;
create function hub_private.review_fingerprint(l public.hub_leads,f text) returns jsonb language sql immutable set search_path='' as $$
 select case when f='location' then jsonb_build_object('city',l.city,'address',l.profile->>'address','uf',l.profile->>'uf','municipality',l.profile->>'municipality_id','street',l.profile->>'street','number',l.profile->>'number') else jsonb_build_object('whatsapp',l.profile->>'whatsapp','website',l.profile->>'website','instagram',l.profile->>'instagram','mode',l.profile->>'phone_kind') end
$$;
revoke all on function hub_private.review_fingerprint(public.hub_leads,text) from public,anon,authenticated;
create function public.hub_regularization_page(w uuid,q text default '',field_filter text default '',include_missing boolean default false,page_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 if page_offset<0 or page_offset>100000 or field_filter not in('','segment','origin','owner','location','contact') or length(q)>300 then raise exception 'Filtro inválido' using errcode='22023';end if;
 return (with filtered as(select l,coalesce((select jsonb_agg(i) from jsonb_array_elements(hub_private.regularization_issues(l,include_missing))i where (field_filter='' or i->>'field'=field_filter) and not(i->>'state'='legacy' and i->>'field' in('location','contact') and exists(select 1 from hub_private.regularization_reviews r where r.workspace_id=w and r.lead_id=l.id and r.field=i->>'field' and r.fingerprint=hub_private.review_fingerprint(l,i->>'field')))),'[]') issues from hub_private.crm_filter(w,q,'','','') l),
 selected as(select * from filtered where jsonb_array_length(issues)>0),page as(select * from selected order by (l).created_at,(l).id limit 25 offset page_offset)
 select jsonb_build_object('total',(select count(*) from selected),'rows',coalesce((select jsonb_agg(jsonb_build_object('lead',to_jsonb(l),'issues',issues) order by (l).created_at,(l).id) from page),'[]'),'counts',(select coalesce(jsonb_object_agg(k,n),'{}') from(select i->>'field' k,count(*) n from filtered cross join lateral jsonb_array_elements(issues)i group by 1)x)));
end $$;
create function hub_private.regularization_legacy() returns trigger language plpgsql security definer set search_path='' as $$
declare k text;previous jsonb:=case when tg_op='UPDATE' then old.profile else '{}'::jsonb end;
begin
 foreach k in array array['owner_legacy','whatsapp_legacy'] loop
  new.profile:=new.profile-k;if previous?k then new.profile:=new.profile||jsonb_build_object(k,previous->k);end if;
 end loop;
 if tg_op='UPDATE' then
  if coalesce(previous->>'owner_id','')='' and coalesce(new.profile->>'owner_id','')<>'' and coalesce(previous->>'owner','')<>'' and not previous?'owner_legacy' then new.profile:=new.profile||jsonb_build_object('owner_legacy',previous->>'owner');end if;
  if coalesce(previous->>'phone_kind','legacy')='legacy' and new.profile->>'phone_kind' in('br','international') and coalesce(previous->>'whatsapp','')<>'' and not previous?'whatsapp_legacy' then new.profile:=new.profile||jsonb_build_object('whatsapp_legacy',previous->>'whatsapp');end if;
  if new.city is distinct from old.city or new.profile->>'uf' is distinct from previous->>'uf' or new.profile->>'address' is distinct from previous->>'address' then new.profile:=new.profile-'location_checked_at'-'location_checked_by';end if;
  if new.profile->>'whatsapp' is distinct from previous->>'whatsapp' or new.profile->>'website' is distinct from previous->>'website' then new.profile:=new.profile-'contact_checked_at'-'contact_checked_by';end if;
 end if;return new;
end $$;
create trigger hub_regularization_legacy before insert or update on public.hub_leads for each row execute function hub_private.regularization_legacy();
-- Review stamps are separate, server-owned metadata; no bypass flag in the client.
create function public.hub_regularize_lead(w uuid,l uuid,expected_revision bigint,operation_id uuid,field text,confirmed boolean,body jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt hub_private.command_receipts;payload jsonb;answer jsonb;current_lead public.hub_leads;activity uuid;patch jsonb:=coalesce(body->'profile','{}');
begin
 if not public.hub_can(w,'commercial',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if not coalesce(confirmed,false) or operation_id is null or field is null or field not in('segment','origin','owner','location','contact') then raise exception 'Confirme a regularização e o campo' using errcode='22023';end if;
 if field in('segment','origin','owner') and nullif(patch->>(field||'_id'),'') is null then raise exception 'Selecione uma referência explícita' using errcode='22023';end if;
 if field='location' and nullif(btrim(body->>'city'),'') is null then raise exception 'Informe o município conferido' using errcode='22023';end if;
 if field='contact' and coalesce(nullif(patch->>'whatsapp',''),nullif(patch->>'website',''),nullif(patch->>'instagram','')) is null then raise exception 'Informe um canal conferido' using errcode='22023';end if;
 if field='contact' and coalesce(patch->>'website','')~'(^[[:space:]]|[[:space:]]|^(javascript|data|file):)' then raise exception 'Corrija o formato do site informado' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||operation_id::text,0));payload:=jsonb_build_object('lead',l,'revision',expected_revision,'field',field,'body',body);
 select * into receipt from hub_private.command_receipts r where r.workspace_id=w and r.operation_id=hub_regularize_lead.operation_id;
 if found then if receipt.actor_id<>auth.uid() or receipt.kind<>'regularization' or receipt.payload<>payload then raise exception 'Operação já utilizada' using errcode='22023';end if;return receipt.result;end if;
 answer:=public.hub_save_lead(w,l,expected_revision,body);if answer->>'status'='conflict' then return answer;end if;
 select * into current_lead from public.hub_leads where workspace_id=w and id=l;
 insert into hub_private.regularization_reviews(workspace_id,lead_id,field,actor_id,fingerprint) values(w,l,field,auth.uid(),hub_private.review_fingerprint(current_lead,field)) on conflict on constraint regularization_reviews_pkey do update set actor_id=excluded.actor_id,recorded_at=clock_timestamp(),fingerprint=excluded.fingerprint;
 insert into public.hub_registry_events(workspace_id,kind,record_id,actor_id,action,after_record,revision,lead_id) values(w,'lead',l,auth.uid(),'Regularização explícita: '||field,jsonb_build_object('field',field,'confirmed',true),current_lead.revision,l);
 activity:=hub_private.sync_commercial_followup(w,l);answer:=answer||jsonb_build_object('activity_id',activity);insert into hub_private.command_receipts values(w,operation_id,auth.uid(),'regularization',payload,answer);return answer;
end $$;
revoke all on function hub_private.regularization_legacy() from public,anon,authenticated;
revoke all on function public.hub_regularization_page(uuid,text,text,boolean,integer),public.hub_regularize_lead(uuid,uuid,bigint,uuid,text,boolean,jsonb) from public,anon;
grant execute on function public.hub_regularization_page(uuid,text,text,boolean,integer),public.hub_regularize_lead(uuid,uuid,bigint,uuid,text,boolean,jsonb) to authenticated;
notify pgrst,'reload schema';commit;
