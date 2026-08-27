-- ── QuickBooks Online inventory sync ───────────────────────────────────────
--
-- Until now Summit's on-hand counts lived only in QuickBooks. The website read
-- a build-time JSON catalog in which every one of the 100 records carried
-- inventory_status = 'unknown', so no product page could show stock at all.
--
-- This migration provides the three server-side pieces the scheduled sync needs:
--   1. somewhere to keep a refresh token that Intuit rotates out from under us,
--   2. a run log, so an unattended job that quietly stops is visible,
--   3. the pg_cron schedule itself, reusing private.invoke_function from 004.
--
-- SCOPE -- read before extending this.
--
-- The sync writes inventory_quantity and inventory_status and NOTHING else. It
-- never touches purchase_eligible, retail_price or publication_status. Summit's
-- catalog is deliberately quote-only: stock is displayed, and every SKU still
-- routes to a human for the sale. The check constraint on catalog_products
-- already refuses purchase_eligible = true without verified stock, but the rule
-- here is stricter and lives at the write site -- knowing a quantity is not a
-- decision to sell it self-service.

-- ── Rotating refresh token ─────────────────────────────────────────────────
--
-- Intuit rotates the refresh token on most token exchanges and the previous
-- value stops working immediately. scripts/sync-quickbooks-inventory.ts prints
-- the new one for a human to paste into .env.local, which is fine for a manual
-- run and fatal for a job that runs every fifteen minutes unattended: the first
-- rotation would kill every subsequent run.
--
-- Client id, secret and realm stay in Edge Function secrets, like the Stripe
-- keys. Only the token that CHANGES needs a writable home, and it lives in
-- `private` for the same reason as app_config: that schema is not in the
-- PostgREST search path, so no API caller can reach it at any role.
create table if not exists private.quickbooks_token (
  id boolean primary key default true check (id),
  refresh_token text not null,
  -- When Intuit last handed us a *different* token, as opposed to when we last
  -- wrote the row. A rotated_at that stops moving is the early warning that the
  -- credential is drifting toward its 100-day expiry.
  rotated_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Seed once, by hand, from the Intuit OAuth 2.0 Playground:
--   insert into private.quickbooks_token (refresh_token) values ('<token>');

-- ── Token accessors ────────────────────────────────────────────────────────
--
-- An Edge Function reaches Postgres through PostgREST, which cannot see the
-- `private` schema. These two security-definer functions are the only door,
-- and they are granted to service_role alone.
create or replace function quickbooks_refresh_token_get()
returns text
language sql
security definer
set search_path = private, public
stable
as $$
  select refresh_token from private.quickbooks_token limit 1
$$;

create or replace function quickbooks_refresh_token_set(p_token text)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'refresh token must not be empty';
  end if;

  insert into private.quickbooks_token (id, refresh_token, rotated_at, updated_at)
  values (true, trim(p_token), now(), now())
  on conflict (id) do update set
    refresh_token = excluded.refresh_token,
    -- Only a genuine rotation moves rotated_at. Re-storing the same token on a
    -- run where Intuit did not rotate must not look like a fresh credential.
    rotated_at = case
      when private.quickbooks_token.refresh_token is distinct from excluded.refresh_token
      then now()
      else private.quickbooks_token.rotated_at
    end,
    updated_at = now();
end;
$$;

-- ── Apply inventory ────────────────────────────────────────────────────────
--
-- One statement, one round trip, and -- the point of routing the write through
-- a function rather than letting the Edge Function issue updates -- a column
-- list that cannot grow by accident. Whatever the caller sends, only
-- inventory_quantity and inventory_status can move. purchase_eligible,
-- retail_price and publication_status are unreachable from here, so the
-- display-only decision survives a careless change to the Deno code.
--
-- 'unknown' is intentionally absent from the allowed statuses: the sync never
-- un-counts a product. A row QuickBooks stops reporting keeps its last known
-- value rather than being reset, and a row it never reported is simply not in
-- p_rows at all.
create or replace function quickbooks_apply_inventory(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update catalog_products as c
  set inventory_quantity = r.qty,
      inventory_status = r.status,
      updated_at = now()
  from (
    select
      value->>'id' as id,
      (value->>'qty')::integer as qty,
      value->>'status' as status
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  ) as r
  where c.id = r.id
    and r.qty >= 0
    and r.status in ('in_stock', 'low_stock', 'out_of_stock', 'lead_time')
    -- Only genuine changes, so the run log's `updated` count means something
    -- and unchanged rows keep their existing updated_at.
    and (c.inventory_quantity is distinct from r.qty
         or c.inventory_status is distinct from r.status);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- ── Run log ────────────────────────────────────────────────────────────────
--
-- The manual script's dry-run report exists because silent non-matches are how
-- a catalog drifts away from the warehouse without anyone noticing. A scheduled
-- sync has no console to print to, so the same report is persisted instead.
create table if not exists quickbooks_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  items_fetched integer not null default 0,
  matched integer not null default 0,
  updated integer not null default 0,
  -- Items QuickBooks holds but does not quantity-track. Left unknown, never
  -- written as zero: "we do not count this" is not "we have none".
  untracked integer not null default 0,
  unmatched_catalog integer not null default 0,
  unmatched_qbo integer not null default 0,
  -- One QuickBooks SKU resolving to more than one catalog row. Neither row is
  -- updated; both are named here so a human can split the item in QuickBooks.
  ambiguous jsonb not null default '[]'::jsonb,
  error text
);

create index if not exists quickbooks_sync_runs_started_idx
  on quickbooks_sync_runs (started_at desc);

alter table quickbooks_sync_runs enable row level security;

-- Dropped first so the whole migration is re-runnable. `create policy` has no
-- IF NOT EXISTS form, and without this a second run aborts here -- leaving the
-- grants and the cron schedule below unapplied, which is a worse state than
-- either failing outright or succeeding.
drop policy if exists "staff read quickbooks sync runs" on quickbooks_sync_runs;
create policy "staff read quickbooks sync runs" on quickbooks_sync_runs for select
  using (current_profile_role() = 'staff');

-- ── Grants ─────────────────────────────────────────────────────────────────
--
-- Same posture as 016/018/021: revoke from the implicit `public` role first,
-- because a bare `grant execute` on a new function is otherwise world-callable.
revoke execute on function public.quickbooks_refresh_token_get() from public, anon, authenticated;
revoke execute on function public.quickbooks_refresh_token_set(text) from public, anon, authenticated;
revoke execute on function public.quickbooks_apply_inventory(jsonb) from public, anon, authenticated;
grant execute on function public.quickbooks_refresh_token_get() to service_role;
grant execute on function public.quickbooks_refresh_token_set(text) to service_role;
grant execute on function public.quickbooks_apply_inventory(jsonb) to service_role;

revoke all on quickbooks_sync_runs from anon, authenticated;
grant select on quickbooks_sync_runs to authenticated;
grant all on quickbooks_sync_runs to service_role;

-- ── Schedule ───────────────────────────────────────────────────────────────
--
-- Every fifteen minutes, through the same pg_net indirection 004 established.
-- Unscheduling first keeps this migration re-runnable.
select cron.unschedule('quickbooks-inventory-sync')
where exists (select 1 from cron.job where jobname = 'quickbooks-inventory-sync');

select cron.schedule(
  'quickbooks-inventory-sync',
  '*/15 * * * *',
  $$ select private.invoke_function('quickbooks-inventory-sync'); $$
);
