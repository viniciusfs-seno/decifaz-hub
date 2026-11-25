begin;
-- Same scheduler, preferences and inbox. No commercial email enqueueing.
create function hub_private.notice_commercial_date(value text) returns date language plpgsql immutable set search_path='' as $$
begin if value is null or value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return null;end if;return value::date;exception when invalid_datetime_format or datetime_field_overflow then return null;end $$;
revoke all on function hub_private.notice_commercial_date(text) from public,anon,authenticated;
create function hub_private.commercial_due_sources(w uuid)
returns table(source_key text,kind text,record_id uuid,title text,owner text,owner_id uuid,due_on date,category text,project_id uuid,contract_id uuid,financial boolean,amount numeric,paid numeric,state text,revision bigint,pending boolean,remind boolean)
language sql stable security definer set search_path='' as $$
 select 'commercial-activity:'||a.id,'commercial-activity',a.id,a.title,a.owner,a.assigned_user_id,a.due_on,
 case when l.profile->>'commercial_outcome'='resume' and hub_private.notice_commercial_date(l.profile->>'resume_on')=a.due_on and l.profile->>'next'=a.title then 'Retomada comercial' else 'Atividade comercial' end,
 null::uuid,null::uuid,false,null::numeric,null::numeric,a.status,a.revision,a.status in('Pendente','Em andamento') and l.stage not in('Ganho','Perdido','Arquivado'),a.status in('Pendente','Em andamento') and l.stage not in('Ganho','Perdido','Arquivado')
 from public.hub_activities a join public.hub_leads l on (l.workspace_id,l.id)=(a.workspace_id,a.lead_id)
 where a.workspace_id=w and a.project_proposal_id is null and not a.support and a.due_on is not null
 union all
 select 'commercial-contact:'||l.id,case when l.profile->>'commercial_outcome'='resume' then 'commercial-resume' else 'commercial-contact' end,l.id,l.profile->>'next',coalesce(l.profile->>'owner',''),nullif(l.profile->>'owner_id','')::uuid,hub_private.notice_commercial_date(l.profile->>'due'),
 case when l.profile->>'commercial_outcome'='resume' then 'Retomada comercial' else 'Contato programado' end,null::uuid,null::uuid,false,null::numeric,null::numeric,l.stage,l.revision,l.stage not in('Ganho','Perdido','Arquivado'),l.stage not in('Ganho','Perdido','Arquivado')
 from public.hub_leads l where l.workspace_id=w and nullif(btrim(l.profile->>'next'),'') is not null and hub_private.notice_commercial_date(l.profile->>'due') is not null
 and not exists(select 1 from public.hub_activities a where a.workspace_id=w and a.lead_id=l.id and lower(btrim(a.title))=lower(btrim(l.profile->>'next')) and a.due_on=hub_private.notice_commercial_date(l.profile->>'due'));
$$;
revoke all on function hub_private.commercial_due_sources(uuid) from public,anon,authenticated;
create or replace function hub_private.due_sources(w uuid)
returns table(source_key text,kind text,record_id uuid,title text,owner text,owner_id uuid,due_on date,category text,project_id uuid,contract_id uuid,financial boolean,amount numeric,paid numeric,state text,revision bigint,pending boolean,remind boolean)
language sql stable security definer set search_path='' as $$
 select 'bill:'||b.id,'bill',b.id,o.title,o.owner,o.owner_id,b.due_on,o.category,o.project_id,o.contract_id,true,b.amount,b.paid_amount,b.status,b.revision,b.status='Prevista',b.status='Prevista' and o.status='Ativa'
 from public.hub_internal_bills b join public.hub_internal_obligations o on (o.workspace_id,o.id)=(b.workspace_id,b.obligation_id) where b.workspace_id=w
 union all
 select 'subscription:'||o.id,'subscription',o.id,o.title||' · limite de cancelamento',o.owner,o.owner_id,o.cancel_by,o.category,o.project_id,o.contract_id,true,null::numeric,null::numeric,o.status,o.revision,o.status='Ativa',o.status='Ativa'
 from public.hub_internal_obligations o where o.workspace_id=w and o.cancel_by is not null
 union all
 select 'contract-end:'||c.id,'contract-end',c.id,c.title||' · término',c.owner,c.owner_id,c.ends_on,'Contrato',c.project_ids[1],c.id,false,null::numeric,null::numeric,c.status,c.revision,c.status='Vigente',c.status='Vigente'
 from public.hub_contracts c where c.workspace_id=w and c.ends_on is not null
 union all
 select 'contract-renew:'||c.id,'contract-renew',c.id,c.title||' · renovação',c.owner,c.owner_id,c.renews_on,'Contrato',c.project_ids[1],c.id,false,null::numeric,null::numeric,c.status,c.revision,c.status='Vigente',c.status='Vigente'
 from public.hub_contracts c where c.workspace_id=w and c.renews_on is not null
 union all
 select 'contract-notice:'||c.id,'contract-notice',c.id,c.title||' · aviso de cancelamento',c.owner,c.owner_id,c.ends_on-c.cancel_notice_days,'Aviso contratual',c.project_ids[1],c.id,false,null::numeric,null::numeric,c.status,c.revision,c.status='Vigente',c.status='Vigente'
 from public.hub_contracts c where c.workspace_id=w and c.ends_on is not null
 union all
 select 'contract-renew-notice:'||c.id,'contract-renew-notice',c.id,c.title||' · aviso de renovação',c.owner,c.owner_id,c.renews_on-c.notice_days,'Aviso contratual',c.project_ids[1],c.id,false,null::numeric,null::numeric,c.status,c.revision,c.status='Vigente',c.status='Vigente'
 from public.hub_contracts c where c.workspace_id=w and c.renews_on is not null
 union all
 select 'expense:'||e.id,'expense',e.id,e.title,'Sem responsável vinculado',null::uuid,e.due_on,'Despesa avulsa',null::uuid,null::uuid,true,e.amount,e.paid_amount,case when e.paid_on is null then 'Prevista' else 'Paga' end,0::bigint,e.paid_on is null,e.paid_on is null
 from public.hub_expenses e where e.workspace_id=w
 union all
 select 'forecast:'||r.proposal_id||':'||r.kind||':'||r.period,'forecast',r.proposal_id,coalesce(p.approved->>'title','Projeto')||' · '||r.kind,p.owner,null::uuid,r.due_on,'Receita prevista',r.proposal_id,null::uuid,true,r.amount,coalesce(x.received,0),case when coalesce(x.received,0)>=r.amount then 'Recebida' else 'Prevista' end,0::bigint,coalesce(x.received,0)<r.amount,coalesce(x.received,0)<r.amount
 from public.hub_receivables r join public.hub_projects p on (p.workspace_id,p.proposal_id)=(r.workspace_id,r.proposal_id)
 left join lateral(select sum(t.amount) received from public.hub_receipts t where (t.workspace_id,t.proposal_id,t.kind,t.period)=(r.workspace_id,r.proposal_id,r.kind,r.period) and t.reversed_at is null)x on true where r.workspace_id=w
 union all select * from hub_private.commercial_due_sources(w)
$$;
create or replace function hub_private.generate_notices(w uuid,at_time timestamptz) returns integer language plpgsql security definer set search_path='' as $$
declare today date:=(at_time at time zone 'America/Fortaleza')::date;h integer:=extract(hour from at_time at time zone 'America/Fortaleza');m record;s record;p record;n public.hub_notices;threshold integer;processed integer:=0;o uuid;run_id bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(w::text||'notices',0));
 insert into hub_private.notice_runs(workspace_id,started_at,state) values(w,at_time,'running') returning id into run_id;
 for o in select id from public.hub_internal_obligations where workspace_id=w and status='Ativa' order by id loop
  begin perform hub_private.generate_obligation(w,o,today+366);
  exception when others then update hub_private.notice_runs set error_code='occurrence_generation' where id=run_id;end;
 end loop;
 update public.hub_notices inbox set resolved_at=coalesce(inbox.resolved_at,at_time),resolution='Origem, atribuição ou acesso atualizado'
 where inbox.workspace_id=w and inbox.resolved_at is null and not exists(select 1 from hub_private.due_sources(w) src where src.source_key=inbox.source_key and src.due_on=inbox.due_on and src.remind and hub_private.notice_access(w,inbox.user_id,src.financial) and (src.kind not like 'commercial-%' or coalesce((select pref.internal_enabled from public.hub_notice_preferences pref where pref.workspace_id=w and pref.user_id=inbox.user_id),true)) and (coalesce((select pref.watch_scope from public.hub_notice_preferences pref where pref.workspace_id=w and pref.user_id=inbox.user_id),'space')='space' or src.owner_id=inbox.user_id));
 for m in select user_id from public.hub_members where workspace_id=w and active order by user_id loop
  select coalesce(x.internal_enabled,true) internal_enabled,coalesce(x.email_enabled,false) email_enabled,coalesce(x.lead_days,array[30,7,1,0]) lead_days,
   coalesce(x.daily_digest,true) daily_digest,coalesce(x.digest_hour,9) digest_hour,coalesce(x.watch_scope,'space') watch_scope
   into p from (select 1)z left join public.hub_notice_preferences x on x.workspace_id=w and x.user_id=m.user_id;
  if not p.internal_enabled and not p.email_enabled then continue;end if;
  for s in select * from hub_private.due_sources(w) x where x.remind and (p.internal_enabled or x.kind not like 'commercial-%') and hub_private.notice_access(w,m.user_id,x.financial) and (p.watch_scope='space' or x.owner_id=m.user_id) order by due_on,source_key loop
   select min(d) into threshold from unnest(p.lead_days)d where s.due_on-today<=d;
   if threshold is null then continue;end if;
   insert into public.hub_notices(workspace_id,user_id,source_key,kind,record_id,due_on,financial,stage,stage_at)
    values(w,m.user_id,s.source_key,s.kind,s.record_id,s.due_on,s.financial,threshold,at_time)
    on conflict(workspace_id,user_id,source_key,due_on) do update set
     read_at=case when excluded.stage<hub_notices.stage or hub_notices.resolved_at is not null then null else hub_notices.read_at end,
     stage_at=case when excluded.stage<hub_notices.stage or hub_notices.resolved_at is not null then at_time else hub_notices.stage_at end,
     stage=least(hub_notices.stage,excluded.stage),resolved_at=null,resolution=null
    returning * into n;
   processed:=processed+1;
   if p.email_enabled and not p.daily_digest and s.kind not like 'commercial-%' then
    insert into hub_private.notice_outbox(workspace_id,user_id,notice_id,stage,dedupe)
     values(w,m.user_id,n.id,n.stage,'notice:'||n.id||':'||n.stage) on conflict(dedupe) do nothing;
   end if;
  end loop;
  if p.internal_enabled and p.daily_digest and h>=p.digest_hour then
   insert into hub_private.notice_summaries(workspace_id,user_id,day) values(w,m.user_id,today) on conflict do nothing;
  end if;
  if p.email_enabled and p.daily_digest and h>=p.digest_hour and exists(select 1 from public.hub_notices inbox join hub_private.due_sources(w) src on src.source_key=inbox.source_key and src.due_on=inbox.due_on where inbox.workspace_id=w and inbox.user_id=m.user_id and src.remind and src.kind not like 'commercial-%' and src.due_on<=today+(select max(d) from unnest(p.lead_days)d) and hub_private.notice_access(w,m.user_id,src.financial) and (p.watch_scope='space' or src.owner_id=m.user_id)) then
   insert into hub_private.notice_outbox(workspace_id,user_id,digest_on,dedupe) values(w,m.user_id,today,'digest:'||w||':'||m.user_id||':'||today) on conflict(dedupe) do nothing;
  end if;
 end loop;
 update hub_private.notice_runs set finished_at=clock_timestamp(),created=processed,state=case when error_code is null then 'completed' else 'partial' end where id=run_id;
 return processed;
end $$;
create or replace function hub_private.mail_eligible(o hub_private.notice_outbox) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hub_members m join auth.users u on u.id=m.user_id join public.hub_notice_preferences p on (p.workspace_id,p.user_id)=(m.workspace_id,m.user_id)
 where (m.workspace_id,m.user_id)=(o.workspace_id,o.user_id) and m.active and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now()) and p.email_enabled
 and (o.digest_on is null or p.daily_digest and o.digest_on=(clock_timestamp() at time zone 'America/Fortaleza')::date) and (o.notice_id is null or not p.daily_digest)
 and exists(select 1 from public.hub_notices n join hub_private.due_sources(o.workspace_id) s on s.source_key=n.source_key and s.due_on=n.due_on
  where n.workspace_id=o.workspace_id and n.user_id=o.user_id and s.remind and s.kind not like 'commercial-%' and s.due_on<=(clock_timestamp() at time zone 'America/Fortaleza')::date+(select max(d) from unnest(p.lead_days)d) and n.resolved_at is null and hub_private.notice_access(o.workspace_id,o.user_id,s.financial)
   and (p.watch_scope='space' or s.owner_id=o.user_id) and (o.notice_id is null or (n.id=o.notice_id and n.stage=o.stage))))
$$;
create or replace function public.hub_notice_prepare(i uuid,l uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o hub_private.notice_outbox;e text;hashed bytea;
begin
 select * into o from hub_private.notice_outbox where id=i and lease=l and state='processing' and lease_until>clock_timestamp() for update;
 if not found then return null;end if;
 if not exists(select 1 from hub_private.notice_settings where generation_enabled and mail_enabled) or not hub_private.mail_eligible(o) then
  update hub_private.notice_outbox set state='suppressed',error_code='source_or_authorization' where id=i;return null;end if;
 select email into e from auth.users where id=o.user_id;hashed:=extensions.digest(e,'sha256');
 if o.email_hash is not null and o.email_hash<>hashed then update hub_private.notice_outbox set state='suppressed',error_code='recipient_changed' where id=i;return null;end if;
 if o.first_attempt_at<clock_timestamp()-interval '23 hours' and o.attempts>1 then update hub_private.notice_outbox set state='uncertain',error_code='idempotency_window' where id=i;return null;end if;
 update hub_private.notice_outbox set email_hash=hashed where id=i;
 return jsonb_build_object('id',o.id,'to',e,'envelope',o.envelope,'provider',o.provider,'sandbox_only',(select sandbox_only from hub_private.notice_settings));
end $$;
create or replace function public.hub_list_notices(w uuid,skip integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 if skip<0 or skip>100000 then raise exception 'Página inválida' using errcode='22023';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by sort_at desc,id),'[]') from(
 select n.*,coalesce(s.title,'Acompanhamento atualizado na origem') title,s.owner,s.owner_id,s.category,s.project_id,s.contract_id,greatest(n.created_at,n.stage_at) sort_at,
 case when s.source_key is null or s.due_on is distinct from n.due_on or not s.remind or (coalesce(p.watch_scope,'space')='mine' and s.owner_id is distinct from auth.uid()) or (n.kind like 'commercial-%' and not coalesce(p.internal_enabled,true)) then coalesce(n.resolved_at,now()) else n.resolved_at end effective_resolved_at
 from public.hub_notices n left join hub_private.due_sources(w) s on s.source_key=n.source_key left join public.hub_notice_preferences p on p.workspace_id=w and p.user_id=n.user_id
 where n.workspace_id=w and n.user_id=auth.uid() and (not n.financial or public.hub_can(w,'finance')) order by greatest(n.created_at,n.stage_at) desc,n.id limit 50 offset skip)x);
end $$;
notify pgrst,'reload schema';
commit;
