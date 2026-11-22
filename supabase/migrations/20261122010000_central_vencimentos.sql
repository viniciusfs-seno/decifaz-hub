begin;
-- Projection only: contracts, bills and forecasts remain their sources of truth.
create function hub_private.due_sources(w uuid)
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
$$;
revoke all on function hub_private.due_sources(uuid) from public,anon,authenticated;

create function hub_private.notice_access(w uuid,u uuid,fin boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hub_members m where m.workspace_id=w and m.user_id=u and m.active and (not fin or (array[m.role]||m.extra_roles)&&array['admin','finance']))
$$;
revoke all on function hub_private.notice_access(uuid,uuid,boolean) from public,anon,authenticated;

create table public.hub_notice_preferences(
 workspace_id uuid not null,user_id uuid not null,internal_enabled boolean not null default true,email_enabled boolean not null default false,
 lead_days integer[] not null default array[30,7,1,0],daily_digest boolean not null default true,digest_hour integer not null default 9 check(digest_hour between 0 and 23),
 watch_scope text not null default 'space' check(watch_scope in ('mine','space')),revision bigint not null default 0,
 primary key(workspace_id,user_id),foreign key(workspace_id,user_id) references public.hub_members(workspace_id,user_id) on delete cascade,
 check(cardinality(lead_days) between 1 and 8 and lead_days <@ array[0,1,2,3,5,7,14,15,30,60,90])
);
create table public.hub_notices(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,user_id uuid not null,source_key text not null,kind text not null,record_id uuid not null,due_on date not null,financial boolean not null,
 created_at timestamptz not null default clock_timestamp(),stage integer not null default 0 check(stage between 0 and 90),stage_at timestamptz not null default clock_timestamp(),read_at timestamptz,resolved_at timestamptz,resolution text,
 foreign key(workspace_id,user_id) references public.hub_members(workspace_id,user_id) on delete cascade,unique(workspace_id,user_id,source_key,due_on)
);
create index hub_notices_person on public.hub_notices(workspace_id,user_id,created_at desc,id);
alter table public.hub_notice_preferences enable row level security;
alter table public.hub_notices enable row level security;
revoke all on public.hub_notice_preferences,public.hub_notices from public,anon,authenticated;
grant select on public.hub_notice_preferences,public.hub_notices to authenticated;
create policy preference_own on public.hub_notice_preferences for select to authenticated using(user_id=auth.uid() and public.hub_can(workspace_id,'commercial'));
create policy notice_own on public.hub_notices for select to authenticated using(user_id=auth.uid() and public.hub_can(workspace_id,case when financial then 'finance' else 'commercial' end));

create function public.hub_dues(w uuid,period text default '30',person uuid default null,cat text default '',project uuid default null,contract uuid default null,skip integer default 0,closed boolean default false)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'America/Fortaleza')::date;result jsonb;
begin
 if not public.hub_can(w,'commercial') then raise insufficient_privilege using message='Acesso negado';end if;
 if period not in ('overdue','today','7','30','all') or skip<0 or skip>100000 or length(cat)>120 then raise exception 'Filtro inválido' using errcode='22023';end if;
 with allowed as(select * from hub_private.due_sources(w) s where (not s.financial or public.hub_can(w,'finance'))),
 filtered as(select * from allowed s where (closed or s.pending) and (person is null or s.owner_id=person) and (cat='' or s.category=cat) and (project is null or s.project_id=project) and (contract is null or s.contract_id=contract)),
 selected as(select * from filtered s where case period when 'overdue' then s.due_on<today when 'today' then s.due_on=today when '7' then s.due_on between today and today+7 when '30' then s.due_on between today and today+30 else true end),
 page as(select * from selected order by due_on,source_key limit 50 offset skip)
 select jsonb_build_object('today',today,'total',(select count(*) from selected),'rows',(select coalesce(jsonb_agg(to_jsonb(p) order by p.due_on,p.source_key),'[]') from page p),
 'counts',jsonb_build_object('overdue',(select count(*) from filtered where pending and due_on<today),'today',(select count(*) from filtered where pending and due_on=today),'7',(select count(*) from filtered where pending and due_on between today and today+7),'30',(select count(*) from filtered where pending and due_on between today and today+30)),
 'categories',(select coalesce(jsonb_agg(c order by c),'[]') from(select distinct category c from allowed)x)) into result;
 return result;
end $$;

create function public.hub_notice_prefs(w uuid,body jsonb default null,expected_revision bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.hub_notice_preferences;days integer[];
begin
 if not public.hub_can(w,'commercial') then raise insufficient_privilege using message='Acesso negado';end if;
 if body is null then select * into r from public.hub_notice_preferences where workspace_id=w and user_id=auth.uid();
  if found then return to_jsonb(r);end if;
  return jsonb_build_object('internal_enabled',true,'email_enabled',false,'lead_days',array[30,7,1,0],'daily_digest',true,'digest_hour',9,'watch_scope','space','revision',0);
 end if;
 if jsonb_typeof(body)<>'object' or exists(select 1 from jsonb_object_keys(body) k where k not in ('internal_enabled','email_enabled','lead_days','daily_digest','digest_hour','watch_scope')) then raise exception 'Preferências inválidas' using errcode='22023';end if;
 select array_agg(distinct value::integer order by value::integer desc) into days from jsonb_array_elements_text(body->'lead_days');
 if days is null or cardinality(days)>8 or not days <@ array[0,1,2,3,5,7,14,15,30,60,90] then raise exception 'Escolha antecedências válidas' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(w::text||auth.uid()::text||'noticeprefs',0));
 select * into r from public.hub_notice_preferences where workspace_id=w and user_id=auth.uid() for update;
 if coalesce(r.revision,0) is distinct from expected_revision then return jsonb_build_object('status','conflict','current',public.hub_notice_prefs(w));end if;
 insert into public.hub_notice_preferences(workspace_id,user_id,internal_enabled,email_enabled,lead_days,daily_digest,digest_hour,watch_scope,revision)
 values(w,auth.uid(),(body->>'internal_enabled')::boolean,(body->>'email_enabled')::boolean,days,(body->>'daily_digest')::boolean,(body->>'digest_hour')::integer,body->>'watch_scope',1)
 on conflict(workspace_id,user_id) do update set internal_enabled=excluded.internal_enabled,email_enabled=excluded.email_enabled,lead_days=excluded.lead_days,daily_digest=excluded.daily_digest,digest_hour=excluded.digest_hour,watch_scope=excluded.watch_scope,revision=hub_notice_preferences.revision+1 returning * into r;
 insert into public.hub_registry_events(workspace_id,kind,record_id,actor_id,action,after_record,revision) values(w,'member',auth.uid(),auth.uid(),'Preferências de avisos atualizadas',to_jsonb(r)-'workspace_id'-'user_id',r.revision);
 return jsonb_build_object('status','saved','current',to_jsonb(r));
end $$;

create function public.hub_list_notices(w uuid,skip integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'commercial') then raise insufficient_privilege using message='Acesso negado';end if;
 if skip<0 or skip>100000 then raise exception 'Página inválida';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc,id),'[]') from(
 select n.*,s.title,s.owner,s.owner_id,s.category,s.project_id,s.contract_id,
 case when s.due_on is distinct from n.due_on or not s.remind then coalesce(n.resolved_at,now()) else n.resolved_at end as effective_resolved_at
 from public.hub_notices n join hub_private.due_sources(w) s on s.source_key=n.source_key
 where n.workspace_id=w and n.user_id=auth.uid() and (not n.financial or public.hub_can(w,'finance')) order by n.created_at desc,n.id limit 50 offset skip)x);
end $$;
create function public.hub_read_notice(w uuid,n uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.hub_can(w,'commercial') then raise insufficient_privilege using message='Acesso negado';end if;
 update public.hub_notices set read_at=coalesce(read_at,clock_timestamp()) where workspace_id=w and id=n and user_id=auth.uid() and (not financial or public.hub_can(w,'finance'));
 if not found then raise insufficient_privilege using message='Aviso indisponível';end if;return true;
end $$;

create function public.hub_reschedule_internal(w uuid,b uuid,expected_revision bigint,new_due date,reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.hub_internal_bills;before_row jsonb;
begin
 if not public.hub_can(w,'finance',true) then raise insufficient_privilege using message='Acesso negado';end if;
 if new_due is null or new_due<(now() at time zone 'America/Fortaleza')::date or nullif(btrim(reason),'') is null or length(reason)>2000 then raise exception 'Informe nova data futura e motivo' using errcode='22023';end if;
 select * into r from public.hub_internal_bills where workspace_id=w and id=b for update;
 if not found then raise insufficient_privilege using message='Ocorrência indisponível';end if;
 if r.revision is distinct from expected_revision then return jsonb_build_object('status','conflict','current',to_jsonb(r));end if;
 if r.status<>'Prevista' then raise exception 'Somente ocorrência prevista pode ser reagendada' using errcode='22023';end if;
 if r.due_on=new_due then return jsonb_build_object('status','saved','current',to_jsonb(r));end if;
 before_row:=to_jsonb(r);
 update public.hub_internal_bills set due_on=new_due,revision=revision+1 where workspace_id=w and id=b returning * into r;
 insert into public.hub_registry_events(workspace_id,kind,record_id,actor_id,action,financial,before_record,after_record,revision)
 values(w,'bill',b,auth.uid(),'Ocorrência reagendada com motivo',true,before_row,jsonb_build_object('due_on',new_due,'reason',btrim(reason),'competency',r.competency),r.revision);
 return jsonb_build_object('status','saved','current',to_jsonb(r));
end $$;
revoke all on function public.hub_dues(uuid,text,uuid,text,uuid,uuid,integer,boolean),public.hub_notice_prefs(uuid,jsonb,bigint),public.hub_list_notices(uuid,integer),public.hub_read_notice(uuid,uuid),public.hub_reschedule_internal(uuid,uuid,bigint,date,text) from public,anon;
grant execute on function public.hub_dues(uuid,text,uuid,text,uuid,uuid,integer,boolean),public.hub_notice_prefs(uuid,jsonb,bigint),public.hub_list_notices(uuid,integer),public.hub_read_notice(uuid,uuid),public.hub_reschedule_internal(uuid,uuid,bigint,date,text) to authenticated;
commit;
