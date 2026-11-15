begin;

-- Existing memberships retain their previous access. New invitations must use
-- the administrator RPC and explicitly choose the least privileged role.
alter table public.hub_members add column role text not null default 'admin'
 check (role in ('admin','commercial','operations','finance'));

create function public.hub_can(w uuid, module text, writing boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hub_members where workspace_id=w and user_id=auth.uid()
 and case module
 when 'commercial' then not writing or role in ('admin','commercial')
 when 'projects' then not writing or role in ('admin','operations')
 when 'finance' then role in ('admin','finance')
 when 'admin' then role='admin'
 else false end);
$$;
revoke all on function public.hub_can(uuid,text,boolean) from public,anon;
grant execute on function public.hub_can(uuid,text,boolean) to authenticated;

create function public.hub_set_role(w uuid,u uuid,r text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 -- Serialize role changes so concurrent demotions cannot remove every admin.
 perform 1 from public.hub_workspaces where id=w for update;
 if not public.hub_can(w,'admin',true) then return false; end if;
 if r is null or r not in ('admin','commercial','operations','finance') then return false; end if;
 if r<>'admin' and exists(select 1 from public.hub_members where workspace_id=w and user_id=u and role='admin')
 and (select count(*) from public.hub_members where workspace_id=w and role='admin')<=1 then return false; end if;
 insert into public.hub_members(workspace_id,user_id,role) values(w,u,r)
 on conflict(workspace_id,user_id) do update set role=excluded.role;
 return true;
end;
$$;
revoke all on function public.hub_set_role(uuid,uuid,text) from public,anon;
grant execute on function public.hub_set_role(uuid,uuid,text) to authenticated;

-- Replace every broad member policy, including finance audit history.
do $$
declare t text; m text; p record;
begin
 foreach t in array array['hub_leads','hub_triages','hub_meetings','hub_interactions','hub_activities','hub_projects',
 'hub_proposals','hub_receivables','hub_receipts','hub_expenses','hub_finance_audit'] loop
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',p.policyname,t);
  end loop;
  m:=case when t in ('hub_receivables','hub_receipts','hub_expenses','hub_finance_audit') then 'finance'
     when t='hub_projects' then 'projects' else 'commercial' end;
  execute format('create policy role_read on public.%I for select to authenticated using(public.hub_can(workspace_id,%L))',t,m);
  if t='hub_activities' then
   execute 'create policy role_insert on public.hub_activities for insert to authenticated with check(public.hub_can(workspace_id,case when project_proposal_id is null then ''commercial'' else ''projects'' end,true))';
   execute 'create policy role_update on public.hub_activities for update to authenticated using(public.hub_can(workspace_id,case when project_proposal_id is null then ''commercial'' else ''projects'' end,true)) with check(public.hub_can(workspace_id,case when project_proposal_id is null then ''commercial'' else ''projects'' end,true))';
  elsif t='hub_expenses' then
   execute 'create policy role_insert on public.hub_expenses for insert to authenticated with check(public.hub_can(workspace_id,''finance'',true))';
   execute 'create policy role_update on public.hub_expenses for update to authenticated using(paid_on is null and public.hub_can(workspace_id,''finance'',true)) with check(paid_on <= (now() at time zone ''America/Fortaleza'')::date and public.hub_can(workspace_id,''finance'',true))';
  else
   execute format('create policy role_insert on public.%I for insert to authenticated with check(public.hub_can(workspace_id,%L,true)%s)',t,m,case when t='hub_interactions' then ' and author_id=auth.uid()' else '' end);
   execute format('create policy role_update on public.%I for update to authenticated using(public.hub_can(workspace_id,%L,true)) with check(public.hub_can(workspace_id,%L,true))',t,m,m);
  end if;
 end loop;
end;
$$;

-- Raw JSON is never granted to members. These owner views explicitly check
-- membership and redact financial fields before PostgREST can filter on them.
revoke select on public.hub_proposals,public.hub_projects from authenticated;
grant select(workspace_id,id,lead_id,series_id,version,meeting_id,status) on public.hub_proposals to authenticated;
grant select(workspace_id,proposal_id,lead_id,owner,due_on,status,deliverables,delivery) on public.hub_projects to authenticated;
create function hub_private.visible_scope(w uuid,body jsonb)
returns jsonb language sql stable security invoker set search_path='' as $$
 select case when public.hub_can(w,'finance') then body else
 (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(body)
 where key in ('title','scope','services','validity','version','decisionAt')) end;
$$;
revoke all on function hub_private.visible_scope(uuid,jsonb) from public,anon,authenticated;
create view public.hub_proposals_visible with (security_barrier=true) as
 select workspace_id,id,lead_id,series_id,version,meeting_id,status,
 hub_private.visible_scope(workspace_id,record) as record from public.hub_proposals
 where public.hub_can(workspace_id,'commercial');
create view public.hub_projects_visible with (security_barrier=true) as
 select workspace_id,proposal_id,lead_id,owner,due_on,status,deliverables,delivery,
 hub_private.visible_scope(workspace_id,approved) as approved from public.hub_projects
 where public.hub_can(workspace_id,'projects');
revoke all on public.hub_proposals_visible,public.hub_projects_visible from public,anon,authenticated;
grant select on public.hub_proposals_visible,public.hub_projects_visible to authenticated;

-- Definer RPCs must authorize before touching rows; RLS alone does not protect
-- their writes. Inject guards into their existing, versioned implementations.
do $$
declare f record; definition text; m text; guard text;
begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='hub_private' and p.proname in
 ('save_proposal','open_project','forecast','receive','reverse_receipt','accept_delivery','open_support') loop
  m:=case when f.proname in ('forecast','receive','reverse_receipt') then 'finance'
     when f.proname='save_proposal' then 'commercial' else 'projects' end;
  guard:=format(E'begin\n if not public.hub_can(w,%L,true) then return false; end if;\n',m);
  if f.proname='save_proposal' then
   guard:=guard || $g$
 if body is not null and not public.hub_can(w,'finance') then
  -- Commercial can change scope without reading or altering agreed prices.
  if body ?| array['setup','monthly','terms'] then return false; end if;
  body:=body || coalesce((select jsonb_build_object('setup',record->'setup','monthly',record->'monthly','terms',record->'terms')
   from public.hub_proposals where workspace_id=w and lead_id=l and series_id=s order by version desc limit 1),'{"setup":0,"monthly":0,"terms":""}'::jsonb);
 end if;
 $g$;
  end if;
  definition:=pg_get_functiondef(f.oid);
  definition:=regexp_replace(definition,'\mbegin\M',guard,'i');
  execute definition;
 end loop;
end;
$$;
commit;
