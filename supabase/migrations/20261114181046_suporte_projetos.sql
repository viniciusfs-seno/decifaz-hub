begin;
alter table public.hub_activities add column support boolean not null default false;
create function hub_private.open_support(w uuid,p uuid,t text,o text,d date)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.hub_members where workspace_id=w and user_id=auth.uid())
 or nullif(btrim(t),'') is null or nullif(btrim(o),'') is null or d is null then return false; end if;
 insert into public.hub_activities(workspace_id,lead_id,project_proposal_id,title,owner,due_on,support)
 select workspace_id,lead_id,proposal_id,btrim(t),btrim(o),d,true
 from public.hub_projects where workspace_id=w and proposal_id=p;
 return found;
end;
$$;
create function public.hub_open_support(w uuid,p uuid,t text,o text,d date)
returns boolean language sql security invoker set search_path='' as $$ select hub_private.open_support(w,p,t,o,d); $$;
revoke all on function hub_private.open_support(uuid,uuid,text,text,date),public.hub_open_support(uuid,uuid,text,text,date) from public,anon;
grant execute on function hub_private.open_support(uuid,uuid,text,text,date),public.hub_open_support(uuid,uuid,text,text,date) to authenticated;
commit;
