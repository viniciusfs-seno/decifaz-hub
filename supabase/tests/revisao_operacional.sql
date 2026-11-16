begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000003001','review-admin@example.invalid'),
 ('00000000-0000-4000-8000-000000003002','review-commercial@example.invalid'),
 ('00000000-0000-4000-8000-000000003003','review-operations@example.invalid');
insert into public.hub_workspaces(id,name) values('00000000-0000-4000-8000-000000003010','Revisão fictícia'),('00000000-0000-4000-8000-000000003011','Isolamento fictício');
insert into public.hub_members(workspace_id,user_id,role) values
 ('00000000-0000-4000-8000-000000003010','00000000-0000-4000-8000-000000003001','admin'),
 ('00000000-0000-4000-8000-000000003010','00000000-0000-4000-8000-000000003002','commercial'),
 ('00000000-0000-4000-8000-000000003010','00000000-0000-4000-8000-000000003003','operations');
insert into public.hub_leads(workspace_id,id,name) values
 ('00000000-0000-4000-8000-000000003010','00000000-0000-4000-8000-000000003020','Origem fictícia'),
 ('00000000-0000-4000-8000-000000003011','00000000-0000-4000-8000-000000003021','Origem externa');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003002',true);
do $$ declare w uuid:='00000000-0000-4000-8000-000000003010';s uuid:='00000000-0000-4000-8000-000000003020';a uuid;b uuid;begin
 a:=public.hub_review_action(w,'lead',s,'Ação fictícia','Equipe fictícia','2026-11-16');
 b:=public.hub_review_action(w,'lead',s,'Não sobrescrever','Outra equipe','2026-11-17');
 if a<>b or not exists(select 1 from public.hub_activities where id=a and title='Ação fictícia' and owner='Equipe fictícia' and due_on='2026-11-16') then raise exception 'Origem duplicada ou sobrescrita';end if;
 begin perform public.hub_review_action(w,'lead','00000000-0000-4000-8000-000000003021','Externo','Teste',current_date);raise exception 'Origem externa aceita';exception when insufficient_privilege then null;end;
 begin perform public.hub_review_action('00000000-0000-4000-8000-000000003011','lead','00000000-0000-4000-8000-000000003021','Externo','Teste',current_date);raise exception 'Espaço externo aceito';exception when insufficient_privilege then null;end;
 begin update public.hub_activities set review_id=gen_random_uuid() where id=a;raise exception 'Origem adulterada';exception when insufficient_privilege then null;end;
 update public.hub_activities set status='Concluída' where id=a;
 b:=public.hub_review_action(w,'lead',s,'Próxima ação','Equipe fictícia',current_date);
 if a=b then raise exception 'Nova revisão não criou próxima ação';end if;
end $$;
reset role;
insert into public.hub_proposals(workspace_id,id,lead_id,series_id,version,status,record) values
 ('00000000-0000-4000-8000-000000003010','00000000-0000-4000-8000-000000003030','00000000-0000-4000-8000-000000003020','00000000-0000-4000-8000-000000003030',1,'Aceita','{"title":"Entrega fictícia","setup":500,"monthly":50,"terms":"Reservado"}');
insert into public.hub_projects(workspace_id,proposal_id,lead_id,approved) values
 ('00000000-0000-4000-8000-000000003010','00000000-0000-4000-8000-000000003030','00000000-0000-4000-8000-000000003020','{"title":"Entrega fictícia","version":1,"setup":500,"monthly":50,"terms":"Reservado"}');
set local role authenticated;
do $$ declare w uuid:='00000000-0000-4000-8000-000000003010';s uuid:='00000000-0000-4000-8000-000000003030';begin
 perform public.hub_review_action(w,'proposal',s,'Revisar proposta','Comercial fictício',current_date);
 begin perform public.hub_review_action(w,'project',s,'Revisar projeto','Comercial fictício',current_date);raise exception 'Comercial escreveu em projeto';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003003',true);
do $$ declare w uuid:='00000000-0000-4000-8000-000000003010';p uuid:='00000000-0000-4000-8000-000000003030';a uuid;begin
 a:=public.hub_review_action(w,'project',p,'Revisar entrega','Operação fictícia',current_date);
 if not exists(select 1 from public.hub_activities where id=a and project_proposal_id=p and lead_id='00000000-0000-4000-8000-000000003020') then raise exception 'Vínculo de projeto não derivado';end if;
 begin perform public.hub_review_action(w,'proposal',p,'Revisar preço','Operação fictícia',current_date);raise exception 'Operação escreveu proposta';exception when insufficient_privilege then null;end;
end $$;
do $$ begin
 begin perform public.hub_review_action('00000000-0000-4000-8000-000000003010','lead','00000000-0000-4000-8000-000000003020','Proibida','Equipe',current_date);raise exception 'Operação escreveu comercial';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.hub_members set active=false where user_id='00000000-0000-4000-8000-000000003002';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000003002',true);
do $$ begin
 begin perform public.hub_review_action('00000000-0000-4000-8000-000000003010','lead','00000000-0000-4000-8000-000000003020','Proibida','Equipe',current_date);raise exception 'Desativado escreveu';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.hub_activities) then raise exception 'Sessão desativada leu ações';end if;
 if has_function_privilege('anon','public.hub_review_action(uuid,text,uuid,text,text,date)','execute') then raise exception 'RPC anônima';end if;
end $$;
rollback;
