-- 033: schedule the lifecycle dispatcher (docs/FINDER-AND-AUDIENCE-PLAN.md 4.0).
--
-- Nothing called /api/lifecycle/dispatch on a schedule. Its comment said a
-- Vercel cron hit it hourly, but commit d52a1fb dropped that cron so deploys
-- would pass on the Hobby plan, and 004 schedules only the low-stock alert and
-- AR statements. Back-in-stock alerts, the abandoned-cart sequence, the day-14
-- review request -- and now the planning series -- therefore never sent on
-- their own.
--
-- pg_cron calls the Next route the same way 004 calls Edge Functions, with the
-- route's CRON_SECRET as a bearer token. Fill the two new config values once:
--   update private.app_config
--     set site_base_url = 'https://www.summithvacsupply.com', cron_secret = '<CRON_SECRET>';
-- Until both are set the job logs a notice and does nothing.
--
-- Re-runnable.

alter table private.app_config add column if not exists site_base_url text;
alter table private.app_config add column if not exists cron_secret text;

create or replace function private.invoke_site_route(p_path text)
returns void language plpgsql security definer set search_path = private, public as $$
declare cfg private.app_config;
begin
  select * into cfg from private.app_config limit 1;
  if not found or cfg.site_base_url is null or cfg.cron_secret is null then
    raise notice 'private.app_config has no site_base_url/cron_secret; skipping %', p_path;
    return;
  end if;
  perform net.http_get(
    url := rtrim(cfg.site_base_url, '/') || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || cfg.cron_secret)
  );
end;
$$;
revoke all on function private.invoke_site_route(text) from public;

-- Hourly, at seven past: the abandoned-cart stages are measured in hours, the
-- planning series and review requests in days, so hourly serves all of them.
do $$ begin
  perform cron.unschedule('lifecycle-dispatch-hourly');
exception when others then null; end $$;
select cron.schedule(
  'lifecycle-dispatch-hourly',
  '7 * * * *',
  $$ select private.invoke_site_route('/api/lifecycle/dispatch'); $$
);
