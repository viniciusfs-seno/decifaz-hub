begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000002101','admin-diretorio@example.invalid','{"full_name":"  Marina   Fictícia  "}'),
 ('00000000-0000-4000-8000-000000002102','comercial-teste@example.invalid','{}'),
 ('00000000-0000-4000-8000-000000002103','antigo-teste@example.invalid','{"name":"Caio Fictício"}'),
 ('00000000-0000-4000-8000-000000002104','externo-teste@example.invalid','{"full_name":"Pessoa de outro espaço"}'),
 ('00000000-0000-4000-8000-000000002105',null,'{}'),
 ('00000000-0000-4000-8000-000000002106','nome-repetido@example.invalid','{"full_name":"Marina Fictícia"}');
insert into public.hub_workspaces(id,name) values
 ('00000000-0000-4000-8000-000000002110','Diretório fictício'),('00000000-0000-4000-8000-000000002111','Diretório externo fictício');
insert into public.hub_members(workspace_id,user_id,role,active) values
 ('00000000-0000-4000-8000-000000002110','00000000-0000-4000-8000-000000002101','admin',true),
 ('00000000-0000-4000-8000-000000002110','00000000-0000-4000-8000-000000002102','commercial',true),
 ('00000000-0000-4000-8000-000000002110','00000000-0000-4000-8000-000000002103','commercial',false),
 ('00000000-0000-4000-8000-000000002111','00000000-0000-4000-8000-000000002104','admin',true),
 ('00000000-0000-4000-8000-000000002110','00000000-0000-4000-8000-000000002105','operations',true),
 ('00000000-0000-4000-8000-000000002110','00000000-0000-4000-8000-000000002106','finance',true);
create temporary table member_snapshot as select md5(to_jsonb(m)::text) digest from public.hub_members m;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002102',true);
do $$ declare w uuid:='00000000-0000-4000-8000-000000002110'; people jsonb; assignees jsonb;begin
 people:=public.hub_registry_people(w);assignees:=public.hub_work_assignees(w);
 if jsonb_array_length(people)<>5 or jsonb_array_length(assignees)<>4 then raise exception 'Diretório/ativos incorretos';end if;
 if not exists(select 1 from jsonb_array_elements(people) p where p->>'id'='00000000-0000-4000-8000-000000002102' and p->>'name'='Conta comercial-teste') then raise exception 'Fallback de conta ilegível';end if;
 if not exists(select 1 from jsonb_array_elements(people) p where p->>'name'='Caio Fictício' and p->>'active'='false') then raise exception 'Histórico perdeu integrante desativado';end if;
 if exists(select 1 from jsonb_array_elements(assignees) p where p->>'name'='Caio Fictício') then raise exception 'Desativado atribuível';end if;
 if not exists(select 1 from jsonb_array_elements(people) p where p->>'name' like 'Integrante sem nome · %') then raise exception 'Fallback sem e-mail ausente';end if;
 if (select count(distinct p->>'name') from jsonb_array_elements(people) p)<>5 then raise exception 'Nomes repetidos ambíguos';end if;
 if exists(select 1 from jsonb_array_elements(people) p where p->>'name' like '%outro espaço%' or p ? 'email' or p ? 'roles') then raise exception 'Dados externos/desnecessários expostos';end if;
 begin perform public.hub_registry_people('00000000-0000-4000-8000-000000002111');raise exception 'Outro espaço consultado';exception when insufficient_privilege then null;end;
 begin perform hub_private.workspace_people(w);raise exception 'Helper privado acessível';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002103',true);
do $$ begin
 begin perform public.hub_registry_people('00000000-0000-4000-8000-000000002110');raise exception 'Sessão desativada consultou histórico';exception when insufficient_privilege then null;end;
 begin perform public.hub_work_assignees('00000000-0000-4000-8000-000000002110');raise exception 'Sessão desativada consultou responsáveis';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$ begin
 begin perform public.hub_registry_people('00000000-0000-4000-8000-000000002110');raise exception 'Anônimo consultou diretório';exception when insufficient_privilege then null;end;
 begin perform public.hub_work_assignees('00000000-0000-4000-8000-000000002110');raise exception 'Anônimo consultou responsáveis';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if exists((select md5(to_jsonb(m)::text) from public.hub_members m except select digest from member_snapshot) union all (select digest from member_snapshot except select md5(to_jsonb(m)::text) from public.hub_members m)) then raise exception 'Vínculos ou revisões alterados';end if;
end $$;
rollback;
