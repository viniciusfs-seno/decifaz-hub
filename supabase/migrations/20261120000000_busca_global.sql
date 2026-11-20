begin;
-- Search returns a bounded metadata projection, never raw proposal/project JSON,
-- financial conditions, notes or documents. Authorization precedes any search.
create function public.hub_search_records(w uuid,q text,result_limit integer default 20)
returns table(kind text,id uuid,title text,detail text,lead_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare needle text;
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 if q is null or length(btrim(q))<2 then return;end if;
 if length(q)>100 then raise exception 'Busca deve ter até 100 caracteres' using errcode='22023';end if;
 needle:=hub_private.crm_normalize(btrim(q));
 return query
 select found.kind,found.id,found.title,found.detail,found.lead_id from (
  select 'lead'::text as kind,l.id,l.name as title,concat_ws(' · ',nullif(l.city,''),l.stage) as detail,l.id as lead_id
  from public.hub_leads l where l.workspace_id=w and public.hub_can(w,'commercial')
   and position(needle in hub_private.crm_normalize(l.name||' '||l.city))>0
  union all
  select 'project',p.proposal_id,coalesce(p.approved->>'title','Projeto'),concat_ws(' · ',p.status,l.name),p.lead_id
  from public.hub_projects_visible p join public.hub_leads l on l.workspace_id=p.workspace_id and l.id=p.lead_id
  where p.workspace_id=w and public.hub_can(w,'projects')
   and position(needle in hub_private.crm_normalize(coalesce(p.approved->>'title','')||' '||l.name))>0
  union all
  select 'contract',c.id,c.title,concat_ws(' · ',c.status,l.name),c.lead_id
  from public.hub_contracts c join public.hub_leads l on l.workspace_id=c.workspace_id and l.id=c.lead_id
  where c.workspace_id=w and public.hub_can(w,'commercial')
   and position(needle in hub_private.crm_normalize(c.title||' '||l.name))>0
 ) found order by lower(found.title),found.kind,found.id
 limit greatest(1,least(coalesce(result_limit,20),20));
end $$;
revoke all on function public.hub_search_records(uuid,text,integer) from public,anon;
grant execute on function public.hub_search_records(uuid,text,integer) to authenticated;
commit;
