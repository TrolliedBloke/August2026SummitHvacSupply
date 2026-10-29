-- ── Retire the QuickBooks Online inventory sync ────────────────────────────
--
-- Numbered 047, not 026. This was written as 026 while a parallel stream of
-- work was claiming 026 through 046 on main; both landed independently. The
-- content was applied to the crm project by hand under its original number, so
-- this file is a record of a change already in the database rather than one
-- waiting to run. Verified 2026-10-29: quickbooks_sync_runs is gone, and
-- finder_sessions / audience_exports / email_messages from 031-036 are present.
--
-- Summit is moving off QuickBooks. The catalog CSV import becomes the single
-- path for product identity, price and on-hand counts, as it already is for
-- everything except the counts.
--
-- Migrations 024 and 025 are left untouched: they are history, and rewriting
-- them would desync every environment that has already applied them.
--
-- WHAT SURVIVES THIS, deliberately:
--
--   catalog_products.inventory_quantity / inventory_status, and the runtime
--   overlay that reads them (src/lib/storefront/live-inventory.ts). Those are
--   source-agnostic -- they are where a count lands, not where it comes from --
--   and they stay the seam a future ERP writes into. `npm run catalog:sync`
--   keeps populating them from the generated catalog.
--
--   The check constraint on catalog_products that refuses purchase_eligible
--   without a price AND a known quantity. That was always the real guard on
--   selling something the warehouse cannot fill; quickbooks_apply_inventory()
--   narrowed the write path on top of it, but the constraint is what holds.

-- ── 1. Stop the schedule ───────────────────────────────────────────────────
--
-- Left running, this fires every fifteen minutes forever: writing stale
-- QuickBooks counts while Summit no longer uses QuickBooks, and erroring on
-- every invocation once the Intuit app is disconnected.
select cron.unschedule('quickbooks-inventory-sync')
where exists (select 1 from cron.job where jobname = 'quickbooks-inventory-sync');

-- ── 2. Remove the stored Intuit credential ─────────────────────────────────
--
-- private.quickbooks_token holds a live OAuth refresh token. Dropping the
-- table is the point of this step, not a side effect: a credential nobody uses
-- is a credential nobody rotates.
drop function if exists public.quickbooks_refresh_token_get();
drop function if exists public.quickbooks_refresh_token_set(text);
drop table if exists private.quickbooks_token;

-- ── 3. Remove the sync's own machinery ─────────────────────────────────────
--
-- The run log and its reconciliation view exist to report on a live external
-- sync. With the CSV importer as the only source there is nothing to write
-- them, and `catalog_import_runs` (migration 011) already records what each
-- import did. An empty table with no writer is clutter that reads like a
-- feature.
--
-- The write-narrowing function goes with them. Its guarantee -- that a sync can
-- move inventory_quantity and inventory_status and nothing else -- is worth
-- rebuilding when a new source arrives; the shape is in git at migration 024.
drop view if exists public.quickbooks_reconciliation;
drop function if exists public.quickbooks_apply_inventory(jsonb);
drop table if exists public.quickbooks_sync_runs;
