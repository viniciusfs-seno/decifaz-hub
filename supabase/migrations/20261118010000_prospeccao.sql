begin;
-- Private receipts bind retries to actor, workspace, command and payload.
create table hub_private.command_receipts(
 workspace_id uuid not null references public.hub_workspaces(id) on delete cascade,
 operation_id uuid not null, actor_id uuid not null, kind text not null, payload jsonb not null, result jsonb not null,
 primary key(workspace_id,operation_id)
);
revoke all on hub_private.command_receipts from public,anon,authenticated;
create function public.hub_plan_contact(w uuid,l uuid,expected_revision bigint,operation_id uuid,body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare lead public.hub_leads; receipt hub_private.command_receipts; answer jsonb; interaction uuid; activity uuid;
begin
 if not public.hub_can(w,'commercial',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if operation_id is null or jsonb_typeof(body) is distinct from 'object' or length(body::text)>12000
 or exists(select 1 from jsonb_object_keys(body) k where k not in ('result','next','owner','due','create_activity'))
 or btrim(coalesce(body->>'result',''))='' and btrim(coalesce(body->>'next',''))=''
 or exists(select 1 from jsonb_each(body) e where e.key in ('result','next','owner','due') and jsonb_typeof(e.value)<>'string')
 or body ? 'create_activity' and jsonb_typeof(body->'create_activity')<>'boolean' then raise exception 'Informe resultado ou próxima ação' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||operation_id::text,0));
 select * into receipt from hub_private.command_receipts r where r.workspace_id=w and r.operation_id=hub_plan_contact.operation_id;
 if found then
  if receipt.actor_id<>auth.uid() or receipt.kind<>'contact' or receipt.payload<>jsonb_build_object('l',l,'revision',expected_revision,'body',body) then raise exception 'Identificador já usado em outra operação' using errcode='22023';end if;
  return receipt.result;
 end if;
 select * into lead from public.hub_leads where workspace_id=w and id=l for update;
 if not found then raise exception 'Estabelecimento indisponível' using errcode='42501';end if;
 if expected_revision is distinct from lead.revision then return jsonb_build_object('status','conflict','current',to_jsonb(lead));end if;
 if body ? 'next' and nullif(btrim(body->>'next'),'') is not null and
 (nullif(btrim(body->>'owner'),'') is null or nullif(body->>'due','') is null) then raise exception 'Próxima ação exige responsável e prazo' using errcode='22023';end if;
 if nullif(body->>'due','') is not null then perform (body->>'due')::date;end if;
 if nullif(btrim(body->>'result'),'') is not null then
  insert into public.hub_interactions(workspace_id,lead_id,body) values(w,l,btrim(body->>'result')) returning id into interaction;
 end if;
 if body ? 'next' then
  update public.hub_leads set profile=profile||jsonb_build_object('next',coalesce(body->>'next',''),'owner',coalesce(body->>'owner',''),'due',coalesce(body->>'due',''))
  where workspace_id=w and id=l returning * into lead;
  if coalesce((body->>'create_activity')::boolean,false) and nullif(btrim(body->>'next'),'') is not null then
   insert into public.hub_activities(workspace_id,lead_id,title,owner,due_on) values(w,l,btrim(body->>'next'),body->>'owner',(body->>'due')::date) returning id into activity;
  end if;
 end if;
 answer:=jsonb_build_object('status','saved','current',to_jsonb(lead),'interaction_id',interaction,'activity_id',activity);
 insert into hub_private.command_receipts values(w,operation_id,auth.uid(),'contact',jsonb_build_object('l',l,'revision',expected_revision,'body',body),answer);
 return answer;
end $$;
revoke all on function public.hub_plan_contact(uuid,uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.hub_plan_contact(uuid,uuid,bigint,uuid,jsonb) to authenticated;
commit;
