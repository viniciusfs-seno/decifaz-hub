begin;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000002201','socio-a@example.invalid'),('00000000-0000-4000-8000-000000002202','socio-b@example.invalid');
insert into public.hub_workspaces(id,name) values ('00000000-0000-4000-8000-000000002210','Nomes fictícios'),('00000000-0000-4000-8000-000000002211','Outro espaço fictício');
insert into public.hub_members(workspace_id,user_id,role) values
 ('00000000-0000-4000-8000-000000002210','00000000-0000-4000-8000-000000002201','admin'),
 ('00000000-0000-4000-8000-000000002210','00000000-0000-4000-8000-000000002202','commercial'),
 ('00000000-0000-4000-8000-000000002211','00000000-0000-4000-8000-000000002202','admin');
create temporary table before_members as select to_jsonb(m) as data from public.hub_members m;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002201',true);
do $$ declare w uuid:='00000000-0000-4000-8000-000000002210';u uuid:='00000000-0000-4000-8000-000000002202';r jsonb;begin
 r:=public.hub_set_member_label(w,u,'  Caio   Fictício ',0);if r->>'status'<>'saved' or r->>'display_name'<>'Caio Fictício' or (r->>'revision')::int<>1 then raise exception 'Nome não persistido';end if;
 if not exists(select 1 from jsonb_array_elements(public.hub_registry_people(w)) p where p->>'id'=u::text and p->>'name'='Caio Fictício') then raise exception 'Diretório não atualizado';end if;
 if public.hub_set_member_label(w,u,'Outra edição fictícia',0)->>'status'<>'conflict' then raise exception 'Edição desatualizada aceita';end if;
 if public.hub_set_member_label(w,u,'Caio Fictício',1)->>'status'<>'saved' then raise exception 'Repetição negada';end if;
 if (select count(*) from public.hub_registry_events where workspace_id=w and kind='member')<>1 then raise exception 'Evento duplicado/ausente';end if;
 begin perform public.hub_set_member_label('00000000-0000-4000-8000-000000002211',u,'Externo',0);raise exception 'Outro espaço alterado';exception when insufficient_privilege then null;end;
 begin perform public.hub_set_member_label(w,u,repeat('x',81),1);raise exception 'Nome longo aceito';exception when invalid_parameter_value then null;end;
 begin perform * from hub_private.member_labels;raise exception 'Leitura privada liberada';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000002202',true);
do $$ declare w uuid:='00000000-0000-4000-8000-000000002210';begin
 begin perform public.hub_member_labels(w);raise exception 'Comercial leu configuração';exception when insufficient_privilege then null;end;
 begin perform public.hub_set_member_label(w,auth.uid(),'Nome indevido',1);raise exception 'Comercial editou nome';exception when insufficient_privilege then null;end;
 if exists(select 1 from jsonb_array_elements(public.hub_registry_people('00000000-0000-4000-8000-000000002211')) p where p->>'name'='Caio Fictício') then raise exception 'Nome atravessou espaço';end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.hub_member_labels('00000000-0000-4000-8000-000000002210');raise exception 'Anônimo listou nomes';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if exists((select to_jsonb(m) from public.hub_members m except select data from before_members) union all(select data from before_members except select to_jsonb(m) from public.hub_members m)) then raise exception 'Vínculos, papéis ou revisões alterados';end if;
end $$;
rollback;
