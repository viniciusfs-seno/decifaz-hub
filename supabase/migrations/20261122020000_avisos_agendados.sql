begin;
create table hub_private.notice_settings(
 id boolean primary key default true check(id),generation_enabled boolean not null default false,mail_enabled boolean not null default false,sandbox_only boolean not null default true
);
insert into hub_private.notice_settings default values;
create table hub_private.notice_runs(
 id bigint generated always as identity primary key,workspace_id uuid not null,started_at timestamptz not null,finished_at timestamptz,state text not null,created integer not null default 0,error_code text
);
create table hub_private.notice_outbox(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,user_id uuid not null,notice_id uuid references public.hub_notices(id) on delete cascade,stage integer,digest_on date,dedupe text not null unique,
 state text not null default 'pending' check(state in ('pending','processing','accepted','delivered','failed','uncertain','suppressed')),
 attempts integer not null default 0 check(attempts between 0 and 5),total_attempts integer not null default 0,cycles integer not null default 0,
 next_attempt_at timestamptz not null default clock_timestamp(),lease uuid,lease_until timestamptz,first_attempt_at timestamptz,
 envelope jsonb,email_hash bytea,provider text check(provider in ('mailpit','resend')),provider_id text,
 created_at timestamptz not null default clock_timestamp(),accepted_at timestamptz,delivered_at timestamptz,error_code text,
 foreign key(workspace_id,user_id) references public.hub_members(workspace_id,user_id) on delete cascade
);
create index notice_outbox_ready on hub_private.notice_outbox(next_attempt_at,id) where state='pending';
create table hub_private.notice_attempts(
 id bigint generated always as identity primary key,outbox_id uuid not null references hub_private.notice_outbox(id) on delete cascade,
 occurred_at timestamptz not null default clock_timestamp(),actor_id uuid,state text not null,attempt integer not null,code text
);
create table hub_private.notice_delivery_events(
 event_id text primary key,provider_id text not null,outcome text not null check(outcome in ('delivered','bounced')),occurred_at timestamptz not null default clock_timestamp()
);
create table hub_private.notice_summaries(workspace_id uuid not null,user_id uuid not null,day date not null,created_at timestamptz not null default clock_timestamp(),primary key(workspace_id,user_id,day),foreign key(workspace_id,user_id) references public.hub_members(workspace_id,user_id) on delete cascade);
revoke all on hub_private.notice_summaries from public,anon,authenticated;
revoke all on hub_private.notice_settings,hub_private.notice_runs,hub_private.notice_outbox,hub_private.notice_attempts,hub_private.notice_delivery_events from public,anon,authenticated;

create function hub_private.notice_journal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.state is distinct from old.state then
  insert into hub_private.notice_attempts(outbox_id,actor_id,state,attempt,code) values(new.id,auth.uid(),new.state,new.total_attempts,new.error_code);
 end if;return new;
end $$;
revoke all on function hub_private.notice_journal() from public,anon,authenticated;
create trigger notice_journal after insert or update on hub_private.notice_outbox for each row execute function hub_private.notice_journal();

-- A notice keeps its identity. Approaching a new configured threshold resurfaces
-- it once (read_at cleared); missed thresholds catch up to the closest one.
create function hub_private.generate_notices(w uuid,at_time timestamptz) returns integer language plpgsql security definer set search_path='' as $$
declare today date:=(at_time at time zone 'America/Fortaleza')::date;h integer:=extract(hour from at_time at time zone 'America/Fortaleza');m record;s record;p record;n public.hub_notices;threshold integer;processed integer:=0;o uuid;run_id bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(w::text||'notices',0));
 insert into hub_private.notice_runs(workspace_id,started_at,state) values(w,at_time,'running') returning id into run_id;
 for o in select id from public.hub_internal_obligations where workspace_id=w and status='Ativa' order by id loop
  begin perform hub_private.generate_obligation(w,o,today+366);
  exception when others then update hub_private.notice_runs set error_code='occurrence_generation' where id=run_id;end;
 end loop;
 update public.hub_notices inbox set resolved_at=coalesce(inbox.resolved_at,at_time),resolution='Atualizado ou encerrado na origem'
 where inbox.workspace_id=w and inbox.resolved_at is null and not exists(select 1 from hub_private.due_sources(w) src where src.source_key=inbox.source_key and src.due_on=inbox.due_on and src.remind);
 for m in select user_id from public.hub_members where workspace_id=w and active order by user_id loop
  select coalesce(x.internal_enabled,true) internal_enabled,coalesce(x.email_enabled,false) email_enabled,coalesce(x.lead_days,array[30,7,1,0]) lead_days,
   coalesce(x.daily_digest,true) daily_digest,coalesce(x.digest_hour,9) digest_hour,coalesce(x.watch_scope,'space') watch_scope
   into p from (select 1)z left join public.hub_notice_preferences x on x.workspace_id=w and x.user_id=m.user_id;
  if not p.internal_enabled and not p.email_enabled then continue;end if;
  for s in select * from hub_private.due_sources(w) x where x.remind and hub_private.notice_access(w,m.user_id,x.financial) and (p.watch_scope='space' or x.owner_id=m.user_id) order by due_on,source_key loop
   select min(d) into threshold from unnest(p.lead_days)d where s.due_on-today<=d;
   if threshold is null then continue;end if;
   insert into public.hub_notices(workspace_id,user_id,source_key,kind,record_id,due_on,financial,stage,stage_at)
    values(w,m.user_id,s.source_key,s.kind,s.record_id,s.due_on,s.financial,threshold,at_time)
    on conflict(workspace_id,user_id,source_key,due_on) do update set
     read_at=case when excluded.stage<hub_notices.stage then null else hub_notices.read_at end,
     stage_at=case when excluded.stage<hub_notices.stage then at_time else hub_notices.stage_at end,
     stage=least(hub_notices.stage,excluded.stage),resolved_at=null,resolution=null
    returning * into n;
   processed:=processed+1;
   if p.email_enabled and not p.daily_digest then
    insert into hub_private.notice_outbox(workspace_id,user_id,notice_id,stage,dedupe)
     values(w,m.user_id,n.id,n.stage,'notice:'||n.id||':'||n.stage) on conflict(dedupe) do nothing;
   end if;
  end loop;
  if p.internal_enabled and p.daily_digest and h>=p.digest_hour then
   insert into hub_private.notice_summaries(workspace_id,user_id,day) values(w,m.user_id,today) on conflict do nothing;
  end if;
  if p.email_enabled and p.daily_digest and h>=p.digest_hour and exists(select 1 from public.hub_notices inbox join hub_private.due_sources(w) src on src.source_key=inbox.source_key and src.due_on=inbox.due_on where inbox.workspace_id=w and inbox.user_id=m.user_id and src.remind and src.due_on<=today+(select max(d) from unnest(p.lead_days)d) and hub_private.notice_access(w,m.user_id,src.financial) and (p.watch_scope='space' or src.owner_id=m.user_id)) then
   insert into hub_private.notice_outbox(workspace_id,user_id,digest_on,dedupe) values(w,m.user_id,today,'digest:'||w||':'||m.user_id||':'||today) on conflict(dedupe) do nothing;
  end if;
 end loop;
 update hub_private.notice_runs set finished_at=clock_timestamp(),created=processed,state=case when error_code is null then 'completed' else 'partial' end where id=run_id;
 return processed;
end $$;
revoke all on function hub_private.generate_notices(uuid,timestamptz) from public,anon,authenticated;

create function hub_private.notice_tick() returns integer language plpgsql security definer set search_path='' as $$
declare w uuid;n integer:=0;
begin
 if not (select generation_enabled from hub_private.notice_settings) then return 0;end if;
 for w in select id from public.hub_workspaces order by id loop
  begin n:=n+hub_private.generate_notices(w,clock_timestamp());exception when others then
   insert into hub_private.notice_runs(workspace_id,started_at,finished_at,state,error_code) values(w,clock_timestamp(),clock_timestamp(),'failed','generation_failed');
  end;
 end loop;return n;
end $$;
revoke all on function hub_private.notice_tick() from public,anon,authenticated;
create function public.hub_notice_generate() returns integer language sql security definer set search_path='' as $$ select hub_private.notice_tick() $$;

create function hub_private.mail_eligible(o hub_private.notice_outbox) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hub_members m join auth.users u on u.id=m.user_id join public.hub_notice_preferences p on (p.workspace_id,p.user_id)=(m.workspace_id,m.user_id)
 where (m.workspace_id,m.user_id)=(o.workspace_id,o.user_id) and m.active and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<now()) and p.email_enabled
 and (o.digest_on is null or p.daily_digest and o.digest_on=(clock_timestamp() at time zone 'America/Fortaleza')::date) and (o.notice_id is null or not p.daily_digest)
 and exists(select 1 from public.hub_notices n join hub_private.due_sources(o.workspace_id) s on s.source_key=n.source_key and s.due_on=n.due_on
  where n.workspace_id=o.workspace_id and n.user_id=o.user_id and s.remind and s.due_on<=(clock_timestamp() at time zone 'America/Fortaleza')::date+(select max(d) from unnest(p.lead_days)d) and n.resolved_at is null and hub_private.notice_access(o.workspace_id,o.user_id,s.financial)
   and (p.watch_scope='space' or s.owner_id=o.user_id) and (o.notice_id is null or (n.id=o.notice_id and n.stage=o.stage))))
$$;
revoke all on function hub_private.mail_eligible(hub_private.notice_outbox) from public,anon,authenticated;

create function public.hub_notice_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare o hub_private.notice_outbox;i integer:=0;
begin
 if not exists(select 1 from hub_private.notice_settings where generation_enabled and mail_enabled) then return null;end if;
 update hub_private.notice_outbox set state='uncertain',error_code='lease_expired' where state='processing' and lease_until<clock_timestamp();
 loop
  select * into o from hub_private.notice_outbox where state='pending' and attempts<5 and next_attempt_at<=clock_timestamp() order by next_attempt_at,id for update skip locked limit 1;
  if not found then return null;end if;
  if not hub_private.mail_eligible(o) then update hub_private.notice_outbox set state='suppressed',error_code='source_or_authorization' where id=o.id;i:=i+1;if i>=50 then return null;end if;continue;end if;
  update hub_private.notice_outbox set state='processing',attempts=attempts+1,total_attempts=total_attempts+1,lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds',first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),error_code=null where id=o.id returning * into o;
  return jsonb_build_object('id',o.id,'lease',o.lease);
 end loop;
end $$;
create function public.hub_notice_prepare(i uuid,l uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
create function public.hub_notice_envelope(i uuid,l uuid,p jsonb,provider_name text) returns boolean language plpgsql security definer set search_path='' as $$
declare o hub_private.notice_outbox;
begin
 select * into o from hub_private.notice_outbox where id=i and lease=l and state='processing' for update;
 if not found or not hub_private.mail_eligible(o) then return false;end if;
 if o.envelope is not null then return true;end if;
 if provider_name not in ('mailpit','resend') or jsonb_typeof(p)<>'object' or length(p::text)>6000 or exists(select 1 from jsonb_object_keys(p) k where k not in ('from','to','subject','text')) or p->>'to' is distinct from (select email from auth.users where id=o.user_id) then raise exception 'Envelope inválido';end if;
 update hub_private.notice_outbox set envelope=p,provider=provider_name where id=i;return true;
end $$;
create function public.hub_notice_ack(i uuid,l uuid,outcome text,provider_message text default null,code text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare o hub_private.notice_outbox;
begin
 if outcome not in ('accepted','retry','failed','uncertain','suppressed') or code is not null and code not in ('rate_limit','provider_failure','network_unknown','invalid_response','configuration','sandbox_guard','source_or_authorization') or length(provider_message)>160 then raise exception 'Resultado inválido';end if;
 select * into o from hub_private.notice_outbox where id=i and lease=l and state in ('processing','uncertain') for update;if not found then return false;end if;
 update hub_private.notice_outbox set state=case when outcome='retry' then case when attempts>=5 then 'failed' else 'pending' end else outcome end,
  provider_id=coalesce(provider_message,provider_id),accepted_at=case when outcome='accepted' then clock_timestamp() else accepted_at end,
  next_attempt_at=case when outcome='retry' then clock_timestamp()+make_interval(secs=>least(3600,(60*power(2,greatest(0,attempts-1)))::integer)) else next_attempt_at end,error_code=code
 where id=i;
 if outcome='accepted' then
  if exists(select 1 from hub_private.notice_delivery_events e where e.provider_id=provider_message and e.outcome='bounced') then update hub_private.notice_outbox set state='failed',error_code='provider_failure' where id=i;
  elsif exists(select 1 from hub_private.notice_delivery_events e where e.provider_id=provider_message and e.outcome='delivered') then update hub_private.notice_outbox set state='delivered',delivered_at=clock_timestamp() where id=i;end if;
 end if;
 return true;
end $$;
create function public.hub_notice_delivery(provider_message text,event_key text,outcome text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if outcome not in ('delivered','bounced') or length(provider_message) not between 1 and 160 or length(event_key) not between 1 and 160 then raise exception 'Evento inválido';end if;
 insert into hub_private.notice_delivery_events(event_id,provider_id,outcome) values(event_key,provider_message,outcome) on conflict do nothing;
 if not found then return false;end if;
 update hub_private.notice_outbox set state=case when outcome='delivered' then 'delivered' else 'failed' end,delivered_at=case when outcome='delivered' then clock_timestamp() else delivered_at end,error_code=case when outcome='bounced' then 'provider_failure' else error_code end where provider_id=provider_message and state in ('accepted','delivered');return true;
end $$;

create function public.hub_notice_status(w uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'admin',true) then raise insufficient_privilege using message='Acesso negado';end if;
 return jsonb_build_object('settings',(select to_jsonb(s) from hub_private.notice_settings s),
 'runs',(select coalesce(jsonb_agg(to_jsonb(x) order by id desc),'[]') from(select * from hub_private.notice_runs where workspace_id=w order by id desc limit 20)x),
 'messages',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]') from(select id,user_id,state,attempts,total_attempts,cycles,next_attempt_at,created_at,accepted_at,delivered_at,error_code,provider from hub_private.notice_outbox where workspace_id=w order by created_at desc,id limit 50)x));
end $$;
create function public.hub_notice_retry(w uuid,i uuid,confirmation text,expected_attempts integer) returns boolean language plpgsql security definer set search_path='' as $$
declare o hub_private.notice_outbox;
begin
 if not public.hub_can(w,'admin',true) then raise insufficient_privilege using message='Acesso negado';end if;
 if nullif(btrim(confirmation),'') is null or length(confirmation)>2000 then raise exception 'Confirme o risco de duplicidade e informe o motivo';end if;
 select * into o from hub_private.notice_outbox where id=i and workspace_id=w for update;
 if not found then raise insufficient_privilege using message='Mensagem indisponível';end if;
 if o.state not in ('failed','uncertain') or o.total_attempts<>expected_attempts or o.cycles>=2 then raise exception 'Revise a situação atual; limite de dois reprocessamentos manuais';end if;
 if not hub_private.mail_eligible(o) then raise exception 'Origem ou autorização não permite novo envio';end if;
 -- No claim of exactly-once after uncertain delivery or the provider window.
 update hub_private.notice_outbox set state='pending',attempts=0,cycles=cycles+1,next_attempt_at=clock_timestamp(),lease=null,lease_until=null,first_attempt_at=clock_timestamp(),error_code=null where id=i;
 insert into public.hub_registry_events(workspace_id,kind,record_id,actor_id,action,financial,after_record) values(w,'member',auth.uid(),auth.uid(),'Reprocessamento de aviso confirmado',true,jsonb_build_object('message',i,'reason',btrim(confirmation),'duplicate_risk',true));return true;
end $$;

revoke all on function public.hub_notice_generate(),public.hub_notice_claim(),public.hub_notice_prepare(uuid,uuid),public.hub_notice_envelope(uuid,uuid,jsonb,text),public.hub_notice_ack(uuid,uuid,text,text,text),public.hub_notice_delivery(text,text,text) from public,anon,authenticated;
grant execute on function public.hub_notice_generate(),public.hub_notice_claim(),public.hub_notice_prepare(uuid,uuid),public.hub_notice_envelope(uuid,uuid,jsonb,text),public.hub_notice_ack(uuid,uuid,text,text,text),public.hub_notice_delivery(text,text,text) to service_role;
revoke all on function public.hub_notice_status(uuid),public.hub_notice_retry(uuid,uuid,text,integer) from public,anon;
grant execute on function public.hub_notice_status(uuid),public.hub_notice_retry(uuid,uuid,text,integer) to authenticated;

create function public.hub_notice_summary(w uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today date:=(clock_timestamp() at time zone 'America/Fortaleza')::date;
begin
 if not public.hub_can(w,'commercial') then raise insufficient_privilege using message='Acesso negado';end if;
 if not coalesce((select internal_enabled and daily_digest from public.hub_notice_preferences where workspace_id=w and user_id=auth.uid()),true) then return null;end if;
 if not exists(select 1 from hub_private.notice_summaries where workspace_id=w and user_id=auth.uid() and day=today) then return null;end if;
 return jsonb_build_object('day',today,'pending',(select count(*) from public.hub_notices n join hub_private.due_sources(w) s on s.source_key=n.source_key and s.due_on=n.due_on
 where n.workspace_id=w and n.user_id=auth.uid() and s.remind and (not s.financial or public.hub_can(w,'finance'))
 and s.due_on<=today+coalesce((select max(d) from public.hub_notice_preferences p,unnest(p.lead_days)d where p.workspace_id=w and p.user_id=auth.uid()),30)
 and (coalesce((select watch_scope from public.hub_notice_preferences where workspace_id=w and user_id=auth.uid()),'space')='space' or s.owner_id=auth.uid())));
end $$;
revoke all on function public.hub_notice_summary(uuid) from public,anon;
grant execute on function public.hub_notice_summary(uuid) to authenticated;
commit;
