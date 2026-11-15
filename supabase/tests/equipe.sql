begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000001551','admin-equipe@example.invalid'),
 ('00000000-0000-4000-8000-000000001552','membro-equipe@example.invalid'),
 ('00000000-0000-4000-8000-000000001553','externo-equipe@example.invalid');
insert into public.hub_workspaces(id,name) values
 ('00000000-0000-4000-8000-000000001554','Equipe fictícia'),
 ('00000000-0000-4000-8000-000000001555','Equipe isolada');
insert into public.hub_members(workspace_id,user_id,role) values
 ('00000000-0000-4000-8000-000000001554','00000000-0000-4000-8000-000000001551','admin'),
 ('00000000-0000-4000-8000-000000001554','00000000-0000-4000-8000-000000001552','commercial'),
 ('00000000-0000-4000-8000-000000001555','00000000-0000-4000-8000-000000001553','admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001551',true);
do $$ declare w uuid:='00000000-0000-4000-8000-000000001554'; begin
 if (select count(*) from public.hub_list_members(w))<>2 then raise exception 'Diretório incompleto';end if;
 if not public.hub_set_roles(w,'00000000-0000-4000-8000-000000001552',array['operations','finance']) then raise exception 'Admin não editou outro vínculo';end if;
 if not exists(select 1 from public.hub_list_members(w) where user_id='00000000-0000-4000-8000-000000001552' and roles=array['finance','operations']) then raise exception 'Conjunto não persistido';end if;
 if public.hub_set_roles(w,auth.uid(),array['commercial']) then raise exception 'Último administrador removido';end if;
 begin perform * from public.hub_list_members('00000000-0000-4000-8000-000000001555');raise exception 'Diretório externo acessível';exception when insufficient_privilege then null;end;
 if public.hub_set_roles('00000000-0000-4000-8000-000000001555','00000000-0000-4000-8000-000000001553',array['finance']) then raise exception 'Admin alterou espaço externo';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001552',true);
do $$ begin
 begin perform * from public.hub_list_members('00000000-0000-4000-8000-000000001554');raise exception 'Usuário comum listou equipe';exception when insufficient_privilege then null;end;
 if public.hub_set_roles('00000000-0000-4000-8000-000000001554','00000000-0000-4000-8000-000000001551',array['finance']) then raise exception 'Usuário comum editou admin';end if;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.hub_list_members('00000000-0000-4000-8000-000000001554');raise exception 'Anônimo listou equipe';exception when insufficient_privilege then null;end;
end $$;
rollback;
