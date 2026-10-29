-- 041: schedule the money-safety jobs every 15 minutes
-- (docs/LIABILITY-REMEDIATION-PLAN.md, 1.2 and 1.5).
--
-- Calls /api/payments/safety through private.invoke_site_route (migration
-- 033), which does nothing until private.app_config has site_base_url and
-- cron_secret. NOTE: as of 2026-10-04 private.app_config is EMPTY on the live
-- project, so no scheduled job that depends on it -- QuickBooks sync,
-- low-stock alert, AR statements, lifecycle dispatch -- has been doing
-- anything. Fill it once (BACKEND_SETUP.md section 3) and they all start.
--
-- Re-runnable.

do $$ begin
  perform cron.unschedule('payment-safety-15min');
exception when others then null; end $$;

select cron.schedule(
  'payment-safety-15min',
  '*/15 * * * *',
  $$ select private.invoke_site_route('/api/payments/safety'); $$
);
