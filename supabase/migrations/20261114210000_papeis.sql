begin;

-- Contract: apply only after Edge and a views-compatible frontend are live.
create function public.hub_set_roles(w uuid,u uuid,r text[])
returns boolean language plpgsql security definer set search_path='' as $$
declare chosen text[];
begin
 -- Serialize role changes so concurrent demotions cannot remove every admin.
 perform 1 from public.hub_workspaces where id=w for update;
 if not public.hub_can(w,'admin',true) then return false; end if;
 if r is null or coalesce(array_ndims(r),0)<>1 then return false; end if;
 if array_position(r,null) is not null or not (r <@ array['admin','commercial','operations','finance']::text[]) then return false; end if;
 select array_agg(distinct value order by value) into chosen from unnest(r) as roles(value);
 if not ('admin'=any(chosen)) and exists(select 1 from public.hub_members where workspace_id=w and user_id=u and 'admin'=any(array[role] || extra_roles))
 and (select count(*) from public.hub_members where workspace_id=w and 'admin'=any(array[role] || extra_roles))<=1 then return false; end if;
 insert into public.hub_members(workspace_id,user_id,role,extra_roles) values(w,u,chosen[1],coalesce(chosen[2:],'{}'))
 on conflict(workspace_id,user_id) do update set role=excluded.role,extra_roles=excluded.extra_roles;
 return true;
end;
$$;
revoke all on function public.hub_set_roles(uuid,uuid,text[]) from public,anon;
grant execute on function public.hub_set_roles(uuid,uuid,text[]) to authenticated;

-- Single-role compatibility; this replaces the entire set.
create function public.hub_set_role(w uuid,u uuid,r text)
returns boolean language sql security invoker set search_path='' as $$
 select public.hub_set_roles(w,u,array[r]);
$$;
revoke all on function public.hub_set_role(uuid,uuid,text) from public,anon;
grant execute on function public.hub_set_role(uuid,uuid,text) to authenticated;

create function hub_private.guard_lead_won()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.stage='Ganho' and old.stage is distinct from new.stage and auth.uid() is not null
  and not public.hub_can(new.workspace_id,'admin',true)
 then raise insufficient_privilege using message='Somente Administração pode marcar o lead como Ganho'; end if;
 return new;
end;
$$;
revoke all on function hub_private.guard_lead_won() from public,anon,authenticated;
create trigger hub_lead_won_guard before update of stage on public.hub_leads
 for each row execute function hub_private.guard_lead_won();

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
revoke all on function hub_private.visible_scope(uuid,jsonb) from public,anon;
grant execute on function hub_private.visible_scope(uuid,jsonb) to authenticated;
create or replace view public.hub_proposals_visible with (security_barrier=true) as
 select workspace_id,id,lead_id,series_id,version,meeting_id,status,
 hub_private.visible_scope(workspace_id,record) as record from public.hub_proposals
 where public.hub_can(workspace_id,'commercial');
create or replace view public.hub_projects_visible with (security_barrier=true) as
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
  definition:=pg_get_functiondef(f.oid);
  definition:=regexp_replace(definition,'\mbegin\M',guard,'i');
  if f.proname='save_proposal' then
   -- The lead lock and current-version read already precede this branch.
   definition:=replace(definition,' if decision is null then', $g$
 if decision='Aceita' and not public.hub_can(w,'admin',true) then return false; end if;
 if decision is null and body is not null and not public.hub_can(w,'admin',true) then
  if body ?| array['setup','monthly','terms'] then return false; end if;
  body:=body || case when curr.id is null then '{"setup":0,"monthly":0,"terms":""}'::jsonb
   else jsonb_build_object('setup',curr.record->'setup','monthly',curr.record->'monthly','terms',curr.record->'terms') end;
 end if;
 if decision is null then$g$);
  end if;
  execute definition;
 end loop;
end;
$$;
-- Activation and revocation are atomic. The membership trigger also checks
-- the actual privileges on every restricted-role assignment.
do $$ begin
 if has_column_privilege('authenticated','public.hub_proposals','record','SELECT')
 or has_column_privilege('authenticated','public.hub_projects','approved','SELECT') then
  raise exception 'JSON privileges must be revoked before activation';
 end if;
end $$;
update hub_private.access_release set hardened=true where singleton;
commit;
