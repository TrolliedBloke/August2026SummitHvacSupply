-- Customers could read their own orders but not what was in them.
--
-- Found by the Supabase security advisor (rls_enabled_no_policy), confirmed
-- against the live database:
--
--   sales_orders   rls_on=true  policy_count=2   <- "own account orders" + staff
--   order_lines    rls_on=true  policy_count=0
--   invoice_lines  rls_on=true  policy_count=0
--   payments       rls_on=true  policy_count=0
--
-- RLS enabled with zero policies denies every row to every non-superuser role,
-- so the intent of migration 001's "own account orders" policy stopped at the
-- header. A signed-in customer reading through the anon/authenticated key sees
-- an order with no line items, no invoice detail and no payment history.
--
-- This has not surfaced yet only because the portal reads through the service
-- role, which bypasses RLS entirely -- meaning order history is currently
-- protected by application code alone. That is the same single-layer posture
-- migrations 013/015 were written to remove elsewhere; these policies restore
-- defence in depth so the database enforces the boundary whether or not the
-- calling code remembers to.
--
-- Scoping note: current_profile_account() returns NULL for anon, and
-- `account_id = NULL` evaluates to NULL rather than true, so anonymous callers
-- match nothing. Guest checkouts (account_id IS NULL) are likewise unreachable
-- by any signed-in customer -- they are retrieved by signed order token, not
-- by account.

-- ── order_lines ────────────────────────────────────────────────────────────
drop policy if exists "own account order lines" on order_lines;
create policy "own account order lines" on order_lines
  for select using (
    exists (
      select 1 from sales_orders o
      where o.id = order_lines.order_id
        and o.account_id is not null
        and o.account_id = current_profile_account()
    )
  );

drop policy if exists "staff all order lines" on order_lines;
create policy "staff all order lines" on order_lines
  for select using (current_profile_role() = 'staff');

-- ── invoice_lines ──────────────────────────────────────────────────────────
drop policy if exists "own account invoice lines" on invoice_lines;
create policy "own account invoice lines" on invoice_lines
  for select using (
    exists (
      select 1 from invoices i
      where i.id = invoice_lines.invoice_id
        and i.account_id is not null
        and i.account_id = current_profile_account()
    )
  );

drop policy if exists "staff all invoice lines" on invoice_lines;
create policy "staff all invoice lines" on invoice_lines
  for select using (current_profile_role() = 'staff');

-- ── payments ───────────────────────────────────────────────────────────────
-- payments.account_id is nullable; the `is not null` guard keeps an
-- unattributed payment row from matching a customer whose profile has no
-- account either.
drop policy if exists "own account payments" on payments;
create policy "own account payments" on payments
  for select using (
    account_id is not null and account_id = current_profile_account()
  );

drop policy if exists "staff all payments" on payments;
create policy "staff all payments" on payments
  for select using (current_profile_role() = 'staff');

-- Read-only for customers. Every write to these tables goes through a
-- SECURITY DEFINER routine (mark_order_paid, invoice_order, reverse_payment)
-- that runs as service_role, so no INSERT/UPDATE/DELETE policy is granted here.

-- Indexes supporting the EXISTS lookups above.
create index if not exists order_lines_order_id_idx on order_lines (order_id);
create index if not exists invoice_lines_invoice_id_idx on invoice_lines (invoice_id);
create index if not exists payments_account_id_idx on payments (account_id);
