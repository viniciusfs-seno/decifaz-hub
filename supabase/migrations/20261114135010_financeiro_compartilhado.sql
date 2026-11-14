begin;
create table public.hub_receivables (
 workspace_id uuid not null,
 proposal_id uuid not null,
 kind text not null check (kind in ('Implantação','Mensalidade')),
 period date not null check (extract(day from period)=1),
 due_on date not null,
 amount numeric(12,2) not null check (amount > 0),
 primary key(workspace_id,proposal_id,kind,period),
 foreign key(workspace_id,proposal_id) references public.hub_projects(workspace_id,proposal_id),
 check ((kind='Implantação' and period=date '0001-01-01') or
        (kind='Mensalidade' and period=date_trunc('month',due_on::timestamp)::date))
);
create table public.hub_receipts (
 workspace_id uuid not null,
 proposal_id uuid not null,
 kind text not null,
 period date not null,
 id uuid not null,
 received_on date not null,
 amount numeric(12,2) not null check (amount > 0),
 primary key(workspace_id,proposal_id,kind,period,id),
 foreign key(workspace_id,proposal_id,kind,period) references public.hub_receivables(workspace_id,proposal_id,kind,period)
);
alter table public.hub_receivables enable row level security;
alter table public.hub_receipts enable row level security;
revoke all on public.hub_receivables,public.hub_receipts from public,anon,authenticated;
grant select on public.hub_receivables,public.hub_receipts to authenticated;
create policy hub_receivables_read on public.hub_receivables for select to authenticated
 using (workspace_id in (select workspace_id from public.hub_members where user_id=(select auth.uid())));
create policy hub_receipts_read on public.hub_receipts for select to authenticated
 using (workspace_id in (select workspace_id from public.hub_members where user_id=(select auth.uid())));

create function hub_private.forecast(w uuid,p uuid,k text,d date)
returns boolean language plpgsql security definer set search_path='' as $$
declare value numeric; month date;
begin
 if auth.uid() is null or not exists(select 1 from public.hub_members where workspace_id=w and user_id=auth.uid()) then return false; end if;
 if k is null or k not in ('Implantação','Mensalidade') or d is null then return false; end if;
 select (approved->>case k when 'Implantação' then 'setup' else 'monthly' end)::numeric into value
 from public.hub_projects where workspace_id=w and proposal_id=p;
 if value is null or value<=0 then return false; end if;
 month:=case when k='Implantação' then date '0001-01-01' else date_trunc('month',d::timestamp)::date end;
 insert into public.hub_receivables values(w,p,k,month,d,value) on conflict do nothing;
 return found;
end;
$$;
create function hub_private.receive(w uuid,p uuid,k text,m date,i uuid,d date,a numeric)
returns boolean language plpgsql security definer set search_path='' as $$
declare expected numeric; recorded numeric;
begin
 if auth.uid() is null or not exists(select 1 from public.hub_members where workspace_id=w and user_id=auth.uid()) then return false; end if;
 if i is null or a is null or a<=0 or a<>round(a,2) or d is null or d>(now() at time zone 'America/Fortaleza')::date then return false; end if;
 select amount into expected from public.hub_receivables
 where workspace_id=w and proposal_id=p and kind=k and period=m for update;
 if not found then return false; end if;
 if exists(select 1 from public.hub_receipts where workspace_id=w and proposal_id=p and kind=k and period=m and id=i) then
  return exists(select 1 from public.hub_receipts where workspace_id=w and proposal_id=p and kind=k and period=m and id=i and amount=a and received_on=d);
 end if;
 select coalesce(sum(amount),0) into recorded from public.hub_receipts where workspace_id=w and proposal_id=p and kind=k and period=m;
 if a+recorded>expected then return false; end if;
 insert into public.hub_receipts values(w,p,k,m,i,d,a);
 return true;
end;
$$;
create function public.hub_forecast(w uuid,p uuid,k text,d date)
returns boolean language sql security invoker set search_path='' as $$ select hub_private.forecast(w,p,k,d); $$;
create function public.hub_receive(w uuid,p uuid,k text,m date,i uuid,d date,a numeric)
returns boolean language sql security invoker set search_path='' as $$ select hub_private.receive(w,p,k,m,i,d,a); $$;
revoke all on function hub_private.forecast(uuid,uuid,text,date),hub_private.receive(uuid,uuid,text,date,uuid,date,numeric),
 public.hub_forecast(uuid,uuid,text,date),public.hub_receive(uuid,uuid,text,date,uuid,date,numeric) from public,anon;
grant execute on function hub_private.forecast(uuid,uuid,text,date),hub_private.receive(uuid,uuid,text,date,uuid,date,numeric),
 public.hub_forecast(uuid,uuid,text,date),public.hub_receive(uuid,uuid,text,date,uuid,date,numeric) to authenticated;
commit;
