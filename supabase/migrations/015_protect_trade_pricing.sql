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
-- THE TRAP: a column-level REVOKE is inert while the role still holds
-- table-level SELECT, because Postgres checks the table grant first. The first
-- attempt revoked (cost, dealer_price) from anon and changed nothing -- the
-- values kept being served, and the migration still reported success. The
-- working form is to withdraw the table grant, then grant back only the safe
-- columns. The only way to know is to re-test as anon afterwards.
--
-- The production catalog's trade-pricing table is created in 011 alongside
-- catalog_products, so no ordering between the two can leave contractor_price
-- on a publicly readable row.

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

-- Supplier unit costs. Already closed to anon by RLS; the grant is defence in
-- depth, since RLS is one `using (true)` away from republishing the table.
revoke select on purchase_order_lines from anon;
revoke select on purchase_order_lines from authenticated;
grant select (id, purchase_order_id, sku_id, quantity, received_quantity)
  on purchase_order_lines to authenticated;

revoke insert, update, delete, truncate on skus from anon;
revoke insert, update, delete, truncate on purchase_order_lines from anon;

-- PostgREST caches the schema; without this it keeps serving the old privilege
-- set until it happens to reload.
notify pgrst, 'reload schema';
