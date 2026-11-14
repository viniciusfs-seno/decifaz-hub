begin;
create table public.hub_finance_audit (
 workspace_id uuid not null references public.hub_workspaces(id),
 id uuid not null default gen_random_uuid(),
 occurred_at timestamptz not null default now(),
 actor_id uuid,
 entity text not null,
 operation text not null,
 before_record jsonb,
 after_record jsonb,
 primary key(workspace_id,id)
);
alter table public.hub_finance_audit enable row level security;
revoke all on public.hub_finance_audit from public,anon,authenticated;
grant select on public.hub_finance_audit to authenticated;
create policy hub_finance_audit_read on public.hub_finance_audit for select to authenticated using (
 workspace_id in (select workspace_id from public.hub_members where user_id=(select auth.uid()))
);
create index hub_finance_audit_recent on public.hub_finance_audit(workspace_id,occurred_at desc,id);
create function hub_private.audit_finance()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.hub_finance_audit(workspace_id,actor_id,entity,operation,before_record,after_record)
 values(new.workspace_id,auth.uid(),tg_table_name,tg_op,
        case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
 return new;
end;
$$;
revoke all on function hub_private.audit_finance() from public,anon,authenticated;
create trigger hub_audit_forecast after insert or update on public.hub_receivables for each row execute function hub_private.audit_finance();
create trigger hub_audit_receipt after insert or update on public.hub_receipts for each row execute function hub_private.audit_finance();
create trigger hub_audit_expense after insert or update on public.hub_expenses for each row execute function hub_private.audit_finance();
commit;
