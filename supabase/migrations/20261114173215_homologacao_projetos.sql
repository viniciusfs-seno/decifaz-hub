begin;
alter table public.hub_projects add column delivery jsonb;
alter table public.hub_projects add constraint hub_project_delivery_required check (
 status <> 'Entregue' or coalesce((
 jsonb_typeof(delivery) = 'object' and delivery->'checks' @> '["tests","scope","pending"]'::jsonb
 and nullif(btrim(delivery->>'reference'),'') is not null and delivery->>'acceptedAt' is not null
 ),false)) not valid;
alter table public.hub_activities add column project_proposal_id uuid;
alter table public.hub_activities add constraint hub_activity_project foreign key(workspace_id,project_proposal_id)
 references public.hub_projects(workspace_id,proposal_id);
create index hub_activity_project_idx on public.hub_activities(workspace_id,project_proposal_id) where project_proposal_id is not null;
create function hub_private.accept_delivery(w uuid,p uuid,c jsonb,d date,e text,t text,o text,due date)
returns boolean language plpgsql security definer set search_path='' as $$
declare l uuid; actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from public.hub_members where workspace_id=w and user_id=actor)
  or c is null or jsonb_typeof(c)<>'array' or not (c @> '["tests","scope","pending"]'::jsonb)
  or d is null or d>(now() at time zone 'America/Fortaleza')::date or nullif(btrim(e),'') is null
  or (nullif(btrim(t),'') is not null and (nullif(btrim(o),'') is null or due is null)) then return false; end if;
 update public.hub_projects set status='Entregue',delivery=jsonb_build_object('checks',c,'acceptedAt',d,'reference',btrim(e),'actor',actor)
 where workspace_id=w and proposal_id=p and delivery is null returning lead_id into l;
 if not found then return false; end if;
 insert into public.hub_interactions(workspace_id,lead_id,author_id,body)
 values(w,l,actor,'Entrega aceita · '||btrim(e));
 if nullif(btrim(t),'') is not null then
  insert into public.hub_activities(workspace_id,lead_id,project_proposal_id,title,owner,due_on)
  values(w,l,p,btrim(t),btrim(o),due);
 end if;
 return true;
end;
$$;
create function public.hub_accept_delivery(w uuid,p uuid,c jsonb,d date,e text,t text,o text,due date)
returns boolean language sql security invoker set search_path='' as $$ select hub_private.accept_delivery(w,p,c,d,e,t,o,due); $$;
revoke all on function hub_private.accept_delivery(uuid,uuid,jsonb,date,text,text,text,date),public.hub_accept_delivery(uuid,uuid,jsonb,date,text,text,text,date) from public,anon;
grant execute on function hub_private.accept_delivery(uuid,uuid,jsonb,date,text,text,text,date),public.hub_accept_delivery(uuid,uuid,jsonb,date,text,text,text,date) to authenticated;
commit;
