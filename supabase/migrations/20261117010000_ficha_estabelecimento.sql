begin;
alter table public.hub_leads add column revision bigint not null default 0;
create table public.hub_lead_audit(
 id bigint generated always as identity primary key,
 workspace_id uuid not null references public.hub_workspaces(id),
 lead_id uuid not null, actor_id uuid, occurred_at timestamptz not null default clock_timestamp(),
 before_record jsonb, after_record jsonb not null
);
alter table public.hub_lead_audit enable row level security;
revoke all on public.hub_lead_audit from public,anon,authenticated;
grant select on public.hub_lead_audit to authenticated;
create policy lead_audit_admin on public.hub_lead_audit for select to authenticated
 using(public.hub_can(workspace_id,'admin'));
create index hub_lead_audit_recent on public.hub_lead_audit(workspace_id,lead_id,occurred_at desc,id desc);
create function hub_private.lead_revision() returns trigger language plpgsql set search_path='' as $$
begin
 new.revision:=case when TG_OP='INSERT' then 0 else old.revision+1 end;
 return new;
end $$;
create function hub_private.audit_lead() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.hub_lead_audit(workspace_id,lead_id,actor_id,before_record,after_record)
 values(new.workspace_id,new.id,auth.uid(),case when TG_OP='UPDATE' then to_jsonb(old) end,to_jsonb(new));
 return new;
end $$;
revoke all on function hub_private.lead_revision(),hub_private.audit_lead() from public,anon,authenticated;
create trigger hub_lead_revision before insert or update on public.hub_leads for each row execute function hub_private.lead_revision();
create trigger hub_lead_audit after insert or update on public.hub_leads for each row execute function hub_private.audit_lead();
create function public.hub_save_lead(w uuid,l uuid,expected_revision bigint,body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actual public.hub_leads; patch jsonb; k text;
begin
 if not public.hub_can(w,'commercial',true) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if jsonb_typeof(body) is distinct from 'object' or nullif(btrim(body->>'name'),'') is null or length(body::text)>40000
 or exists(select 1 from jsonb_object_keys(body) x where x not in ('name','segment','city','notes','profile')) then
  raise exception 'Cadastro inválido' using errcode='22023'; end if;
 patch:=coalesce(body->'profile','{}'::jsonb);
 if jsonb_typeof(patch) is distinct from 'object' then raise exception 'Perfil inválido' using errcode='22023'; end if;
 for k in select jsonb_object_keys(patch) loop
  if k not in ('region','address','instagram','website','whatsapp','other','contact','contactInfo','origin','verification','owner','next','due','noDueReason','needs','services') then
   raise exception 'Campo inválido' using errcode='22023'; end if;
  if k='services' then
   if jsonb_typeof(patch->k) is distinct from 'array' or exists(select 1 from jsonb_array_elements(patch->k) v where jsonb_typeof(v)<>'string') then
    raise exception 'Serviços inválidos' using errcode='22023'; end if;
  elsif jsonb_typeof(patch->k) is distinct from 'string' then raise exception 'Campo inválido' using errcode='22023'; end if;
 end loop;
 if coalesce(patch->>'due','')<>'' then perform (patch->>'due')::date; end if;
 if l is null then
  if expected_revision is not null then raise exception 'Revisão inválida' using errcode='22023'; end if;
  insert into public.hub_leads(workspace_id,name,segment,city,notes,profile)
  values(w,btrim(body->>'name'),coalesce(body->>'segment',''),coalesce(body->>'city',''),coalesce(body->>'notes',''),patch) returning * into actual;
 else
  select * into actual from public.hub_leads where workspace_id=w and id=l for update;
  if not found then raise exception 'Registro indisponível' using errcode='42501'; end if;
  if expected_revision is null or expected_revision<>actual.revision then return jsonb_build_object('status','conflict','current',to_jsonb(actual)); end if;
  update public.hub_leads set name=btrim(body->>'name'),segment=coalesce(body->>'segment',segment),city=coalesce(body->>'city',city),
   notes=coalesce(body->>'notes',notes),profile=profile||patch where workspace_id=w and id=l returning * into actual;
 end if;
 return jsonb_build_object('status','saved','current',to_jsonb(actual));
end $$;
revoke all on function public.hub_save_lead(uuid,uuid,bigint,jsonb) from public,anon;
grant execute on function public.hub_save_lead(uuid,uuid,bigint,jsonb) to authenticated;
commit;
