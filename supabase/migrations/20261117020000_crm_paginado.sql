begin;
create index hub_leads_created_page on public.hub_leads(workspace_id,created_at desc,id);
create index hub_leads_name_page on public.hub_leads(workspace_id,name,id);
create function hub_private.crm_normalize(v text) returns text language sql immutable set search_path='' as $$ select translate(lower(coalesce(v,'')),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') $$;
revoke all on function hub_private.crm_normalize(text) from public,anon,authenticated;
create function hub_private.crm_filter(w uuid,q text,s text,o text,p text)
returns setof public.hub_leads language sql stable set search_path='' as $$
 select l.* from public.hub_leads l left join public.hub_triages t on t.workspace_id=l.workspace_id and t.lead_id=l.id
 where l.workspace_id=w
 and (coalesce(q,'')='' or strpos(hub_private.crm_normalize(concat_ws(' ',l.name,l.segment,l.city,l.profile->>'region',l.profile->>'whatsapp',l.profile->>'instagram',l.profile->>'contact')),hub_private.crm_normalize(btrim(q)))>0)
 and (coalesce(s,'')='' or l.stage=s) and (coalesce(o,'')='' or l.profile->>'owner'=o)
 and (coalesce(p,'')='' or p=case when t.completed and t.scores[1] between 0 and 3 and t.scores[2] between 0 and 3 and t.scores[3] between 0 and 2 and t.scores[4] between 0 and 2 and t.scores[5] between 0 and 2 and t.scores[6] between 0 and 2 and t.scores[7] between 0 and 1 and cardinality(t.scores)=7 and array_position(t.scores,null) is null
 then case when (select sum(v) from unnest(t.scores) v)>=11 then 'A' when (select sum(v) from unnest(t.scores) v)>=7 then 'B' else 'C' end else 'Sem classificação' end)
$$;
create function public.hub_crm_page(w uuid,q text default '',s text default '',o text default '',p text default '',sort_by text default 'Recentes',page_offset integer default 0,page_size integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; total bigint; owners jsonb;
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if page_offset<0 or page_size<1 or page_size>100 or sort_by not in ('Recentes','Nome','Prazo') or length(coalesce(q,''))>300 then raise exception 'Recorte inválido' using errcode='22023'; end if;
 select count(*) into total from hub_private.crm_filter(w,q,s,o,p);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
  select * from hub_private.crm_filter(w,q,s,o,p)
  order by case when sort_by='Nome' then name end collate "C",case when sort_by='Prazo' then nullif(profile->>'due','') end nulls last,
   case when sort_by='Recentes' then created_at end desc,id
  offset page_offset limit page_size
 ) x;
 select coalesce(jsonb_agg(owner order by owner),'[]') into owners from (select distinct nullif(profile->>'owner','') owner from public.hub_leads where workspace_id=w) x where owner is not null;
 return jsonb_build_object('rows',rows,'total',total,'owners',owners);
end $$;
create function hub_private.csv_cell(v text) returns text language sql immutable set search_path='' as $$
 select '"'||replace(case when coalesce(v,'') ~ '^[[:space:]]*[=+@-]' then ''''||v else coalesce(v,'') end,'"','""')||'"'
$$;
create function public.hub_crm_export(w uuid,q text default '',s text default '',o text default '',p text default '',sort_by text default 'Recentes')
returns text language plpgsql stable security definer set search_path='' as $$
declare content text;
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if sort_by not in ('Recentes','Nome','Prazo') or length(coalesce(q,''))>300 then raise exception 'Recorte inválido' using errcode='22023'; end if;
 select string_agg(hub_private.csv_cell(name)||';'||hub_private.csv_cell(segment)||';'||hub_private.csv_cell(city)||';'||hub_private.csv_cell(stage)||';'||hub_private.csv_cell(profile->>'owner')||';'||hub_private.csv_cell(profile->>'next')||';'||hub_private.csv_cell(profile->>'due'),E'\r\n' order by case when sort_by='Nome' then name end collate "C",case when sort_by='Prazo' then nullif(profile->>'due','') end nulls last,case when sort_by='Recentes' then created_at end desc,id) into content
 from hub_private.crm_filter(w,q,s,o,p);
 return '"Nome";"Segmento";"Cidade";"Etapa";"Responsável";"Próxima ação";"Prazo"'||E'\r\n'||coalesce(content,'');
end $$;
revoke all on function hub_private.crm_filter(uuid,text,text,text,text),hub_private.csv_cell(text) from public,anon,authenticated;
revoke all on function public.hub_crm_page(uuid,text,text,text,text,text,integer,integer),public.hub_crm_export(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.hub_crm_page(uuid,text,text,text,text,text,integer,integer),public.hub_crm_export(uuid,text,text,text,text,text) to authenticated;
commit;
