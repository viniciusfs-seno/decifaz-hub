begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000061'),('00000000-0000-4000-8000-000000000062');
insert into public.hub_workspaces(id,name) values('00000000-0000-4000-8000-000000000063','Fixture');
insert into public.hub_members values('00000000-0000-4000-8000-000000000063','00000000-0000-4000-8000-000000000061');
insert into public.hub_leads(workspace_id,id,name) values('00000000-0000-4000-8000-000000000063','00000000-0000-4000-8000-000000000064','Fixture');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000061',true);
do $$
declare w uuid:='00000000-0000-4000-8000-000000000063'; l uuid:='00000000-0000-4000-8000-000000000064'; p uuid:='00000000-0000-4000-8000-000000000065'; i uuid:='00000000-0000-4000-8000-000000000066'; j uuid:='00000000-0000-4000-8000-000000000067'; dt date:=(now() at time zone 'America/Fortaleza')::date; m date:='0001-01-01';
begin
 if not public.hub_save_proposal(w,l,p,p,1,null,'{"title":"Teste","scope":"Original","validity":"2026-11-30","setup":50,"monthly":10,"services":[]}',null,null,null)
 or not public.hub_save_proposal(w,l,p,p,1,null,null,'Enviada',dt,'Envio')
 or not public.hub_save_proposal(w,l,p,p,1,null,null,'Aceita',dt,'Aceite')
 or not public.hub_open_project(w,p) or not public.hub_forecast(w,p,'Implantação',dt)
 or not public.hub_receive(w,p,'Implantação',m,i,dt,50) then raise exception 'initial flow'; end if;
 if public.hub_reverse_receipt(w,p,'Implantação',m,i,'') or not public.hub_reverse_receipt(w,p,'Implantação',m,i,'Erro')
 or public.hub_reverse_receipt(w,p,'Implantação',m,i,'Duplicado') or public.hub_receive(w,p,'Implantação',m,i,dt,50)
 or not public.hub_receive(w,p,'Implantação',m,j,dt,50) then raise exception 'reversal'; end if;
 insert into public.hub_expenses(workspace_id,id,title,due_on,amount) values(w,i,'Despesa',dt,10);
 update public.hub_expenses set paid_on=dt,paid_amount=12 where workspace_id=w and id=i;
 update public.hub_expenses set paid_on=dt,paid_amount=14 where workspace_id=w and id=i;
 if not exists(select 1 from public.hub_expenses where workspace_id=w and amount=10 and paid_amount=12) then raise exception 'expense'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000062',true);
 if exists(select 1 from public.hub_expenses where workspace_id=w) or public.hub_reverse_receipt(w,p,'Implantação',m,j,'Intruso') then raise exception 'isolation'; end if;
end $$;
rollback;