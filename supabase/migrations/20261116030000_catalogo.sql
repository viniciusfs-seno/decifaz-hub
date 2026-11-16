begin;
create table public.hub_solutions(
 workspace_id uuid not null references public.hub_workspaces(id) on delete cascade,
 id uuid not null default gen_random_uuid(),name text not null check(length(btrim(name)) between 1 and 160),
 category text not null default 'Soluções',description text not null default '',scope_items text[] not null default '{}',
 active boolean not null default true,revision bigint not null default 0,primary key(workspace_id,id)
);
create unique index hub_solution_name on public.hub_solutions(workspace_id,lower(btrim(name)));
alter table public.hub_solutions enable row level security;
revoke all on public.hub_solutions from public,anon,authenticated;
grant select on public.hub_solutions to authenticated;
create policy catalog_read on public.hub_solutions for select to authenticated using(public.hub_can(workspace_id,'commercial'));
create function hub_private.seed_solutions() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.hub_solutions(workspace_id,name,description,scope_items)
 select new.id,n,'Solução a detalhar pela Administração',array[n] from unnest(array['Site institucional','Cardápio digital','Sistema de pedidos','NFC / QR Code','Automações','Painel de TV','Agendamento','Sistema sob medida']) n;
 return new;
end $$;
create trigger hub_workspace_catalog after insert on public.hub_workspaces for each row execute function hub_private.seed_solutions();
insert into public.hub_solutions(workspace_id,name,description,scope_items)
 select w.id,n,'Solução a detalhar pela Administração',array[n] from public.hub_workspaces w cross join unnest(array['Site institucional','Cardápio digital','Sistema de pedidos','NFC / QR Code','Automações','Painel de TV','Agendamento','Sistema sob medida']) n;
create function public.hub_save_solution(w uuid,i uuid,n text,c text,d text,items text[],enabled boolean,expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$declare r public.hub_solutions%rowtype;begin
 if not public.hub_can(w,'admin',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if nullif(btrim(n),'') is null or length(n)>160 or length(d)>10000 or cardinality(items)>100 then raise exception 'Solução inválida';end if;
 if i is null then
  insert into public.hub_solutions(workspace_id,name,category,description,scope_items,active) values(w,btrim(n),c,d,items,enabled) returning * into r;
 else
  select * into r from public.hub_solutions where workspace_id=w and id=i for update;
  if not found then raise exception 'Solução indisponível' using errcode='42501';end if;
  if r.revision is distinct from expected_revision then return jsonb_build_object('status','conflict','current',to_jsonb(r));end if;
  update public.hub_solutions set name=btrim(n),category=c,description=d,scope_items=items,active=enabled,revision=revision+1 where workspace_id=w and id=i returning * into r;
 end if;
 return jsonb_build_object('status','saved','current',to_jsonb(r));
end $$;
revoke all on function public.hub_save_solution(uuid,uuid,text,text,text,text[],boolean,bigint) from public,anon;
grant execute on function public.hub_save_solution(uuid,uuid,text,text,text,text[],boolean,bigint) to authenticated;

-- Preserve one non-financial catalogue snapshot inside the existing proposal
-- record. The existing financial guard/lead lock/versioning RPC is unchanged.
create function hub_private.proposal_catalog_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare prior jsonb; snapshots jsonb:='[]'; item jsonb; label text; solution public.hub_solutions%rowtype;
begin
 if auth.uid() is null then return new;end if; -- trusted maintenance/imports; app paths always carry a subject
 if tg_op='UPDATE' then prior:=old.record;else
  select record into prior from public.hub_proposals where workspace_id=new.workspace_id and lead_id=new.lead_id and series_id=new.series_id and id<>new.id order by version desc limit 1;
 end if;
 for label in select distinct jsonb_array_elements_text(coalesce(new.record->'services','[]')) loop
  select value into item from jsonb_array_elements(coalesce(prior->'catalog_snapshot','[]')) where value->>'name'=label limit 1;
  if item is null then
   select * into solution from public.hub_solutions where workspace_id=new.workspace_id and name=label and active;
   if not found then
    if coalesce(prior->'services','[]') ? label then item:=jsonb_build_object('name',label,'legacy',true);
    else raise exception 'Selecione uma solução ativa do catálogo' using errcode='22023';end if;
   else item:=jsonb_build_object('id',solution.id,'name',solution.name,'category',solution.category,'description',solution.description,'scope_items',solution.scope_items,'revision',solution.revision);end if;
  end if;
  snapshots:=snapshots||jsonb_build_array(item);item:=null;
 end loop;
 new.record:=new.record||jsonb_build_object('catalog_snapshot',snapshots);return new;
end $$;
create trigger hub_proposal_catalog before insert or update of record on public.hub_proposals for each row execute function hub_private.proposal_catalog_snapshot();
create function hub_private.triage_catalog_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare label text; prior jsonb:='[]';begin
 if auth.uid() is null then return new;end if;
 if tg_op='UPDATE' then prior:=coalesce(old.record->'services','[]');end if;
 for label in select jsonb_array_elements_text(coalesce(new.record->'services','[]')) loop
  if not (prior ? label) and not exists(select 1 from public.hub_solutions where workspace_id=new.workspace_id and name=label and active) then
   raise exception 'Selecione uma solução ativa do catálogo' using errcode='22023';end if;
 end loop;
 return new;
end $$;
create trigger hub_triage_catalog before insert or update of record on public.hub_triages for each row execute function hub_private.triage_catalog_guard();
commit;
