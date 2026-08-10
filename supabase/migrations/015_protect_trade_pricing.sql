-- Wholesale pricing and acquisition cost were readable by anyone.
--
-- Verified against the live project with the anon key before writing this:
--
--   GET /rest/v1/skus?select=sku,cost,dealer_price,msrp
--   -> 200 [{"sku":"TCL-BRZ-09HP-230","cost":590.00,
--            "dealer_price":865.00,"msrp":1299.00}, ...]
--
-- That is the entire margin structure -- what Summit pays, what dealers pay and
-- what retail pays -- served to unauthenticated callers. Migration 001 granted
-- `public sku read ... using (true)`, and RLS is row-level: a readable row is a
-- readable ROW, every column included. The storefront only ever needed the
-- descriptive columns.
--
-- Fix is column-level privileges, which PostgREST enforces (it returns 401/403
-- for a revoked column rather than silently omitting it). The public catalog
-- read stays intact; only the commercially sensitive columns are withdrawn.

-- ── Legacy demo catalog ────────────────────────────────────────────────────
-- `anon` is the unauthenticated browser role. `authenticated` covers signed-in
-- homeowners too: a retail login must not reveal dealer pricing either. Trade
-- pricing reaches the portal through the service role, which bypasses grants.
revoke select (cost, dealer_price) on skus from anon;
revoke select (cost, dealer_price) on skus from authenticated;

-- Purchase orders carry supplier unit costs.
revoke select (unit_cost) on purchase_order_lines from anon;
revoke select (unit_cost) on purchase_order_lines from authenticated;

-- ── Production catalog ─────────────────────────────────────────────────────
-- `catalog_products` is published to anon by policy "public read publishable
-- catalog". contractor_price sitting in that table means trade pricing becomes
-- world-readable the moment it is populated. Move it to its own table so the
-- protection is structural rather than a column grant someone can regrant.
create table if not exists catalog_product_trade_pricing (
  product_id text primary key references catalog_products(id) on delete cascade,
  contractor_price numeric(12,2),
  price_tier text not null default 'standard',
  effective_from date not null default current_date,
  updated_at timestamptz not null default now(),
  check (contractor_price is null or contractor_price > 0)
);

-- Carry across anything already stored before dropping the column.
insert into catalog_product_trade_pricing (product_id, contractor_price)
select id, contractor_price from catalog_products where contractor_price is not null
on conflict (product_id) do nothing;

alter table catalog_products drop column if exists contractor_price;

alter table catalog_product_trade_pricing enable row level security;

-- No anon policy at all: unauthenticated callers get an empty result, not a
-- filtered one. Trade roles read; only staff write.
create policy "trade reads trade pricing" on catalog_product_trade_pricing
  for select using (current_profile_role() in ('dealer', 'installer', 'staff'));

create policy "staff manages trade pricing" on catalog_product_trade_pricing
  for all using (current_profile_role() = 'staff')
  with check (current_profile_role() = 'staff');

-- Acquisition cost must never be readable by a customer of any kind. 011 gave
-- catalog_product_costs a staff-only ALL policy but left the table grantable;
-- make the privilege match the intent.
revoke all on catalog_product_costs from anon;
revoke all on catalog_product_costs from authenticated;
