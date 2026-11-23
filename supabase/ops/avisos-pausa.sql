-- Safe recovery: do not drop tables, reset statuses or revoke prior protections.
begin;
update hub_private.notice_settings set generation_enabled=false,mail_enabled=false;
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.unschedule(jobid) from cron.job where jobname in ('hub-notice-generation','hub-notice-outbox');
 end if;
end $$;
commit;
-- Already accepted mail cannot be recalled. Expired leases become uncertain
-- on the next authorized claim; inspect provider before any manual retry.
