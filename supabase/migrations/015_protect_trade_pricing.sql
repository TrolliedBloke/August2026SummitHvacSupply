-- Wholesale pricing and acquisition cost were readable by anyone.
--
-- APPLIED to project cswrezdcwdqnhwplmddr on 2026-08-10 as
-- `restrict_internal_reads_and_trade_pricing` +
-- `revoke_table_select_and_grant_safe_columns`. This file is the corrected,
-- replayable form of both.
--
-- Verified with the anon key BEFORE:
--   GET /rest/v1/skus?select=sku,cost,dealer_price,msrp
--   -> 200 [{"sku":"TCL-BRZ-09HP-230","cost":590.00,
--            "dealer_price":865.00,"msrp":1299.00}, ...]
-- and AFTER:
--   -> 401 {"code":"42501","message":"permission denied for table skus"}
-- while `select=sku,title,msrp` still returns 200.
--
-- Why RLS was not enough: migration 001 granted "public sku read using (true)".
-- RLS is ROW level -- a readable row is readable in full, every column
-- included. Column privileges are the correct mechanism.
--
-- The trap worth remembering: a column-level REVOKE does nothing while the
-- role still holds table-level SELECT. Postgres checks the table grant first.
-- The first attempt here revoked (cost, dealer_price) from anon and changed
-- nothing -- the values were still served. The working form is to withdraw the
-- table grant and re-grant only the safe columns.

-- ── Legacy demo catalog ────────────────────────────────────────────────────
revoke select on skus from anon;
revoke select on skus from authenticated;

grant select (
  id, series_id, sku, model_number, title, btu, voltage, unit_type,
  msrp, dimensions, weight_lbs, refrigerant, ahri_reference,
  warranty_compressor, warranty_parts, is_active
) on skus to anon;

grant select (
  id, series_id, sku, model_number, title, btu, voltage, unit_type,
  msrp, dimensions, weight_lbs, refrigerant, ahri_reference,
  warranty_compressor, warranty_parts, is_active
) on skus to authenticated;

-- Supplier unit costs.
revoke select on purchase_order_lines from anon;
revoke select on purchase_order_lines from authenticated;
grant select (id, purchase_order_id, sku_id, quantity, received_quantity)
  on purchase_order_lines to authenticated;

-- Supabase grants the full DML set to anon by default and leans on RLS alone.
-- These are read-only reference tables for the storefront; one permissive
-- policy would otherwise mean anon TRUNCATE on the catalog.
revoke insert, update, delete, truncate on skus from anon;
revoke insert, update, delete, truncate on purchase_order_lines from anon;

-- ── Production catalog (requires migration 011) ────────────────────────────
-- Skipped automatically when catalog_products does not exist yet, so this file
-- is safe to run against a database that has not had 011 applied. As of
-- 2026-08-10 the live project has NOT run 011.
do $$
begin
  if to_regclass('public.catalog_products') is null then
    raise notice 'catalog_products absent (migration 011 not applied); skipping trade-pricing split';
    return;
  end if;

  create table if not exists catalog_product_trade_pricing (
    product_id text primary key references catalog_products(id) on delete cascade,
    contractor_price numeric(12,2),
    price_tier text not null default 'standard',
    effective_from date not null default current_date,
    updated_at timestamptz not null default now(),
    check (contractor_price is null or contractor_price > 0)
  );

  if exists (
    select 1 from information_schema.columns
    where table_name = 'catalog_products' and column_name = 'contractor_price'
  ) then
    insert into catalog_product_trade_pricing (product_id, contractor_price)
    select id, contractor_price from catalog_products where contractor_price is not null
    on conflict (product_id) do nothing;

    alter table catalog_products drop column contractor_price;
  end if;

  alter table catalog_product_trade_pricing enable row level security;

  -- No anon policy at all: unauthenticated callers get nothing, not a filtered
  -- subset. contractor_price living in catalog_products would have been
  -- world-readable the moment it was populated, because that table is
  -- published to anon by "public read publishable catalog".
  drop policy if exists "trade reads trade pricing" on catalog_product_trade_pricing;
  create policy "trade reads trade pricing" on catalog_product_trade_pricing
    for select using (current_profile_role() in ('dealer', 'installer', 'staff'));

  drop policy if exists "staff manages trade pricing" on catalog_product_trade_pricing;
  create policy "staff manages trade pricing" on catalog_product_trade_pricing
    for all using (current_profile_role() = 'staff')
    with check (current_profile_role() = 'staff');

  revoke all on catalog_product_costs from anon;
  revoke all on catalog_product_costs from authenticated;
end $$;

-- PostgREST caches the schema; without this it keeps serving the old privilege
-- set until it happens to reload.
notify pgrst, 'reload schema';
