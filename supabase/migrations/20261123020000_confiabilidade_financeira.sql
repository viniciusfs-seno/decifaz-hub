begin;
alter table public.hub_financial_week_closures add column source_count bigint,add column preserved_count bigint,add column details_complete boolean;
create table public.hub_financial_week_details(
 workspace_id uuid not null,week_start date not null,revision bigint not null,position bigint not null check(position>0),item jsonb not null check(jsonb_typeof(item)='object'),
 primary key(workspace_id,week_start,revision,position),foreign key(workspace_id,week_start,revision) references public.hub_financial_week_closures(workspace_id,week_start,revision) on delete cascade
);
alter table public.hub_financial_week_details enable row level security;
revoke all on public.hub_financial_week_details from public,anon,authenticated;
grant select on public.hub_financial_week_details to authenticated;
create policy financial_details_read on public.hub_financial_week_details for select to authenticated using(public.hub_can(workspace_id,'finance'));
-- Preserve only what old snapshots really contain. Never query current sources.
update public.hub_financial_week_closures set source_count=(report->>'count')::bigint,preserved_count=jsonb_array_length(report->'items'),details_complete=(report->>'count')::bigint=jsonb_array_length(report->'items');
insert into public.hub_financial_week_details select c.workspace_id,c.week_start,c.revision,j.position,j.item from public.hub_financial_week_closures c cross join lateral jsonb_array_elements(c.report->'items') with ordinality as j(item,position);
alter table public.hub_financial_week_closures alter column source_count set not null,alter column preserved_count set not null,alter column details_complete set not null,add check(source_count>=0 and preserved_count between 0 and source_count and details_complete=(source_count=preserved_count));
create function hub_private.financial_week_bundle(w uuid,start_on date,owner_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;today date:=(clock_timestamp() at time zone 'America/Fortaleza')::date;
begin
 if not public.hub_can(w,'finance') then raise insufficient_privilege using message='Acesso financeiro negado';end if;
 if start_on is null or extract(isodow from start_on)<>1 then raise exception 'Semana ou página inválida' using errcode='22023';end if;
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
  select * from sources s where (financial_week_bundle.owner_id is null or s.owner_id=financial_week_bundle.owner_id)
  and (s.due_on between start_on and start_on+6 or s.paid_on between start_on and start_on+6 or (s.outstanding>0 and s.due_on<=today+30))
 )
 select jsonb_build_object('week_start',start_on,'week_end',start_on+6,'as_of',today,'generated_at',clock_timestamp(),'count',count(*),'offset',0,
 'totals',jsonb_build_object(
 'forecast',coalesce(sum(expected) filter(where kind='forecast' and due_on between start_on and start_on+6),0),
 'received',coalesce(sum(actual) filter(where kind='receipt' and paid_on between start_on and start_on+6),0),
 'expenses',coalesce(sum(expected) filter(where kind in ('bill','expense') and due_on between start_on and start_on+6),0),
 'paid',coalesce(sum(actual) filter(where kind in ('bill','expense') and paid_on between start_on and start_on+6),0),
 'overdue',coalesce(sum(outstanding) filter(where kind in ('bill','expense') and due_on<today),0),
 'overdue_income',coalesce(sum(outstanding) filter(where kind='forecast' and due_on<today),0),
 'next_seven',coalesce(sum(outstanding) filter(where kind in ('bill','expense') and due_on between today and today+7),0),
 'next_thirty',coalesce(sum(outstanding) filter(where kind in ('bill','expense') and due_on between today and today+30),0)),
 'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from scoped order by (outstanding>0) desc,due_on,key,kind) x),'[]'::jsonb)) into result from scoped;
 if (result->>'count')::bigint>25000 then raise exception 'Recorte acima do limite operacional de 25000 origens; nenhum fechamento foi gravado' using errcode='54000';end if;
 return result;
end $$;


revoke all on function hub_private.financial_week_bundle(uuid,date,uuid) from public,anon,authenticated;
create or replace function public.hub_financial_week(w uuid,start_on date,owner_id uuid default null,page_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare b jsonb;begin
 if page_offset is null or page_offset<0 or page_offset>1000000 then raise exception 'Página inválida' using errcode='22023';end if;
 b:=hub_private.financial_week_bundle(w,start_on,owner_id);
 return (b-'items')||jsonb_build_object('offset',page_offset,'items',coalesce((select jsonb_agg(j.item order by j.position) from jsonb_array_elements(b->'items') with ordinality as j(item,position) where j.position>page_offset and j.position<=page_offset+100),'[]'::jsonb));
end $$;
create or replace function public.hub_close_financial_week(w uuid,start_on date,expected_revision bigint,operation_id uuid,notes_text text) returns jsonb
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
 next_report:=hub_private.financial_week_bundle(w,start_on,null);
 insert into public.hub_financial_week_closures(workspace_id,week_start,revision,id,operation_id,notes,report,actor_id,source_count,preserved_count,details_complete)
 values(w,start_on,expected_revision+1,coalesce(previous.id,gen_random_uuid()),operation_id,btrim(notes_text),next_report-'items',auth.uid(),(next_report->>'count')::bigint,(next_report->>'count')::bigint,true) returning * into current_row;
 insert into public.hub_financial_week_details(workspace_id,week_start,revision,position,item)
 select w,start_on,current_row.revision,j.position,j.item from jsonb_array_elements(next_report->'items') with ordinality as j(item,position);
 insert into public.hub_registry_events(workspace_id,kind,record_id,actor_id,action,financial,after_record,revision)
 values(w,'financial_week',current_row.id,auth.uid(),'Revisão financeira semanal registrada',true,to_jsonb(current_row),current_row.revision);
 return jsonb_build_object('status','saved','current',to_jsonb(current_row));
end $$;

create function public.hub_financial_week_history(w uuid,start_on date,before_revision bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if not public.hub_can(w,'finance') then raise insufficient_privilege using message='Acesso financeiro negado';end if;
 if start_on is null or (before_revision is not null and before_revision<1) then raise exception 'Página inválida' using errcode='22023';end if;
 select jsonb_build_object('count',count(*),'latest',(select (to_jsonb(c)-'report')||jsonb_build_object('report',c.report-'items') from public.hub_financial_week_closures c where c.workspace_id=w and c.week_start=start_on order by c.revision desc limit 1),'items',coalesce((select jsonb_agg((to_jsonb(x)-'report')||jsonb_build_object('report',x.report-'items') order by x.revision desc) from (select * from public.hub_financial_week_closures c where c.workspace_id=w and c.week_start=start_on and (before_revision is null or c.revision<before_revision) order by c.revision desc limit 20) x),'[]'::jsonb)) into result from public.hub_financial_week_closures where workspace_id=w and week_start=start_on;
 return result;end $$;
create function public.hub_financial_week_snapshot(w uuid,start_on date,rev bigint,page_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.hub_financial_week_closures;begin
 if not public.hub_can(w,'finance') then raise insufficient_privilege using message='Acesso financeiro negado';end if;
 if page_offset is null or page_offset<0 or page_offset>1000000 then raise exception 'Página inválida' using errcode='22023';end if;
 select * into c from public.hub_financial_week_closures where workspace_id=w and week_start=start_on and revision=rev;
 if not found then raise exception 'Fotografia indisponível' using errcode='22023';end if;
 return jsonb_build_object('closure',(to_jsonb(c)-'report')||jsonb_build_object('report',c.report-'items'),'offset',page_offset,'items',coalesce((select jsonb_agg(x.item order by x.position) from (select position,item from public.hub_financial_week_details where workspace_id=w and week_start=start_on and revision=rev order by position limit 100 offset page_offset) x),'[]'::jsonb));end $$;
revoke all on function public.hub_financial_week_history(uuid,date,bigint),public.hub_financial_week_snapshot(uuid,date,bigint,integer) from public,anon;
grant execute on function public.hub_financial_week_history(uuid,date,bigint),public.hub_financial_week_snapshot(uuid,date,bigint,integer) to authenticated;
commit;
