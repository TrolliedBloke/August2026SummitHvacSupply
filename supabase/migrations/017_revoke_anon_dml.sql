-- Withdraw anonymous write privileges, and close two remaining read leaks.
--
-- APPLIED to project cswrezdcwdqnhwplmddr on 2026-08-10 as
-- `lock_trial_balance_to_service_role` + `revoke_anon_dml_public_form_tables`.
-- This file is the replayable form.

-- ── trial_balance ──────────────────────────────────────────────────────────
-- A SECURITY DEFINER view over chart_of_accounts / journal_lines -- the general
-- ledger -- readable by every authenticated user. `authenticated` includes
-- retail homeowners who sign up through the public form, so anyone with an
-- account could read Summit's financial position. The earlier lockdown removed
-- anon and left authenticated:
--   has_table_privilege('authenticated','trial_balance','SELECT') = true
revoke all on public.trial_balance from authenticated;
revoke all on public.trial_balance from anon;

-- ── Public form tables ─────────────────────────────────────────────────────
-- anon could POST directly to these, skipping the application entirely.
-- Verified: POST /rest/v1/quote_requests with the anon key and
-- `Prefer: return=minimal` returned 201. The "anonymous insert ..." policies are
-- `with check (true)`, so any caller could write unlimited rows straight to
-- PostgREST, bypassing the zod schema, canonical SKU resolution and the route
-- handler's rate limit. It only *looked* blocked at first because
-- `return=representation` additionally needs SELECT, which anon lacks -- a
-- reminder that a 401 on insert-with-returning is not proof the insert failed.
--
-- src/lib/backend/services.ts now performs these writes with the service role,
-- so the server action is the only way in.
revoke insert, update, delete, truncate on quote_requests from anon;
revoke insert, update, delete, truncate on quote_request_lines from anon;
revoke insert, update, delete, truncate on dealer_applications from anon;

drop policy if exists "anonymous insert quote requests" on quote_requests;
drop policy if exists "anonymous insert quote request lines" on quote_request_lines;
drop policy if exists "anonymous insert dealer applications" on dealer_applications;

-- ── Defence in depth ───────────────────────────────────────────────────────
-- Supabase grants the full DML set to anon on every table by default, leaving
-- RLS as the only control. Testing confirmed RLS was holding: an anon PATCH
-- returned HTTP 200 with `[]` (zero rows affected) and a DELETE left the row
-- count unchanged -- the 200 is misleading, not a breach.
--
-- It is nonetheless one permissive policy away from being one, and nothing
-- anonymous ever writes to these tables. Withdrawing the grant means a future
-- `using (true)` cannot silently become anonymous write access.
--
-- Guarded per table so this file replays cleanly against a database where a
-- later migration has not yet created every object.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','contacts','user_profiles','sales_orders','order_lines','invoices',
    'invoice_lines','payments','credits','journal_entries','journal_lines',
    'chart_of_accounts','tasks','quotes','quote_lines','inventory_lots',
    'inventory_movements','inventory_reservations','bins','shipments','rmas',
    'warranty_claims','rebate_cases','purchase_orders','receipts','notes',
    'activity_log','warehouses','product_series','certifications','sku_documents',
    'sku_certifications'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('revoke insert, update, delete, truncate on public.%I from anon', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
