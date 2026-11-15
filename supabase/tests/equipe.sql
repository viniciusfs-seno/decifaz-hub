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
 if (select revision from public.hub_list_members(w) where user_id='00000000-0000-4000-8000-000000001552')<>'1' then raise exception 'RPC legada não avançou revisão';end if;
 if (public.hub_update_member_roles(w,'00000000-0000-4000-8000-000000001552',array['commercial'],1)->>'status')<>'saved' then raise exception 'Gravação revisada negada';end if;
 if public.hub_update_member_roles(w,'00000000-0000-4000-8000-000000001552',array['finance'],1) <> '{"status":"conflict","roles":["commercial"],"revision":"2"}'::jsonb then raise exception 'Conflito não retornou conjunto vigente';end if;
 -- ABA: even changing back to the old set invalidates an older editor.
 if not public.hub_set_roles(w,'00000000-0000-4000-8000-000000001552',array['finance','operations']) then raise exception 'Compatibilidade legada perdida';end if;
 if (public.hub_update_member_roles(w,'00000000-0000-4000-8000-000000001552',array['commercial'],1)->>'status')<>'conflict' then raise exception 'ABA aceito';end if;
 if (public.hub_update_member_roles(w,auth.uid(),array['commercial'],0)->>'status')<>'rejected' then raise exception 'Último admin removido pela RPC revisada';end if;
 if (public.hub_update_member_roles(w,auth.uid(),array['admin'],null)->>'status')<>'rejected' then raise exception 'Revisão omitida aceita';end if;
 if (public.hub_update_member_roles(w,auth.uid(),array['unknown'],0)->>'status')<>'rejected' then raise exception 'Papel inválido aceito';end if;
 if (public.hub_update_member_roles(w,'00000000-0000-4000-8000-000000001553',array['commercial'],0)->>'status')<>'missing' then raise exception 'RPC revisada criou vínculo ausente';end if;
 begin perform public.hub_update_member_roles('00000000-0000-4000-8000-000000001555','00000000-0000-4000-8000-000000001553',array['finance'],0);raise exception 'Escrita revisada em outro espaço';exception when insufficient_privilege then null;end;
 if public.hub_set_roles(w,auth.uid(),array['commercial']) then raise exception 'Último administrador removido';end if;
 begin perform * from public.hub_list_members('00000000-0000-4000-8000-000000001555');raise exception 'Diretório externo acessível';exception when insufficient_privilege then null;end;
 if public.hub_set_roles('00000000-0000-4000-8000-000000001555','00000000-0000-4000-8000-000000001553',array['finance']) then raise exception 'Admin alterou espaço externo';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001552',true);
do $$ begin
 begin perform * from public.hub_list_members('00000000-0000-4000-8000-000000001554');raise exception 'Usuário comum listou equipe';exception when insufficient_privilege then null;end;
 if public.hub_set_roles('00000000-0000-4000-8000-000000001554','00000000-0000-4000-8000-000000001551',array['finance']) then raise exception 'Usuário comum editou admin';end if;
 begin perform public.hub_update_member_roles('00000000-0000-4000-8000-000000001554','00000000-0000-4000-8000-000000001551',array['finance'],0);raise exception 'Usuário comum editou pela RPC revisada';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.hub_list_members('00000000-0000-4000-8000-000000001554');raise exception 'Anônimo listou equipe';exception when insufficient_privilege then null;end;
 begin perform public.hub_update_member_roles('00000000-0000-4000-8000-000000001554','00000000-0000-4000-8000-000000001551',array['finance'],0);raise exception 'Anônimo editou equipe';exception when insufficient_privilege then null;end;
end $$;
rollback;
