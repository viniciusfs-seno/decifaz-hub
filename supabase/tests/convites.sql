begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-000000002251','admin-convite@example.invalid',now()),
 ('00000000-0000-4000-8000-000000002252','admin-externo@example.invalid',now()),
 ('00000000-0000-4000-8000-000000002253','destinatario@example.invalid',null),
 ('00000000-0000-4000-8000-000000002254','outro-destinatario@example.invalid',now()),
 ('00000000-0000-4000-8000-000000002255','existente@example.invalid',now()),
 ('00000000-0000-4000-8000-000000002256','concedente-inativo@example.invalid',now());
insert into public.hub_workspaces(id,name) values ('00000000-0000-4000-8000-000000002257','Convites fictícios'),('00000000-0000-4000-8000-000000002258','Convites isolados');
insert into public.hub_members(workspace_id,user_id,role) values ('00000000-0000-4000-8000-000000002257','00000000-0000-4000-8000-000000002251','admin'),('00000000-0000-4000-8000-000000002258','00000000-0000-4000-8000-000000002252','admin');
insert into public.hub_leads(workspace_id,id,name) values('00000000-0000-4000-8000-000000002257','00000000-0000-4000-8000-000000002259','Lead inacessível antes do aceite');
create temp table invite_fixture(k text primary key,id uuid);
grant all on invite_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002251',true);
do $$ declare w uuid:='00000000-0000-4000-8000-000000002257'; r jsonb; begin
 r:=public.hub_create_invite(w,' DESTINATARIO@example.invalid ',array['operations','finance']);
 if r->>'status'<>'created' then raise exception 'Convite não criado';end if;
 insert into invite_fixture values('main',(r->>'id')::uuid);
 if public.hub_create_invite(w,'destinatario@example.invalid',array['admin'])->>'status'<>'pending_exists' then raise exception 'Convite ativo duplicado';end if;
 if public.hub_create_invite(w,'invalido',array['admin'])->>'status'<>'invalid' or public.hub_create_invite(w,'x@example.invalid','{}')->>'status'<>'invalid' or public.hub_create_invite(w,'x@example.invalid',array['unknown'])->>'status'<>'invalid' then raise exception 'Entrada inválida aceita';end if;
 if (select count(*) from public.hub_list_invites(w))<>1 then raise exception 'Listagem incorreta';end if;
 begin perform * from public.hub_list_invites('00000000-0000-4000-8000-000000002258');raise exception 'Admin leu outro espaço';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002252',true);
do $$ begin
 begin perform public.hub_create_invite('00000000-0000-4000-8000-000000002257','x@example.invalid',array['admin']);raise exception 'Admin externo convidou';exception when insufficient_privilege then null;end;
 begin perform public.hub_revoke_invite((select id from invite_fixture where k='main'));raise exception 'Admin externo revogou';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002254',true);
do $$ begin
 if public.hub_accept_invite((select id from invite_fixture where k='main'))->>'status'<>'unavailable' then raise exception 'Conta errada aceitou';end if;
 begin perform * from public.hub_list_invites('00000000-0000-4000-8000-000000002257');raise exception 'Usuário comum geriu convite';exception when insufficient_privilege then null;end;
 begin perform public.hub_create_invite('00000000-0000-4000-8000-000000002257','x@example.invalid',array['admin']);raise exception 'Usuário comum convidou';exception when insufficient_privilege then null;end;
 begin perform public.hub_revoke_invite((select id from invite_fixture where k='main'));raise exception 'Usuário comum revogou';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002253',true);
do $$ begin
 if public.hub_accept_invite((select id from invite_fixture where k='main'))->>'status'<>'unavailable' then raise exception 'E-mail não verificado aceitou';end if;
 begin perform * from public.hub_my_invites();raise exception 'Não verificado leu convites';exception when insufficient_privilege then null;end;
 if public.hub_can('00000000-0000-4000-8000-000000002257','commercial') or exists(select 1 from public.hub_leads) then raise exception 'Pendente ganhou acesso';end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.hub_members where user_id='00000000-0000-4000-8000-000000002253') then raise exception 'Pendente criou vínculo';end if;
 if (select count(*) from public.hub_role_audit where workspace_id='00000000-0000-4000-8000-000000002257')<>1 then raise exception 'Pendente criou concessão';end if;
 if not exists(select 1 from public.hub_invites where id=(select id from invite_fixture where k='main') and roles=array['finance','operations'] and expires_at>=created_at+interval '7 days' and expires_at<created_at+interval '7 days 1 second') then raise exception 'Papéis ou validade incorretos';end if;
end $$;
update auth.users set email_confirmed_at=now() where id='00000000-0000-4000-8000-000000002253';
set local role authenticated;
do $$ declare r jsonb; begin
 if (select count(*) from public.hub_my_invites())<>1 then raise exception 'Destinatário não consultou';end if;
 if public.hub_can('00000000-0000-4000-8000-000000002257','finance') then raise exception 'Verificação aceitou automaticamente';end if;
 r:=public.hub_accept_invite((select id from invite_fixture where k='main'));
 if r->>'status'<>'accepted' or r->>'outcome'<>'linked' then raise exception 'Aceite falhou';end if;
 if public.hub_accept_invite((select id from invite_fixture where k='main'))->>'repeated'<>'true' then raise exception 'Repetição não idempotente';end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.hub_members where workspace_id='00000000-0000-4000-8000-000000002257' and user_id='00000000-0000-4000-8000-000000002253' and array[role]||extra_roles=array['finance','operations'] and role_revision=0) then raise exception 'Conjunto concedido incorreto';end if;
 if (select count(*) from public.hub_role_audit where invite_id=(select id from invite_fixture where k='main'))<>1 then raise exception 'Concessão duplicada';end if;
 if not exists(select 1 from public.hub_role_audit where invite_id=(select id from invite_fixture where k='main') and actor_id='00000000-0000-4000-8000-000000002253' and accepted_by=actor_id and grantor_id='00000000-0000-4000-8000-000000002251' and member_id=actor_id and operation='created') then raise exception 'Concedente confundido com aceitante';end if;
 if exists(select 1 from hub_private.invite_acceptance) then raise exception 'Contexto privado persistiu';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002251',true);
do $$ begin
 if public.hub_revoke_invite((select id from invite_fixture where k='main')) then raise exception 'Aceito foi revogado como pendente';end if;
 if public.hub_create_invite('00000000-0000-4000-8000-000000002257','destinatario@example.invalid',array['admin'])->>'status'<>'existing_member' then raise exception 'Convidou vínculo já existente';end if;
end $$;
insert into invite_fixture select 'revoked',(public.hub_create_invite('00000000-0000-4000-8000-000000002257','outro-destinatario@example.invalid',array['commercial'])->>'id')::uuid;
do $$ begin if not public.hub_revoke_invite((select id from invite_fixture where k='revoked')) or public.hub_revoke_invite((select id from invite_fixture where k='revoked')) then raise exception 'Revogação incorreta';end if;end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002254',true);
do $$ begin if public.hub_accept_invite((select id from invite_fixture where k='revoked'))->>'status'<>'unavailable' then raise exception 'Revogado aceito';end if;end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002251',true);
insert into invite_fixture select 'expired',(public.hub_create_invite('00000000-0000-4000-8000-000000002257','outro-destinatario@example.invalid',array['commercial'])->>'id')::uuid;
reset role;
update public.hub_invites set created_at=now()-interval '8 days',expires_at=now()-interval '1 day' where id=(select id from invite_fixture where k='expired');
set local role authenticated;
do $$ begin if not exists(select 1 from public.hub_list_invites('00000000-0000-4000-8000-000000002257') where id=(select id from invite_fixture where k='expired') and state='expired') then raise exception 'Expirado não exibido';end if;end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002254',true);
do $$ begin if public.hub_accept_invite((select id from invite_fixture where k='expired'))->>'status'<>'unavailable' then raise exception 'Expirado aceito';end if;end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002251',true);
insert into invite_fixture select 'rollback',(public.hub_create_invite('00000000-0000-4000-8000-000000002257','outro-destinatario@example.invalid',array['operations'])->>'id')::uuid;
insert into invite_fixture select 'existing',(public.hub_create_invite('00000000-0000-4000-8000-000000002257','existente@example.invalid',array['admin'])->>'id')::uuid;
do $$ begin
 if not public.hub_set_roles('00000000-0000-4000-8000-000000002257','00000000-0000-4000-8000-000000002255',array['finance']) then raise exception 'Fixture vínculo existente';end if;
 begin perform * from public.hub_invites;raise exception 'Leitura direta expôs convites';exception when insufficient_privilege then null;end;
 begin update public.hub_invites set roles=array['admin'];raise exception 'Escrita direta em convite';exception when insufficient_privilege then null;end;
 begin perform * from hub_private.invite_acceptance;raise exception 'Contexto privado exposto';exception when insufficient_privilege then null;end;
 if has_table_privilege('authenticated','hub_private.invite_acceptance','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Contexto privado gravável';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002255',true);
do $$ begin if public.hub_accept_invite((select id from invite_fixture where k='existing'))->>'outcome'<>'existing_member' then raise exception 'Vínculo existente substituído';end if;end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.hub_members where user_id='00000000-0000-4000-8000-000000002255' and role='finance' and cardinality(extra_roles)=0 and role_revision=0) or exists(select 1 from public.hub_role_audit where invite_id=(select id from invite_fixture where k='existing')) then raise exception 'Vínculo existente sofreu concessão';end if;
end $$;
create function pg_temp.reject_invite_event() returns trigger language plpgsql as $$ begin if new.invite_id is not null then raise check_violation using message='Falha fictícia no histórico';end if;return new;end $$;
create trigger fictitious_invite_failure before insert on public.hub_role_audit for each row execute function pg_temp.reject_invite_event();
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002254',true);
do $$ begin begin perform public.hub_accept_invite((select id from invite_fixture where k='rollback'));raise exception 'Histórico não falhou';exception when check_violation then null;end;end $$;
reset role;
do $$ begin
 if exists(select 1 from public.hub_members where user_id='00000000-0000-4000-8000-000000002254') or exists(select 1 from public.hub_role_audit where invite_id=(select id from invite_fixture where k='rollback')) or exists(select 1 from hub_private.invite_acceptance) or not exists(select 1 from public.hub_invites where id=(select id from invite_fixture where k='rollback') and status='pending' and accepted_by is null) then raise exception 'Falha no histórico não reverteu tudo';end if;
end $$;
drop trigger fictitious_invite_failure on public.hub_role_audit;
set local role authenticated;
do $$ begin if public.hub_accept_invite((select id from invite_fixture where k='rollback'))->>'status'<>'accepted' then raise exception 'Retry após rollback falhou';end if;end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002251',true);
insert into invite_fixture select 'inactive',(public.hub_create_invite('00000000-0000-4000-8000-000000002257','concedente-inativo@example.invalid',array['admin'])->>'id')::uuid;
do $$ begin perform public.hub_set_roles('00000000-0000-4000-8000-000000002257','00000000-0000-4000-8000-000000002252',array['admin']);end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002252',true);
do $$ begin perform public.hub_set_roles('00000000-0000-4000-8000-000000002257','00000000-0000-4000-8000-000000002251',array['commercial']);end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002256',true);
do $$ begin if public.hub_accept_invite((select id from invite_fixture where k='inactive'))->>'status'<>'issuer_unavailable' then raise exception 'Concedente inativo concedeu';end if;end $$;
set local role anon;
do $$ begin begin perform public.hub_accept_invite('00000000-0000-0000-0000-000000000000');raise exception 'Anônimo aceitou';exception when insufficient_privilege then null;end;end $$;
rollback;
