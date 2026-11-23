-- TEMPLATE MANUAL: executar somente após autorização de publicação/ativação.
-- Não é migração. Não agenda e-mail, HTTP, Edge ou pg_net.
-- Na sessão aprovada: SET hub.notice_activation = 'approved';
begin;
do $$ begin
 if current_setting('hub.notice_activation',true) is distinct from 'approved' then raise exception 'Ativação não aprovada nesta sessão';end if;
end $$;
create extension if not exists pg_cron;
select cron.schedule('hub-notice-generation','* * * * *','select hub_private.notice_tick()');
-- Remove a dispatcher from an earlier rehearsal, without touching other jobs.
do $$ begin
 perform cron.unschedule(jobid) from cron.job where jobname='hub-notice-outbox';
end $$;
update hub_private.notice_settings set generation_enabled=true,mail_enabled=false,sandbox_only=true;
commit;
