-- ── Close the reversal functions to anon ───────────────────────────────────
--
-- Migration 020 shipped the wrong revoke. It said
--
--   revoke execute on function public.reverse_payment(...) from anon, authenticated;
--
-- which is the exact no-op MIGRATION-BASELINE.md documents as trap #2:
-- Postgres grants EXECUTE to PUBLIC when a function is created, so the ACL
-- reads `=X/postgres` where the bare `=` IS the PUBLIC grant. Revoking from
-- `anon` by name removes a grant that never existed and leaves PUBLIC intact.
--
-- Verified against production before this fix: an anon PostgREST call to
-- reverse_payment reached the function body ("invoice ... not found" rather
-- than "permission denied"), and record_payment_dispute returned 200 with a
-- freshly inserted row id. Anyone with the publishable anon key -- which ships
-- in the browser bundle -- could zero an invoice balance, credit an account
-- that never paid, or flood the dispute queue.
--
-- The in-function role guard does not help here and was never going to. It
-- reads:
--
--   if current_profile_role() is distinct from 'staff' and auth.uid() is not null
--
-- For an anon request auth.uid() is NULL, so the right-hand side is false, the
-- AND is false, and no exception is raised. That guard only rejects a signed-in
-- non-staff user; it cannot distinguish anon from service_role, because neither
-- carries a uid. Grants are the only control that separates them, which is why
-- 016 withdraws PUBLIC and grants the needed roles back explicitly.
--
-- Same shape as 016. Service role bypasses grants, but the grant is stated
-- anyway so the intent survives a future `revoke all`.
revoke execute on function public.reverse_payment(uuid, numeric, text, text, text) from public;
revoke execute on function public.reverse_order_payment(uuid, numeric, text) from public;
revoke execute on function public.record_payment_dispute(text, text, numeric, text, text, timestamptz, uuid, uuid, text) from public;

grant execute on function public.reverse_payment(uuid, numeric, text, text, text) to service_role;
grant execute on function public.reverse_order_payment(uuid, numeric, text) to service_role;
grant execute on function public.record_payment_dispute(text, text, numeric, text, text, timestamptz, uuid, uuid, text) to service_role;

-- Remove the row an anon-key probe inserted while demonstrating the hole.
delete from payment_disputes where stripe_dispute_id = 'probe';
