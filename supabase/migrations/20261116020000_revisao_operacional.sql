begin;

-- Source identity is written only by the RPC. It makes a review action reusable
-- across browser sessions while the action remains open.
alter table public.hub_activities
 add column review_kind text,
 add column review_id uuid,
 add constraint hub_review_source check ((review_kind is null)=(review_id is null));
create unique index hub_review_pending_source on public.hub_activities(workspace_id,review_kind,review_id)
 where review_kind is not null and status in ('Pendente','Em andamento');

create function public.hub_review_action(w uuid,k text,s uuid,t text,o text,d date)
returns uuid language plpgsql security definer set search_path='' as $$
declare l uuid; p uuid; existing uuid;
begin
 if nullif(btrim(t),'') is null or nullif(btrim(o),'') is null or d is null or length(t)>500 or length(o)>200 then
  raise exception 'Informe ação, responsável e prazo' using errcode='22023';
 end if;
 if auth.uid() is null or nullif(btrim(t),'') is null or nullif(btrim(o),'') is null or d is null
 or length(t)>500 or length(o)>200 then raise exception 'Ação inválida' using errcode='22023'; end if;
 -- Match the permission of the source before reading it as the function owner.
 if not public.hub_can(w,case when k='project' then 'projects' else 'commercial' end,true) then
  raise exception 'Acesso negado' using errcode='42501';
 end if;
 -- Serialize reviews in one workspace, including double clicks from two sessions.
 perform 1 from public.hub_workspaces where id=w for update;
 case k
  when 'lead' then select id into l from public.hub_leads where workspace_id=w and id=s;
  when 'meeting' then select lead_id into l from public.hub_meetings where workspace_id=w and id=s;
  when 'proposal' then select lead_id into l from public.hub_proposals where workspace_id=w and id=s;
  when 'project' then select lead_id,proposal_id into l,p from public.hub_projects where workspace_id=w and proposal_id=s;
  else raise exception 'Origem inválida' using errcode='22023';
 end case;
 if l is null then raise exception 'Origem indisponível' using errcode='42501'; end if;
 select id into existing from public.hub_activities where workspace_id=w and review_kind=k and review_id=s and status in ('Pendente','Em andamento');
 if existing is not null then return existing; end if;
 insert into public.hub_activities(workspace_id,lead_id,project_proposal_id,title,owner,due_on,review_kind,review_id)
 values(w,l,p,btrim(t),btrim(o),d,k,s) returning id into existing;
 return existing;
end;
$$;
revoke all on function public.hub_review_action(uuid,text,uuid,text,text,date) from public,anon;
grant execute on function public.hub_review_action(uuid,text,uuid,text,text,date) to authenticated;
commit;
