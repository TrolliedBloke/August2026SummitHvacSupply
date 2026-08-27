-- ── QuickBooks sync: record WHICH items did not reconcile ──────────────────
--
-- 022 logged counts only: "15 QuickBooks items had no catalog row" tells you a
-- problem exists and nothing about how to fix it. The work of reconciling a
-- catalog against a warehouse system is entirely in the identities, so the run
-- log now stores them.
--
-- Each list holds objects of {sku, name}. The name is carried because a bare
-- SKU is not enough to find an item in the QuickBooks UI, and because the
-- ambiguous list previously reported internal ids like "inventory-row-33",
-- which mean nothing to the person who has to split the item.

alter table quickbooks_sync_runs
  add column if not exists untracked_skus jsonb not null default '[]'::jsonb,
  add column if not exists unmatched_catalog_skus jsonb not null default '[]'::jsonb,
  add column if not exists unmatched_qbo_skus jsonb not null default '[]'::jsonb,
  add column if not exists skuless_items jsonb not null default '[]'::jsonb;

comment on column quickbooks_sync_runs.untracked_skus is
  'Matched, but QuickBooks does not track a quantity. Left unknown, never zero.';
comment on column quickbooks_sync_runs.unmatched_catalog_skus is
  'Catalog products QuickBooks said nothing about. They keep their last value.';
comment on column quickbooks_sync_runs.unmatched_qbo_skus is
  'QuickBooks inventory items with no catalog product. Nothing to display them on.';
comment on column quickbooks_sync_runs.skuless_items is
  'QuickBooks items with no SKU set. They can never be matched until one is added.';

-- ── Reconciliation worksheet ───────────────────────────────────────────────
--
-- Flattens the most recent successful run into one row per thing needing
-- attention, so the whole backlog is a single select rather than four jsonb
-- digs. `action` says what to do about each category, because the right fix
-- differs: a QuickBooks item with no catalog row is a catalog problem, and a
-- catalog row QuickBooks never mentions is a QuickBooks problem.
--
-- A view runs as its owner and so does NOT inherit the staff-only RLS policy on
-- quickbooks_sync_runs. Rather than depend on security_invoker (PG15+), this
-- takes the posture migration 017 already uses for trial_balance: no API role
-- can select from it at all. It is read by the dashboard SQL editor, which
-- connects as postgres, and by service_role. Nothing is exposed to anon or to a
-- signed-in customer, so there is no policy to get wrong.
create or replace view quickbooks_reconciliation as
with latest as (
  select *
  from quickbooks_sync_runs
  where ok
  order by started_at desc
  limit 1
)
select l.started_at,
       'unmatched_qbo'::text as category,
       e->>'sku'  as sku,
       e->>'name' as name,
       'In QuickBooks but not in the catalog. Add the product, or retire the item.'::text as action
from latest l, jsonb_array_elements(l.unmatched_qbo_skus) e
union all
select l.started_at, 'unmatched_catalog', e->>'sku', e->>'name',
       'In the catalog but not in QuickBooks. It can never show a count until an item exists.'
from latest l, jsonb_array_elements(l.unmatched_catalog_skus) e
union all
select l.started_at, 'untracked', e->>'sku', e->>'name',
       'Matched, but quantity tracking is off in QuickBooks. Enable it to publish a count.'
from latest l, jsonb_array_elements(l.untracked_skus) e
union all
select l.started_at, 'skuless', e->>'sku', e->>'name',
       'QuickBooks item with no SKU. Set one that matches the catalog SKU.'
from latest l, jsonb_array_elements(l.skuless_items) e
union all
select l.started_at, 'ambiguous', e->>'sku',
       (select string_agg(v, ', ') from jsonb_array_elements_text(e->'catalogSkus') v),
       'One QuickBooks SKU maps to several catalog products. Split it so each has its own item.'
from latest l, jsonb_array_elements(l.ambiguous) e;

comment on view quickbooks_reconciliation is
  'Everything from the latest successful QuickBooks sync that needs a human. One row per item.';

revoke all on quickbooks_reconciliation from anon, authenticated;
grant select on quickbooks_reconciliation to service_role;
