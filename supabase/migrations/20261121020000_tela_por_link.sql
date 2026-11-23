begin;
-- Ephemeral negotiation only. No media, credentials or SDP in the registry.
create table hub_private.screen_sessions(
 id uuid primary key, workspace_id uuid not null,meeting_id uuid not null,lead_id uuid not null,host_id uuid not null,
 token_hash bytea,created_at timestamptz not null default clock_timestamp(),
 invite_until timestamptz not null default clock_timestamp()+interval '2 minutes',
 ends_at timestamptz not null default clock_timestamp()+interval '5 minutes',
 heartbeat timestamptz not null default clock_timestamp(),ended_at timestamptz,relay_at timestamptz,
 offer jsonb,host_ice jsonb not null default '[]',epoch integer not null default 0,
 foreign key(workspace_id,lead_id,meeting_id) references public.hub_meetings(workspace_id,lead_id,id) on delete cascade
);
create table hub_private.screen_requests(
 session_id uuid not null references hub_private.screen_sessions(id) on delete cascade,
 id uuid not null,name text not null check(length(name) between 1 and 60),
 state text not null default 'pending' check(state in ('pending','approved','denied')),
 answer jsonb,viewer_ice jsonb not null default '[]',epoch integer,seen_at timestamptz not null default clock_timestamp(),relay_at timestamptz,
 primary key(session_id,id)
);
revoke all on hub_private.screen_sessions,hub_private.screen_requests from public,anon,authenticated;

create function hub_private.close_screen(s uuid,automatic boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare r hub_private.screen_sessions;
begin
 update hub_private.screen_sessions set ended_at=clock_timestamp(),token_hash=null,offer=null,host_ice='[]' where id=s and ended_at is null returning * into r;
 if not found then return;end if;
 update hub_private.screen_requests set answer=null,viewer_ice='[]',state='denied' where session_id=s;
 insert into public.hub_registry_events(workspace_id,kind,record_id,lead_id,project_id,actor_id,action)
 select r.workspace_id,'meeting',r.meeting_id,m.lead_id,m.project_id,case when automatic then null else auth.uid() end,case when automatic then 'Compartilhamento de tela encerrado automaticamente' else 'Compartilhamento de tela encerrado' end from public.hub_meetings m where m.workspace_id=r.workspace_id and m.id=r.meeting_id and m.lead_id=r.lead_id;
end $$;
revoke all on function hub_private.close_screen(uuid,boolean) from public,anon,authenticated;

create function hub_private.sweep_screens() returns void language plpgsql security definer set search_path='' as $$
declare old_id uuid;
begin
 for old_id in select id from hub_private.screen_sessions where ended_at is null and (ends_at<clock_timestamp() or heartbeat<clock_timestamp()-interval '45 seconds') order by id for update skip locked limit 20 loop perform hub_private.close_screen(old_id,true);end loop;
 delete from hub_private.screen_sessions where ended_at<clock_timestamp()-interval '1 day';
end $$;
revoke all on function hub_private.sweep_screens() from public,anon,authenticated;


create function hub_private.screen_ice(previous jsonb,incoming jsonb) returns jsonb
language plpgsql immutable security definer set search_path='' as $$
declare item jsonb;result jsonb:=coalesce(previous,'[]'::jsonb);clean jsonb;
begin
 if incoming is null or jsonb_typeof(incoming)<>'array' or jsonb_array_length(incoming)>40 or pg_column_size(incoming)>32768 then raise exception 'Candidatos inválidos';end if;
 for item in select * from jsonb_array_elements(incoming) loop
  if jsonb_typeof(item)<>'object' or coalesce(length(item->>'candidate'),0) not between 1 and 2048 or coalesce(length(item->>'sdpMid'),0)>32 or (item->>'sdpMLineIndex')::integer not between 0 and 8 or coalesce(length(item->>'usernameFragment'),0)>256 then raise exception 'Candidato inválido';end if;
  clean:=jsonb_build_object('candidate',item->>'candidate','sdpMid',item->'sdpMid','sdpMLineIndex',item->'sdpMLineIndex','usernameFragment',item->'usernameFragment');
  if not result @> jsonb_build_array(clean) then result:=result||jsonb_build_array(clean);end if;
 end loop;
 if jsonb_array_length(result)>64 then raise exception 'Limite de candidatos';end if;return result;
end $$;
revoke all on function hub_private.screen_ice(jsonb,jsonb) from public,anon,authenticated;

create function public.hub_screen_start(w uuid,m uuid,s uuid,credential text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r hub_private.screen_sessions; old_id uuid;lead uuid;
begin
 if auth.uid() is null or not public.hub_can(w,'projects',true) then raise insufficient_privilege using message='Acesso negado';end if;
 if credential is null or credential !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'Credencial inválida';end if;
 -- One session for this Hub installation, across spaces/hosts. Take this lock
 -- before workspace/session locks so concurrent starts cannot exceed the cap.
 perform pg_catalog.pg_advisory_xact_lock(734020040);
 perform hub_private.sweep_screens();
 -- A workspace lock also serializes concurrent start, role changes and deactivation.
 perform 1 from public.hub_workspaces where id=w for update;
 if not public.hub_can(w,'projects',true) then raise insufficient_privilege using message='Acesso negado';end if;
 if (select count(*) from public.hub_meetings where workspace_id=w and id=m and project_id is not null and state<>'Cancelada')<>1 then raise exception 'Reunião de projeto indisponível';end if;
 select * into r from hub_private.screen_sessions where id=s for update;
 if found then
  if r.host_id<>auth.uid() or r.workspace_id<>w or r.meeting_id<>m or r.token_hash is distinct from extensions.digest(credential,'sha256') or r.ended_at is not null or r.ends_at<clock_timestamp() or r.heartbeat<clock_timestamp()-interval '45 seconds' then raise exception 'Sessão indisponível';end if;
  return jsonb_build_object('id',r.id,'invite_until',r.invite_until,'ends_at',r.ends_at);
 end if;
 if exists(select 1 from hub_private.screen_sessions where ended_at is null and ends_at>clock_timestamp() and heartbeat>clock_timestamp()-interval '45 seconds') then
  raise exception 'Limite de compartilhamento atingido. Encerre a sessão ativa ou aguarde sua expiração.' using errcode='P0001';
 end if;
 select lead_id into lead from public.hub_meetings where workspace_id=w and id=m;
 insert into hub_private.screen_sessions(id,workspace_id,meeting_id,lead_id,host_id,token_hash) values(s,w,m,lead,auth.uid(),extensions.digest(credential,'sha256')) returning * into r;
 insert into public.hub_registry_events(workspace_id,kind,record_id,lead_id,project_id,actor_id,action)
 select w,'meeting',m,x.lead_id,x.project_id,auth.uid(),'Compartilhamento de tela iniciado' from public.hub_meetings x where x.workspace_id=w and x.id=m and x.lead_id=lead;
 return jsonb_build_object('id',r.id,'invite_until',r.invite_until,'ends_at',r.ends_at);
end $$;

create function public.hub_screen_host(s uuid,action text default 'poll',viewer uuid default null,payload jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r hub_private.screen_sessions;
begin
 select * into r from hub_private.screen_sessions where id=s for update;
 if not found or auth.uid() is null or r.host_id<>auth.uid() then raise insufficient_privilege using message='Acesso negado';end if;
 if r.ended_at is not null then return jsonb_build_object('state','ended');end if;
 if not public.hub_can(r.workspace_id,'projects',true) or r.ends_at<clock_timestamp() or r.heartbeat<clock_timestamp()-interval '45 seconds' then
  perform hub_private.close_screen(s,true);return jsonb_build_object('state','ended');end if;
 if action='stop' then perform hub_private.close_screen(s);return jsonb_build_object('state','ended');
 elsif action='approve' then
  if r.invite_until<clock_timestamp() or not exists(select 1 from hub_private.screen_requests where session_id=s and id=viewer and state='pending') or exists(select 1 from hub_private.screen_requests where session_id=s and state='approved') then raise exception 'Entrada indisponível';end if;
  update hub_private.screen_requests set state=case when id=viewer then 'approved' else 'denied' end where session_id=s;
 elsif action='deny' then update hub_private.screen_requests set state='denied',answer=null,viewer_ice='[]' where session_id=s and id=viewer;
 elsif action='ice' then
  if payload->>'epoch' is null or (payload->>'epoch')::integer is distinct from r.epoch or r.offer is null then raise exception 'Revisão de negociação inválida';end if;
  update hub_private.screen_sessions set host_ice=hub_private.screen_ice(host_ice,payload->'candidates') where id=s;
 elsif action='offer' then
  if payload is null or pg_catalog.pg_column_size(payload)>65536 or payload->>'type' is distinct from 'offer' or coalesce(length(payload->>'sdp'),0) not between 1 and 60000 then raise exception 'Negociação inválida';end if;
  update hub_private.screen_sessions set offer=payload,host_ice='[]',epoch=epoch+1 where id=s;
  update hub_private.screen_requests set answer=null,viewer_ice='[]',epoch=null where session_id=s;
 elsif action<>'poll' then raise exception 'Operação inválida';end if;
 update hub_private.screen_sessions set heartbeat=clock_timestamp() where id=s returning * into r;
 return jsonb_build_object('state','open','epoch',r.epoch,'invite_until',r.invite_until,'ends_at',r.ends_at,'viewers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'state',state,'answer',answer,'candidates',viewer_ice,'epoch',epoch,'seen_at',seen_at) order by seen_at) from hub_private.screen_requests where session_id=s),'[]'::jsonb));
end $$;

-- A narrowly scoped capability API. It never reads portal content or creates membership.
create function public.hub_screen_watch(s uuid,credential text,viewer uuid,display_name text default null,answer jsonb default null,offer_epoch integer default null,candidates jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r hub_private.screen_sessions; v hub_private.screen_requests;n text;
begin
 select * into r from hub_private.screen_sessions where id=s for update;
 if not found or credential is null or length(credential)<>43 or r.token_hash is distinct from extensions.digest(credential,'sha256') or r.ended_at is not null then return jsonb_build_object('state','unavailable');end if;
 if r.ends_at<clock_timestamp() or r.heartbeat<clock_timestamp()-interval '45 seconds' or not exists(select 1 from public.hub_members where workspace_id=r.workspace_id and user_id=r.host_id and active and (array[role]||extra_roles)&&array['admin','operations']) then
  perform hub_private.close_screen(s,true);return jsonb_build_object('state','unavailable');end if;
 select * into v from hub_private.screen_requests where session_id=s and id=viewer;
 if not found then
  if r.invite_until<clock_timestamp() or viewer is null or display_name is null then return jsonb_build_object('state','unavailable');end if;
  n:=btrim(regexp_replace(display_name,'\s+',' ','g'));
  if length(n) not between 1 and 60 or n~'[[:cntrl:]]' then raise exception 'Informe um nome válido';end if;
  if (select count(*) from hub_private.screen_requests where session_id=s)>=5 or exists(select 1 from hub_private.screen_requests where session_id=s and state='approved') then return jsonb_build_object('state','unavailable');end if;
  insert into hub_private.screen_requests(session_id,id,name) values(s,viewer,n) returning * into v;
 end if;
 if v.state='pending' and r.invite_until<clock_timestamp() then return jsonb_build_object('state','unavailable');end if;
 if candidates is not null then
  if v.state<>'approved' or offer_epoch is distinct from r.epoch or r.offer is null then raise exception 'Revisão de negociação inválida';end if;
  update hub_private.screen_requests set viewer_ice=hub_private.screen_ice(viewer_ice,hub_screen_watch.candidates) where session_id=s and id=viewer;
 end if;
 if answer is not null then
  if v.state<>'approved' or offer_epoch is distinct from r.epoch or r.offer is null or pg_catalog.pg_column_size(answer)>65536 or answer->>'type' is distinct from 'answer' or coalesce(length(answer->>'sdp'),0) not between 1 and 60000 then raise exception 'Negociação inválida';end if;
  update hub_private.screen_requests set answer=hub_screen_watch.answer,epoch=offer_epoch where session_id=s and id=viewer;
 end if;
 update hub_private.screen_requests set seen_at=clock_timestamp() where session_id=s and id=viewer;
 return jsonb_build_object('state',v.state,'epoch',r.epoch,'offer',case when v.state='approved' then r.offer else null end,'candidates',case when v.state='approved' then r.host_ice else '[]'::jsonb end,'ends_at',r.ends_at);
end $$;
revoke all on function public.hub_screen_start(uuid,uuid,uuid,text),public.hub_screen_host(uuid,text,uuid,jsonb),public.hub_screen_watch(uuid,text,uuid,text,jsonb,integer,jsonb) from public,anon,authenticated;
grant execute on function public.hub_screen_start(uuid,uuid,uuid,text),public.hub_screen_host(uuid,text,uuid,jsonb) to authenticated;
grant execute on function public.hub_screen_watch(uuid,text,uuid,text,jsonb,integer,jsonb) to anon,authenticated;

-- Server credential issuer calls this with the original actor/capability, never
-- service_role. Row locks enforce a cross-instance issuance limit per peer.
create function public.hub_screen_relay(s uuid,credential text default null,viewer uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r hub_private.screen_sessions;v hub_private.screen_requests;
begin
 select * into r from hub_private.screen_sessions where id=s for update;
 if not found or r.ended_at is not null or r.ends_at<=clock_timestamp() or r.heartbeat<clock_timestamp()-interval '45 seconds'
 or not exists(select 1 from public.hub_members where workspace_id=r.workspace_id and user_id=r.host_id and active and (array[role]||extra_roles)&&array['admin','operations']) then raise insufficient_privilege using message='Emissão indisponível';end if;
 if viewer is null then
  if auth.uid() is null or auth.uid()<>r.host_id or not public.hub_can(r.workspace_id,'projects',true) then raise insufficient_privilege using message='Emissão indisponível';end if;
  if r.relay_at>clock_timestamp()-interval '30 seconds' then raise exception 'Aguarde para tentar novamente';end if;
  update hub_private.screen_sessions set relay_at=clock_timestamp() where id=s;
 else
  if credential is null or length(credential)<>43 or r.token_hash is distinct from extensions.digest(credential,'sha256') then raise insufficient_privilege using message='Emissão indisponível';end if;
  select * into v from hub_private.screen_requests where session_id=s and id=viewer and state='approved' for update;
  if not found then raise insufficient_privilege using message='Emissão indisponível';end if;
  if v.relay_at>clock_timestamp()-interval '30 seconds' then raise exception 'Aguarde para tentar novamente';end if;
  update hub_private.screen_requests set relay_at=clock_timestamp() where session_id=s and id=viewer;
 end if;
 return jsonb_build_object('ttl',least(1800,greatest(1,floor(extract(epoch from r.ends_at-clock_timestamp()))::integer)));
end $$;
revoke all on function public.hub_screen_relay(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.hub_screen_relay(uuid,text,uuid) to anon,authenticated;
commit;
