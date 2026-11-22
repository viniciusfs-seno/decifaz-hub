-- TEMPLATE MANUAL. NÃO é migração. NÃO executar em produção nesta entrega.
-- Exige aprovação futura, dry-run, Edge configurada e conferência do ambiente.
-- No editor SQL da instância aprovada: SET hub.notice_activation = 'approved';
begin;
do $$ begin
 if current_setting('hub.notice_activation',true) is distinct from 'approved' then raise exception 'Ativação não aprovada nesta sessão';end if;
end $$;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
-- Segredos criados diretamente no Vault do ambiente, nunca no arquivo/CI:
-- hub_notice_project_url: URL HTTPS da instância aprovada (sem chave).
-- hub_notice_worker_secret: mesmo segredo aleatório da Edge (>=32 caracteres).
create or replace function hub_private.dispatch_notice_worker() returns void language plpgsql security definer set search_path='' as $$
declare endpoint text;credential text;
begin
 if not exists(select 1 from hub_private.notice_settings where generation_enabled and mail_enabled) then return;end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='hub_notice_project_url';
 select decrypted_secret into credential from vault.decrypted_secrets where name='hub_notice_worker_secret';
 if endpoint is null or endpoint!~'^https://[a-z0-9-]+\.supabase\.co$' or credential is null or length(credential)<32 then raise exception 'Configuração do Vault incompleta';end if;
 perform net.http_post(url=>endpoint||'/functions/v1/hub-notice-worker',headers=>jsonb_build_object('Content-Type','application/json','x-hub-worker-secret',credential),body=>'{}'::jsonb,timeout_milliseconds=>30000);
end $$;
revoke all on function hub_private.dispatch_notice_worker() from public,anon,authenticated;
-- Named jobs are updated by cron.schedule; rerunning does not add copies.
select cron.schedule('hub-notice-generation','* * * * *','select hub_private.notice_tick()');
select cron.schedule('hub-notice-outbox','* * * * *','select hub_private.dispatch_notice_worker()');
-- Only internal generation enabled here. Sending needs a SEPARATE approval,
-- reviewed provider quota, verified sender/callback and explicit server mode.
update hub_private.notice_settings set generation_enabled=true,mail_enabled=false,sandbox_only=true;
commit;
