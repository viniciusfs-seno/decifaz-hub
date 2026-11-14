begin;
alter table public.hub_receipts
 add column reversed_at timestamptz,
 add column reversed_by uuid,
 add column reversal_reason text,
 add check ((reversed_at is null and reversed_by is null and reversal_reason is null) or
            (reversed_at is not null and reversed_by is not null and nullif(btrim(reversal_reason),'') is not null));

create table public.hub_expenses (
 workspace_id uuid not null references public.hub_workspaces(id),
 id uuid not null,
 title text not null check (btrim(title) <> ''),
 due_on date not null,
 amount numeric(12,2) not null check (amount > 0),
 paid_on date,
 paid_amount numeric(12,2) check (paid_amount > 0),
 primary key(workspace_id,id),
 check ((paid_on is null) = (paid_amount is null))
);
alter table public.hub_expenses enable row level security;
revoke all on public.hub_expenses from public,anon,authenticated;
grant select,insert(workspace_id,id,title,due_on,amount),update(paid_on,paid_amount) on public.hub_expenses to authenticated;
create policy hub_expenses_read on public.hub_expenses for select to authenticated
 using (workspace_id in (select workspace_id from public.hub_members where user_id=(select auth.uid())));
create policy hub_expenses_insert on public.hub_expenses for insert to authenticated
 with check (workspace_id in (select workspace_id from public.hub_members where user_id=(select auth.uid())));
create policy hub_expenses_settle on public.hub_expenses for update to authenticated
 using (paid_on is null and workspace_id in (select workspace_id from public.hub_members where user_id=(select auth.uid())))
 with check (paid_on <= (now() at time zone 'America/Fortaleza')::date and workspace_id in (select workspace_id from public.hub_members where user_id=(select auth.uid())));

create function hub_private.reverse_receipt(w uuid,p uuid,k text,m date,i uuid,reason text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or nullif(btrim(reason),'') is null or not exists(
  select 1 from public.hub_members where workspace_id=w and user_id=auth.uid()
 ) then return false; end if;
 perform 1 from public.hub_receivables where workspace_id=w and proposal_id=p and kind=k and period=m for update;
 if not found then return false; end if;
 update public.hub_receipts set reversed_at=now(),reversed_by=auth.uid(),reversal_reason=btrim(reason)
 where workspace_id=w and proposal_id=p and kind=k and period=m and id=i and reversed_at is null;
 return found;
end;
$$;
create function public.hub_reverse_receipt(w uuid,p uuid,k text,m date,i uuid,reason text)
returns boolean language sql security invoker set search_path='' as $$
 select hub_private.reverse_receipt(w,p,k,m,i,reason);
$$;
revoke all on function hub_private.reverse_receipt(uuid,uuid,text,date,uuid,text),public.hub_reverse_receipt(uuid,uuid,text,date,uuid,text) from public,anon;
grant execute on function hub_private.reverse_receipt(uuid,uuid,text,date,uuid,text),public.hub_reverse_receipt(uuid,uuid,text,date,uuid,text) to authenticated;
create or replace function hub_private.receive(w uuid,p uuid,k text,m date,i uuid,d date,a numeric)
returns boolean language plpgsql security definer set search_path='' as $$
declare expected numeric; recorded numeric;
begin
 if auth.uid() is null or not exists(select 1 from public.hub_members where workspace_id=w and user_id=auth.uid()) then return false; end if;
 if i is null or a is null or a<=0 or a<>round(a,2) or d is null or d>(now() at time zone 'America/Fortaleza')::date then return false; end if;
 select amount into expected from public.hub_receivables
 where workspace_id=w and proposal_id=p and kind=k and period=m for update;
 if not found then return false; end if;
 if exists(select 1 from public.hub_receipts where workspace_id=w and proposal_id=p and kind=k and period=m and id=i) then
  return exists(select 1 from public.hub_receipts where workspace_id=w and proposal_id=p and kind=k and period=m and id=i and amount=a and received_on=d and reversed_at is null);
 end if;
 select coalesce(sum(amount),0) into recorded from public.hub_receipts where workspace_id=w and proposal_id=p and kind=k and period=m and reversed_at is null;
 if a+recorded>expected then return false; end if;
 insert into public.hub_receipts(workspace_id,proposal_id,kind,period,id,received_on,amount) values(w,p,k,m,i,d,a);
 return true;
end;
$$;
commit;
