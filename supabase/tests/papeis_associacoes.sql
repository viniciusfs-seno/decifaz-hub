begin;
insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000001051'),('00000000-0000-4000-8000-000000001052');
insert into public.hub_workspaces(id,name) values
 ('00000000-0000-4000-8000-000000001053','Associações fictícias');
insert into public.hub_members(workspace_id,user_id,role) values
 ('00000000-0000-4000-8000-000000001053','00000000-0000-4000-8000-000000001051','admin');
do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='hub_members' and column_name='role' and column_default is not null) then
  raise exception 'O DEFAULT de papel deve estar removido';
 end if;
 if has_column_privilege('authenticated','public.hub_proposals','record','SELECT')
 or has_column_privilege('authenticated','public.hub_projects','approved','SELECT') then
  raise exception 'A leitura bruta precisa estar revogada';
 end if;
 begin
  insert into public.hub_members(workspace_id,user_id) values('00000000-0000-4000-8000-000000001053','00000000-0000-4000-8000-000000001052');
  raise exception 'Papel omitido foi aceito';
 exception when not_null_violation then null;
 end;
 begin
  insert into public.hub_members(workspace_id,user_id,role) values('00000000-0000-4000-8000-000000001053','00000000-0000-4000-8000-000000001052',null);
  raise exception 'Papel nulo foi aceito';
 exception when not_null_violation then null;
 end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001051',true);
do $$ declare w uuid:='00000000-0000-4000-8000-000000001053'; begin
 if public.hub_set_role(w,auth.uid(),'commercial') then raise exception 'Último administrador removido'; end if;
 if public.hub_set_role(w,'00000000-0000-4000-8000-000000001052',null) then raise exception 'RPC aceitou papel nulo'; end if;
 if not public.hub_set_role(w,'00000000-0000-4000-8000-000000001052','commercial') then raise exception 'Administrador não atribuiu papel explícito'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001052',true);
do $$ declare w uuid:='00000000-0000-4000-8000-000000001053'; begin
 if public.hub_set_role(w,auth.uid(),'admin') then raise exception 'Autoelevação permitida'; end if;
 if public.hub_can(w,'finance') then raise exception 'Comercial acessou Financeiro'; end if;
 if public.hub_can('00000000-0000-4000-8000-000000001099','commercial') then raise exception 'Acesso a outro espaço'; end if;
 begin
  update public.hub_members set role='admin' where workspace_id=w and user_id=auth.uid();
  raise exception 'Atualização direta de papel permitida';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
