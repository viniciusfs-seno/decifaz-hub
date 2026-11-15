begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000001751','ator-a@example.invalid'),
 ('00000000-0000-4000-8000-000000001752','ator-b@example.invalid'),
 ('00000000-0000-4000-8000-000000001753','integrante@example.invalid'),
 ('00000000-0000-4000-8000-000000001754','outro-ator@example.invalid');
insert into public.hub_workspaces(id,name) values
 ('00000000-0000-4000-8000-000000001755','Histórico fictício'),
 ('00000000-0000-4000-8000-000000001756','Histórico isolado');
insert into public.hub_members(workspace_id,user_id,role) values
 ('00000000-0000-4000-8000-000000001755','00000000-0000-4000-8000-000000001751','admin'),
 ('00000000-0000-4000-8000-000000001755','00000000-0000-4000-8000-000000001752','admin'),
 ('00000000-0000-4000-8000-000000001755','00000000-0000-4000-8000-000000001753','commercial'),
 ('00000000-0000-4000-8000-000000001756','00000000-0000-4000-8000-000000001754','admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001751',true);
do $$
declare w uuid:='00000000-0000-4000-8000-000000001755'; m uuid:='00000000-0000-4000-8000-000000001753';
begin
 if (select count(*) from public.hub_role_audit)<>3 then raise exception 'Isolamento do histórico falhou';end if;
 if not exists(select 1 from public.hub_role_audit where member_id=m and operation='created' and before_roles='{}' and after_roles=array['commercial'] and before_revision is null and after_revision=0 and actor_source='system' and actor_id is null) then raise exception 'Criação administrativa sem ator não identificada como sistema';end if;
 if not public.hub_set_roles(w,m,array['operations']) then raise exception 'RPC legada recusada';end if;
 if not exists(select 1 from public.hub_role_audit where workspace_id=w and member_id=m and actor_id=auth.uid() and actor_source='member' and operation='changed' and before_roles=array['commercial'] and after_roles=array['operations'] and before_revision=0 and after_revision=1 and occurred_at>=transaction_timestamp() and occurred_at<=clock_timestamp()) then raise exception 'Evento da RPC legada inconsistente';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001752',true);
 if (public.hub_update_member_roles(w,m,array['finance'],1)->>'status')<>'saved' then raise exception 'RPC revisada recusada';end if;
 if not exists(select 1 from public.hub_role_audit where member_id=m and actor_id=auth.uid() and before_roles=array['operations'] and after_roles=array['finance'] and before_revision=1 and after_revision=2) then raise exception 'Evento da RPC revisada inconsistente';end if;
 if (public.hub_update_member_roles(w,m,array['commercial'],1)->>'status')<>'conflict' then raise exception 'Conflito não detectado';end if;
 if (public.hub_update_member_roles(w,m,array['unknown'],2)->>'status')<>'rejected' then raise exception 'Recusa não detectada';end if;
 if not public.hub_set_roles(w,m,array['finance']) or (public.hub_update_member_roles(w,m,array['finance'],2)->>'status')<>'saved' then raise exception 'No-op não preservado';end if;
 if (select count(*) from public.hub_role_audit)<>5 then raise exception 'Conflito, recusa ou no-op gerou evento';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001751',true);
 if not public.hub_set_roles(w,'00000000-0000-4000-8000-000000001752',array['commercial']) then raise exception 'Segundo admin não alterado';end if;
 if public.hub_set_roles(w,auth.uid(),array['commercial']) or (public.hub_update_member_roles(w,auth.uid(),array['commercial'],0)->>'status')<>'rejected' then raise exception 'Último admin removido';end if;
 if (select count(*) from public.hub_role_audit)<>6 then raise exception 'Recusa do último admin gerou evento';end if;
 begin
  perform public.hub_set_roles(w,m,array['operations']);
  raise exception using errcode='P9001',message='Rollback fictício após mudança';
 exception when sqlstate 'P9001' then null;end;
 if (select count(*) from public.hub_role_audit)<>6 or not exists(select 1 from public.hub_list_members(w) where user_id=m and roles=array['finance'] and revision='2') then raise exception 'Rollback separou mudança e evento';end if;
 begin insert into public.hub_role_audit(workspace_id,actor_id,actor_source,member_id,operation,before_roles,after_roles,after_revision) values(w,auth.uid(),'member',m,'created','{}',array['finance'],0);raise exception 'Evento forjado';exception when insufficient_privilege then null;end;
 begin update public.hub_role_audit set after_roles=array['admin'] where workspace_id=w;raise exception 'Evento editado';exception when insufficient_privilege then null;end;
 begin delete from public.hub_role_audit where workspace_id=w;raise exception 'Evento excluído';exception when insufficient_privilege then null;end;
 begin execute 'truncate public.hub_role_audit';raise exception 'Histórico truncado';exception when insufficient_privilege then null;end;
 if has_function_privilege('authenticated','hub_private.audit_member_roles()','EXECUTE') then raise exception 'Helper exposto';end if;
end $$;

-- Fail the event insert deliberately: the member and revision must roll back.
reset role;
create function pg_temp.reject_role_event() returns trigger language plpgsql as $$ begin raise check_violation using message='Falha fictícia na gravação do evento';end $$;
create trigger fictitious_audit_failure before insert on public.hub_role_audit for each row execute function pg_temp.reject_role_event();
set local role authenticated;
do $$ begin
 begin perform public.hub_set_roles('00000000-0000-4000-8000-000000001755','00000000-0000-4000-8000-000000001753',array['operations']);raise exception 'Falha do evento não abortou';exception when check_violation then null;end;
 begin perform public.hub_update_member_roles('00000000-0000-4000-8000-000000001755','00000000-0000-4000-8000-000000001753',array['operations'],2);raise exception 'Falha do evento não abortou a RPC revisada';exception when check_violation then null;end;
 if (select count(*) from public.hub_role_audit)<>6 or not exists(select 1 from public.hub_list_members('00000000-0000-4000-8000-000000001755') where user_id='00000000-0000-4000-8000-000000001753' and roles=array['finance'] and revision='2') then raise exception 'Evento falhou mas alteração persistiu';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001753',true);
do $$ begin
 if exists(select 1 from public.hub_role_audit) then raise exception 'Financeiro consultou histórico administrativo';end if;
 if public.hub_set_roles('00000000-0000-4000-8000-000000001755',auth.uid(),array['admin']) then raise exception 'Usuário comum gravou';end if;
 begin perform public.hub_update_member_roles('00000000-0000-4000-8000-000000001755',auth.uid(),array['admin'],2);raise exception 'Usuário comum gravou com revisão';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001754',true);
do $$ begin if (select count(*) from public.hub_role_audit)<>1 then raise exception 'Admin externo consultou eventos de outro espaço';end if;end $$;
set local role anon;
do $$ begin begin perform * from public.hub_role_audit;raise exception 'Anônimo consultou';exception when insufficient_privilege then null;end;end $$;
reset role;
do $$ begin if (select count(*) from public.hub_role_audit where workspace_id in ('00000000-0000-4000-8000-000000001755','00000000-0000-4000-8000-000000001756'))<>7 then raise exception 'Tentativa recusada criou evento efetivo';end if;end $$;
rollback;
