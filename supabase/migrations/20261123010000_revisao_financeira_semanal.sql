begin;
-- Financial annex to the existing weekly review. Never place financial notes
-- in hub_weekly_closures, whose operational history is visible to Commercial.
create table public.hub_financial_week_closures(
 workspace_id uuid not null references public.hub_workspaces(id),week_start date not null check(extract(isodow from week_start)=1),
 revision bigint not null,id uuid not null,operation_id uuid not null,notes text not null,report jsonb not null,
 actor_id uuid not null,closed_at timestamptz not null default clock_timestamp(),
 primary key(workspace_id,week_start,revision),unique(workspace_id,operation_id)
);
alter table public.hub_financial_week_closures enable row level security;
revoke all on public.hub_financial_week_closures from public,anon,authenticated;
grant select on public.hub_financial_week_closures to authenticated;
create policy financial_week_read on public.hub_financial_week_closures for select to authenticated using(public.hub_can(workspace_id,'finance'));

create function public.hub_financial_week(w uuid,start_on date,owner_id uuid default null,page_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;today date:=(clock_timestamp() at time zone 'America/Fortaleza')::date;
begin
 if not public.hub_can(w,'finance') then raise insufficient_privilege using message='Acesso financeiro negado';end if;
 if start_on is null or extract(isodow from start_on)<>1 or page_offset is null or page_offset<0 or page_offset>1000000 then raise exception 'Semana ou página inválida' using errcode='22023';end if;
 -- One statement/snapshot for sources, counts and totals. No generation/write.
 with sources as (
  select 'bill'::text as kind,b.id::text as key,b.id as origin,o.title,o.owner,o.owner_id,o.category,o.contract_id,o.project_id,b.due_on,b.amount as expected,
   case when b.status='Prevista' then b.amount else 0 end as outstanding,b.paid_on,coalesce(b.paid_amount,0) as actual,b.status
  from public.hub_internal_bills b join public.hub_internal_obligations o using(workspace_id) where b.workspace_id=w and o.id=b.obligation_id and b.status in ('Prevista','Paga')
  union all
  select 'expense',e.id::text,e.id,e.title,'Sem responsável cadastrado',null,'Despesa avulsa',null,null,e.due_on,e.amount,case when e.paid_on is null then e.amount else 0 end,e.paid_on,coalesce(e.paid_amount,0),case when e.paid_on is null then 'Prevista' else 'Paga' end from public.hub_expenses e where e.workspace_id=w
  union all
  select 'forecast',f.proposal_id::text||f.kind||f.period::text,f.proposal_id,coalesce(p.approved->>'title','Projeto')||' · '||f.kind,'Sem responsável financeiro cadastrado',null,'Receita de cliente',null,f.proposal_id,f.due_on,f.amount,
   greatest(0,f.amount-coalesce((select sum(r.amount) from public.hub_receipts r where r.workspace_id=w and r.proposal_id=f.proposal_id and r.kind=f.kind and r.period=f.period and r.reversed_at is null),0)),null,0,'Prevista'
  from public.hub_receivables f join public.hub_projects p on p.workspace_id=f.workspace_id and p.proposal_id=f.proposal_id where f.workspace_id=w
  union all
  select 'receipt',r.id::text,r.proposal_id,coalesce(p.approved->>'title','Projeto')||' · '||r.kind,'Sem responsável financeiro cadastrado',null,'Recebimento',null,r.proposal_id,r.received_on,0,0,r.received_on,r.amount,'Realizada'
  from public.hub_receipts r join public.hub_projects p on p.workspace_id=r.workspace_id and p.proposal_id=r.proposal_id where r.workspace_id=w and r.reversed_at is null
 ), scoped as (
  select * from sources s where (hub_financial_week.owner_id is null or s.owner_id=hub_financial_week.owner_id)
  and (s.due_on between start_on and start_on+6 or s.paid_on between start_on and start_on+6 or (s.outstanding>0 and s.due_on<=today+30))
 )
 select jsonb_build_object('week_start',start_on,'week_end',start_on+6,'as_of',today,'generated_at',clock_timestamp(),'count',count(*),'offset',page_offset,
 'totals',jsonb_build_object(
 'forecast',coalesce(sum(expected) filter(where kind='forecast' and due_on between start_on and start_on+6),0),
 'received',coalesce(sum(actual) filter(where kind='receipt' and paid_on between start_on and start_on+6),0),
 'expenses',coalesce(sum(expected) filter(where kind in ('bill','expense') and due_on between start_on and start_on+6),0),
 'paid',coalesce(sum(actual) filter(where kind in ('bill','expense') and paid_on between start_on and start_on+6),0),
 'overdue',coalesce(sum(outstanding) filter(where kind in ('bill','expense') and due_on<today),0),
 'overdue_income',coalesce(sum(outstanding) filter(where kind='forecast' and due_on<today),0),
 'next_seven',coalesce(sum(outstanding) filter(where kind in ('bill','expense') and due_on between today and today+7),0),
 'next_thirty',coalesce(sum(outstanding) filter(where kind in ('bill','expense') and due_on between today and today+30),0)),
 'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from scoped order by (outstanding>0) desc,due_on,key,kind limit 100 offset page_offset) x),'[]'::jsonb)) into result from scoped;
 return result;
end $$;

create function public.hub_close_financial_week(w uuid,start_on date,expected_revision bigint,operation_id uuid,notes_text text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_row public.hub_financial_week_closures;previous public.hub_financial_week_closures;next_report jsonb;
begin
 if not public.hub_can(w,'finance',true) then raise insufficient_privilege using message='Acesso financeiro negado';end if;
 if operation_id is null or expected_revision is null or expected_revision<0 or nullif(btrim(notes_text),'') is null or length(notes_text)>5000 or start_on is null or extract(isodow from start_on)<>1 or start_on>date_trunc('week',clock_timestamp() at time zone 'America/Fortaleza')::date then raise exception 'Fechamento inválido' using errcode='22023';end if;
 perform 1 from public.hub_workspaces where id=w for update;
 if not public.hub_can(w,'finance',true) then raise insufficient_privilege using message='Acesso financeiro negado';end if;
 select * into previous from public.hub_financial_week_closures c where c.workspace_id=w and c.operation_id=hub_close_financial_week.operation_id;
 if found then
  if previous.week_start<>start_on or previous.notes<>btrim(notes_text) then raise exception 'Operação reutilizada com dados diferentes' using errcode='22023';end if;
  return jsonb_build_object('status','saved','current',to_jsonb(previous));
 end if;
 select * into previous from public.hub_financial_week_closures where workspace_id=w and week_start=start_on order by revision desc limit 1;
 if coalesce(previous.revision,0)<>expected_revision then return jsonb_build_object('status','conflict','current',to_jsonb(previous));end if;
 next_report:=public.hub_financial_week(w,start_on,null,0);
 insert into public.hub_financial_week_closures(workspace_id,week_start,revision,id,operation_id,notes,report,actor_id)
 values(w,start_on,expected_revision+1,coalesce(previous.id,gen_random_uuid()),operation_id,btrim(notes_text),next_report,auth.uid()) returning * into current_row;
 insert into public.hub_registry_events(workspace_id,kind,record_id,actor_id,action,financial,after_record,revision)
 values(w,'financial_week',current_row.id,auth.uid(),'Revisão financeira semanal registrada',true,to_jsonb(current_row),current_row.revision);
 return jsonb_build_object('status','saved','current',to_jsonb(current_row));
end $$;
revoke all on function public.hub_financial_week(uuid,date,uuid,integer),public.hub_close_financial_week(uuid,date,bigint,uuid,text) from public,anon;
grant execute on function public.hub_financial_week(uuid,date,uuid,integer),public.hub_close_financial_week(uuid,date,bigint,uuid,text) to authenticated;
commit;
