begin;
create table public.hub_proposals (
 workspace_id uuid not null,
 lead_id uuid not null,
 id uuid not null,
 series_id uuid not null,
 version integer not null check (version > 0),
 meeting_id uuid,
 status text not null default 'Rascunho' check (status in ('Rascunho','Enviada','Negociação','Aceita','Recusada','Expirada','Substituída')),
 record jsonb not null check (jsonb_typeof(record) = 'object'),
 primary key (workspace_id,id),
 unique (workspace_id,lead_id,series_id,version),
 foreign key (workspace_id,lead_id) references public.hub_leads(workspace_id,id),
 foreign key (workspace_id,lead_id,meeting_id) references public.hub_meetings(workspace_id,lead_id,id)
);
alter table public.hub_proposals enable row level security;
revoke all on public.hub_proposals from public, anon, authenticated;
grant select on public.hub_proposals to authenticated;
create policy hub_proposals_read on public.hub_proposals for select to authenticated
 using (workspace_id in (select workspace_id from public.hub_members where user_id = (select auth.uid())));
create index hub_proposals_meeting_idx on public.hub_proposals(workspace_id,lead_id,meeting_id) where meeting_id is not null;

create schema if not exists hub_private;
revoke all on schema hub_private from public, anon;
grant usage on schema hub_private to authenticated;

create function hub_private.save_proposal(w uuid,l uuid,p uuid,s uuid,v integer,m uuid,body jsonb,decision text,occurred date,evidence text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare curr public.hub_proposals%rowtype;
 actual_stage text;
 desired_stage text;
 actor uuid := auth.uid();
begin
 if actor is null or not exists(select 1 from public.hub_members where workspace_id=w and user_id=actor) then return false; end if;
 select stage into actual_stage from public.hub_leads where workspace_id=w and id=l for update;
 if not found then return false; end if;
 select * into curr from public.hub_proposals where workspace_id=w and lead_id=l and series_id=s order by version desc limit 1;
 if decision is null then
  if body is null or jsonb_typeof(body) <> 'object'
     or nullif(btrim(body->>'title'),'') is null or nullif(btrim(body->>'scope'),'') is null
     or (body->>'validity')::date is null or coalesce((body->>'setup')::numeric,-1) not between 0 and 999999999.99
     or coalesce((body->>'monthly')::numeric,-1) not between 0 and 999999999.99
     or coalesce(jsonb_typeof(body->'services'),'') <> 'array' then return false; end if;
  if m is not null and not exists(select 1 from public.hub_meetings where workspace_id=w and lead_id=l and id=m and state='Realizada') then return false; end if;
  body := jsonb_build_object('title',btrim(body->>'title'),'scope',btrim(body->>'scope'),'validity',body->'validity',
      'setup',round((body->>'setup')::numeric,2),'monthly',round((body->>'monthly')::numeric,2),'services',body->'services',
      'terms',coalesce(body->>'terms',''),'events','[]'::jsonb);
  if curr.id=p then
   if curr.status<>'Rascunho' or v is distinct from curr.version then return false; end if;
   update public.hub_proposals set record=body, meeting_id=m where workspace_id=w and id=p;
  else
   if v is distinct from coalesce(curr.version,0)+1 or curr.status='Aceita' or (curr.id is null and p is distinct from s) then return false; end if;
   update public.hub_proposals set status='Substituída' where workspace_id=w and id=curr.id and status in ('Rascunho','Enviada','Negociação');
   insert into public.hub_proposals(workspace_id,lead_id,id,series_id,version,meeting_id,record) values(w,l,p,s,v,m,body);
  end if;
  return true;
 end if;
 if p is null or curr.id is distinct from p or occurred is null or occurred>(now() at time zone 'America/Fortaleza')::date
    or nullif(btrim(evidence),'') is null
    or occurred<coalesce((curr.record->>'decisionAt')::date,occurred)
    or not ((curr.status='Rascunho' and decision='Enviada') or
            (curr.status='Enviada' and decision in ('Negociação','Aceita','Recusada','Expirada')) or
            (curr.status='Negociação' and decision in ('Aceita','Recusada','Expirada'))) then return false; end if;
 if decision='Aceita' and actual_stage in ('Perdido','Arquivado') then return false; end if;
 body := curr.record || jsonb_build_object('decisionAt',occurred,'decisionNote',btrim(evidence),
  'events',(curr.record->'events') || jsonb_build_array(jsonb_build_object('status',decision,'date',occurred,'note',btrim(evidence))));
 if decision='Enviada' then body := body || jsonb_build_object('sentAt',occurred); end if;
 update public.hub_proposals set status=decision, record=body where workspace_id=w and id=p;
 desired_stage := case decision when 'Enviada' then 'Proposta enviada' when 'Negociação' then 'Negociação' when 'Aceita' then 'Ganho' end;
 if array_position(array['Identificado','Em pesquisa','Qualificado','Contato planejado','Abordado','Reunião marcada','Diagnóstico realizado','Proposta enviada','Negociação','Ganho','Perdido','Arquivado'],actual_stage)
  < array_position(array['Identificado','Em pesquisa','Qualificado','Contato planejado','Abordado','Reunião marcada','Diagnóstico realizado','Proposta enviada','Negociação','Ganho','Perdido','Arquivado'],desired_stage) then
  update public.hub_leads set stage=desired_stage where workspace_id=w and id=l;
 end if;
 insert into public.hub_interactions(workspace_id,lead_id,author_id,body)
  values(w,l,actor,format('Proposta · %s · v%s · %s · %s',curr.record->>'title',curr.version,decision,btrim(evidence)));
 return true;
end;
$$;
revoke all on function hub_private.save_proposal(uuid,uuid,uuid,uuid,integer,uuid,jsonb,text,date,text) from public,anon;
grant execute on function hub_private.save_proposal(uuid,uuid,uuid,uuid,integer,uuid,jsonb,text,date,text) to authenticated;
create function public.hub_save_proposal(w uuid,l uuid,p uuid,s uuid,v integer,m uuid,body jsonb,decision text,occurred date,evidence text)
returns boolean language sql security invoker set search_path = '' as $$
 select hub_private.save_proposal(w,l,p,s,v,m,body,decision,occurred,evidence);
$$;
revoke all on function public.hub_save_proposal(uuid,uuid,uuid,uuid,integer,uuid,jsonb,text,date,text) from public,anon;
grant execute on function public.hub_save_proposal(uuid,uuid,uuid,uuid,integer,uuid,jsonb,text,date,text) to authenticated;
commit;
