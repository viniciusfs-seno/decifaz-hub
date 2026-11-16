begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000002801','admin-a@example.invalid'),
 ('00000000-0000-4000-8000-000000002802','admin-b@example.invalid'),
 ('00000000-0000-4000-8000-000000002803','inactive@example.invalid'),
 ('00000000-0000-4000-8000-000000002804','member@example.invalid');
insert into public.hub_workspaces(id,name) values('00000000-0000-4000-8000-000000002805','Estado fictício');
insert into public.hub_members(workspace_id,user_id,role) values
 ('00000000-0000-4000-8000-000000002805','00000000-0000-4000-8000-000000002801','admin'),
 ('00000000-0000-4000-8000-000000002805','00000000-0000-4000-8000-000000002802','admin'),
 ('00000000-0000-4000-8000-000000002805','00000000-0000-4000-8000-000000002804','commercial');
insert into public.hub_members(workspace_id,user_id,role,active) values
 ('00000000-0000-4000-8000-000000002805','00000000-0000-4000-8000-000000002803','admin',false);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002801',true);
do $$ declare w uuid:='00000000-0000-4000-8000-000000002805';b uuid:='00000000-0000-4000-8000-000000002802';m uuid:='00000000-0000-4000-8000-000000002804';n bigint;begin
 if not exists(select 1 from public.hub_list_members(w) where user_id=m and active and revision='0') then raise exception 'Vínculo existente não permaneceu ativo';end if;
 if public.hub_update_member_active(w,b,false,0)->>'status'<>'saved' then raise exception 'Desativação recusada';end if;
 if public.hub_update_member_active(w,auth.uid(),false,0)->>'status'<>'rejected' then raise exception 'Último admin ativo desativado';end if;
 if public.hub_set_roles(w,auth.uid(),array['commercial']) then raise exception 'Admin inativo contou para rebaixar último ativo';end if;
 if public.hub_update_member_roles(w,auth.uid(),array['commercial'],0)->>'status'<>'rejected' then raise exception 'Último admin rebaixado por revisão';end if;
 if public.hub_update_member_active(w,m,false,0)->>'status'<>'saved' then raise exception 'Desativação do integrante recusada';end if;
 if not exists(select 1 from public.hub_role_audit where workspace_id=w and member_id=m and operation='deactivated' and actor_id=auth.uid() and before_active and not after_active and before_roles=after_roles and before_revision=0 and after_revision=1) then raise exception 'Evento desativação inconsistente';end if;
 select count(*) into n from public.hub_role_audit where workspace_id=w;
 perform public.hub_update_member_active(w,m,false,1);
 if (select count(*) from public.hub_role_audit where workspace_id=w)<>n then raise exception 'No-op criou evento';end if;
 if public.hub_update_member_roles(w,m,array['finance'],0)->>'status'<>'conflict' then raise exception 'Revisão obsoleta ignorou estado';end if;
 if public.hub_update_member_active(w,m,true,null)->>'status'<>'rejected' then raise exception 'Revisão omitida aceita';end if;
 if not public.hub_set_roles(w,m,array['finance']) then raise exception 'Papel de inativo não pôde ser gerido';end if;
 if not exists(select 1 from public.hub_list_members(w) where user_id=m and not active and roles=array['finance'] and revision='2') then raise exception 'RPC legada reativou integrante';end if;
 if not public.hub_set_role(w,m,'finance') or not exists(select 1 from public.hub_list_members(w) where user_id=m and not active and revision='2') then raise exception 'RPC de papel único restaurou acesso';end if;
 begin update public.hub_members set active=true where workspace_id=w and user_id=m;raise exception 'Escrita direta aceita';exception when insufficient_privilege then null;end;
 if public.hub_update_member_active(w,m,true,2)->>'status'<>'saved' then raise exception 'Reativação recusada';end if;
 if not exists(select 1 from public.hub_role_audit where workspace_id=w and member_id=m and operation='reactivated' and not before_active and after_active and before_roles=array['finance'] and after_roles=before_roles and before_revision=2 and after_revision=3) then raise exception 'Evento reativação inconsistente';end if;
end $$;
reset role;
create function pg_temp.fail_member_state_audit() returns trigger language plpgsql as $$begin
 if new.member_id='00000000-0000-4000-8000-000000002804' and new.operation in ('deactivated','reactivated') then raise check_violation using message='Falha fictícia de histórico';end if;return new;end $$;
create trigger fictitious_state_audit_failure before insert on public.hub_role_audit for each row execute function pg_temp.fail_member_state_audit();
set local role authenticated;
do $$ declare w uuid:='00000000-0000-4000-8000-000000002805';m uuid:='00000000-0000-4000-8000-000000002804';n bigint;begin
 select count(*) into n from public.hub_role_audit where workspace_id=w;
 begin perform public.hub_update_member_active(w,m,false,3);raise exception 'Falha de evento não abortou';exception when check_violation then null;end;
 if not exists(select 1 from public.hub_list_members(w) where user_id=m and active and revision='3') or (select count(*) from public.hub_role_audit where workspace_id=w)<>n then raise exception 'Mudança sobreviveu sem histórico';end if;
end $$;
reset role;
drop trigger fictitious_state_audit_failure on public.hub_role_audit;
set local role authenticated;
select public.hub_update_member_active('00000000-0000-4000-8000-000000002805','00000000-0000-4000-8000-000000002804',false,3)->>'status';
reset role;
create trigger fictitious_state_audit_failure before insert on public.hub_role_audit for each row execute function pg_temp.fail_member_state_audit();
set local role authenticated;
do $$ declare w uuid:='00000000-0000-4000-8000-000000002805';m uuid:='00000000-0000-4000-8000-000000002804';n bigint;begin
 select count(*) into n from public.hub_role_audit where workspace_id=w;
 begin perform public.hub_update_member_active(w,m,true,4);raise exception 'Reativação sobreviveu sem evento';exception when check_violation then null;end;
 if not exists(select 1 from public.hub_list_members(w) where user_id=m and not active and revision='4') or (select count(*) from public.hub_role_audit where workspace_id=w)<>n then raise exception 'Rollback de reativação inconsistente';end if;
end $$;
reset role;
drop trigger fictitious_state_audit_failure on public.hub_role_audit;
do $$ begin
 if has_function_privilege('anon','public.hub_update_member_active(uuid,uuid,boolean,bigint)','execute') then raise exception 'Anon executa alteração de estado';end if;
 if has_table_privilege('authenticated','public.hub_members','UPDATE') or has_table_privilege('authenticated','public.hub_role_audit','INSERT,UPDATE,DELETE,TRUNCATE') then raise exception 'Grants diretos excessivos';end if;
 if (select count(*) from auth.users where id between '00000000-0000-4000-8000-000000002801' and '00000000-0000-4000-8000-000000002804')<>4 then raise exception 'Conta Auth removida';end if;
end $$;
rollback;
