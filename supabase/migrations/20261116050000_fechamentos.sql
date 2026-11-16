begin;
create table public.hub_weekly_closures(
 workspace_id uuid not null references public.hub_workspaces(id) on delete cascade,
 week_start date not null check(extract(isodow from week_start)=1),revision bigint not null,
 summary text not null,decisions text not null,actions jsonb not null,actor_id uuid not null,closed_at timestamptz not null default now(),
 primary key(workspace_id,week_start)
);
create table public.hub_weekly_closure_history (like public.hub_weekly_closures including defaults including constraints);
alter table public.hub_weekly_closure_history add primary key(workspace_id,week_start,revision);
alter table public.hub_weekly_closure_history add foreign key(workspace_id) references public.hub_workspaces(id) on delete cascade;
alter table public.hub_weekly_closures enable row level security;
alter table public.hub_weekly_closure_history enable row level security;
create policy closure_read on public.hub_weekly_closures for select to authenticated using(public.hub_can(workspace_id,'commercial'));
create policy closure_history_read on public.hub_weekly_closure_history for select to authenticated using(public.hub_can(workspace_id,'commercial'));
revoke all on public.hub_weekly_closures,public.hub_weekly_closure_history from public,anon,authenticated;
grant select on public.hub_weekly_closures,public.hub_weekly_closure_history to authenticated;
create function public.hub_close_week(w uuid,start_on date,expected_revision bigint,summary_text text,decision_text text,planned jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.hub_weekly_closures%rowtype; a jsonb; aid uuid; actual jsonb; snapshot jsonb:='[]';begin
 if not public.hub_can(w,'admin',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if start_on is null or extract(isodow from start_on)<>1 or start_on>date_trunc('week',(now() at time zone 'America/Fortaleza'))::date
 or nullif(btrim(summary_text),'') is null or length(summary_text)>20000 or length(decision_text)>20000
 or jsonb_typeof(planned) is distinct from 'array' or jsonb_array_length(planned)>100 or expected_revision is null then raise exception 'Fechamento inválido' using errcode='22023';end if;
 perform 1 from public.hub_workspaces where id=w for update;
 select * into current_row from public.hub_weekly_closures where workspace_id=w and week_start=start_on;
 if coalesce(current_row.revision,0)<>expected_revision then return jsonb_build_object('status','conflict','current',to_jsonb(current_row));end if;
 for a in select value from jsonb_array_elements(planned) loop
  if a ? 'activity_id' then aid:=(a->>'activity_id')::uuid;
  else aid:=public.hub_review_action(w,a->>'kind',(a->>'source')::uuid,a->>'title',a->>'owner',(a->>'due')::date);end if;
  select jsonb_build_object('id',id,'title',title,'owner',owner,'due',due_on,'status',status,'lead_id',lead_id,'project_id',project_proposal_id)
   into actual from public.hub_activities where workspace_id=w and id=aid;
  if actual is null then raise exception 'Atividade fora do espaço' using errcode='42501';end if;
  if nullif(btrim(actual->>'owner'),'') is null or actual->>'due' is null then raise exception 'Defina responsável e prazo da atividade antes de incluí-la' using errcode='22023';end if;
  if not exists(select 1 from jsonb_array_elements(snapshot) x where x->>'id'=aid::text) then snapshot:=snapshot||jsonb_build_array(actual);end if;
 end loop;
 insert into public.hub_weekly_closures(workspace_id,week_start,revision,summary,decisions,actions,actor_id)
 values(w,start_on,expected_revision+1,btrim(summary_text),coalesce(decision_text,''),snapshot,auth.uid())
 on conflict(workspace_id,week_start) do update set revision=excluded.revision,summary=excluded.summary,decisions=excluded.decisions,actions=excluded.actions,actor_id=excluded.actor_id,closed_at=now() returning * into current_row;
 insert into public.hub_weekly_closure_history select current_row.*;
 return jsonb_build_object('status','saved','current',to_jsonb(current_row));
end $$;
revoke all on function public.hub_close_week(uuid,date,bigint,text,text,jsonb) from public,anon;
grant execute on function public.hub_close_week(uuid,date,bigint,text,text,jsonb) to authenticated;
commit;
