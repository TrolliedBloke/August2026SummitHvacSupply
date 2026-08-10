-- Unauthenticated callers could execute operational SECURITY DEFINER functions.
--
-- APPLIED to project cswrezdcwdqnhwplmddr on 2026-08-10 as
-- `revoke_public_execute_on_operational_functions` +
-- `lock_low_stock_view_and_pin_search_path`. This file is the corrected,
-- replayable form.
--
-- Found by the Supabase security advisor, not by reading the schema, and it is
-- the most serious defect in this database. Every operational routine is
-- SECURITY DEFINER (runs as owner, ignores RLS) and PostgREST publishes each
-- one at /rest/v1/rpc/<name>. The anon key ships in the browser.
--
-- Two had no staff guard in the body whatsoever:
--   apply_payment  -- marks any invoice paid
--   post_journal   -- writes arbitrary lines into the general ledger
-- i.e. unauthenticated manipulation of financial records. The other six do
-- call assert_staff(), so a signed-in non-staff caller is already rejected
-- inside the function -- but anon should never have reached them either.
--
-- Verified with the anon key BEFORE:
--   has_function_privilege('anon','public.apply_payment(...)','EXECUTE') = true
-- and AFTER:
--   POST /rest/v1/rpc/apply_payment
--   -> 401 {"code":"42501","message":"permission denied for function apply_payment"}
--
-- The trap, same shape as the table-grant one in 015: Postgres grants EXECUTE
-- to PUBLIC by default when a function is created. The ACL read `=X/postgres`,
-- where the bare `=` IS the PUBLIC grant. Revoking from `anon` by name removed
-- a grant that never existed and left PUBLIC untouched, so anon kept the
-- privilege. PUBLIC has to be withdrawn, then the needed roles granted back.

-- No staff guard, and no UI calls them as a user (recordManualPayment is
-- unreferenced). Service role only -- it bypasses grants anyway, so this is
-- really "nothing reachable through the public API".
revoke execute on function public.apply_payment(uuid, numeric, text, text, text) from public;
revoke execute on function public.post_journal(text, text, uuid, jsonb) from public;
grant execute on function public.apply_payment(uuid, numeric, text, text, text) to service_role;
grant execute on function public.post_journal(text, text, uuid, jsonb) to service_role;

-- These call assert_staff() internally. The admin UI invokes them as the
-- signed-in staff user (see src/lib/backend/operations.ts, which deliberately
-- uses the session client so the in-database guard applies), so `authenticated`
-- keeps EXECUTE and the guard does the authorising. PUBLIC does not.
revoke execute on function public.adjust_inventory(uuid, integer, text) from public;
revoke execute on function public.convert_quote_to_order(uuid) from public;
revoke execute on function public.invoice_order(uuid, date) from public;
revoke execute on function public.receive_purchase_order(uuid, uuid) from public;
revoke execute on function public.reserve_order(uuid) from public;
revoke execute on function public.ship_order(uuid, text, text) from public;

grant execute on function public.adjust_inventory(uuid, integer, text) to authenticated, service_role;
grant execute on function public.convert_quote_to_order(uuid) to authenticated, service_role;
grant execute on function public.invoice_order(uuid, date) to authenticated, service_role;
grant execute on function public.receive_purchase_order(uuid, uuid) to authenticated, service_role;
grant execute on function public.reserve_order(uuid) to authenticated, service_role;
grant execute on function public.ship_order(uuid, text, text) to authenticated, service_role;

-- Trigger functions run as the definer when their trigger fires; no caller
-- needs EXECUTE and they should not be reachable over RPC at all.
revoke execute on function public.trg_post_invoice() from public;
revoke execute on function public.trg_post_movement() from public;
revoke execute on function public.trg_post_payment() from public;

-- current_profile_role() and current_profile_account() intentionally keep
-- PUBLIC execute: RLS policy expressions evaluate them as the querying role,
-- so withdrawing it breaks every policy that calls them. Both return only the
-- caller's own role/account, so exposure is nil.

-- low_stock_skus routed around the inventory_lots lockdown. Restricting that
-- table by RLS did not close the disclosure, because this view is SECURITY
-- DEFINER and runs with the creator's rights -- verified still serving on_hand
-- and reserved to anon afterwards. It is an internal replenishment view.
revoke all on public.low_stock_skus from anon;
revoke all on public.low_stock_skus from authenticated;

-- A SECURITY DEFINER function without a pinned search_path can be hijacked by
-- a caller able to create objects in an earlier schema: their object resolves
-- first and runs with the definer's privileges. These three decide
-- authorization for every operational RPC above.
alter function public.current_profile_role() set search_path = public, pg_temp;
alter function public.current_profile_account() set search_path = public, pg_temp;
alter function public.assert_staff() set search_path = public, pg_temp;

notify pgrst, 'reload schema';
