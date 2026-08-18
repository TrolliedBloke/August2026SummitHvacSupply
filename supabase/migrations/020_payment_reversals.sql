-- ── Payment reversals: refunds and disputes ────────────────────────────────
--
-- Before this migration, money only ever moved one way. apply_payment() and
-- mark_order_paid() credited the ledger when Stripe reported a success, but a
-- refund issued from the Stripe dashboard hit no code path at all: the invoice
-- stayed 'paid', the account balance stayed reduced, and sales_orders.paid
-- stayed true. The books silently disagreed with Stripe from that moment on.
--
-- These three functions are the mirror image of the payment path and follow
-- its conventions exactly:
--   * security definer + pinned search_path,
--   * the same role guard (staff, or a keyless service-role caller),
--   * idempotency through the existing unique index on the *_event_id column,
--   * service_role-only execute, since only the Stripe webhook calls them.
--
-- Idempotency key note: for reversals we store the Stripe *refund* id (re_...)
-- rather than the event id. A single charge can be refunded several times, each
-- firing its own charge.refunded event carrying a cumulative amount_refunded.
-- Keying on the refund id makes each individual refund apply exactly once, and
-- lets the webhook post the refund's own amount as the delta instead of trying
-- to reconstruct it from a running total.

-- ── Reverse a payment against a dealer invoice ─────────────────────────────
create or replace function reverse_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text default 'stripe_refund',
  p_reference text default null,
  p_stripe_event_id text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_payment uuid;
  v_account uuid;
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_new_paid numeric(12,2);
begin
  if current_profile_role() is distinct from 'staff' and auth.uid() is not null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_amount <= 0 then
    raise exception 'reversal amount must be positive, got %', p_amount;
  end if;

  -- Replayed webhook: no-op returning the original row, same as apply_payment.
  if p_stripe_event_id is not null then
    select id into v_existing from payments where stripe_event_id = p_stripe_event_id;
    if v_existing is not null then return v_existing; end if;
  end if;

  select account_id, total, paid into v_account, v_total, v_paid
  from invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice % not found', p_invoice_id; end if;

  -- Refunding more than was collected would drive paid negative and hand the
  -- account a credit it never earned. Clamp and let the caller see the row.
  v_new_paid := greatest(v_paid - p_amount, 0);

  -- Stored as a negative payment so the audit trail stays in one table and
  -- sum(amount) over payments remains the true collected figure.
  insert into payments (invoice_id, account_id, amount, method, reference, stripe_event_id)
  values (p_invoice_id, v_account, -p_amount, p_method, p_reference, p_stripe_event_id)
  returning id into v_payment;

  update invoices
    set paid = v_new_paid,
        balance = v_total - v_new_paid,
        status = case
                   when v_total - v_new_paid <= 0 then 'paid'::invoice_status
                   when v_new_paid <= 0 then 'open'::invoice_status
                   else 'partial'::invoice_status
                 end
    where id = p_invoice_id;

  -- Money went back to the customer, so the account owes it again.
  if v_account is not null then
    update accounts set balance = balance + (v_paid - v_new_paid) where id = v_account;
  end if;

  return v_payment;
end;
$$;

-- ── Reverse a storefront order payment ─────────────────────────────────────
create or replace function reverse_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_stripe_event_id text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_row uuid;
  v_net numeric(12,2);
begin
  if current_profile_role() is distinct from 'staff' and auth.uid() is not null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_amount <= 0 then
    raise exception 'reversal amount must be positive, got %', p_amount;
  end if;

  if p_stripe_event_id is not null then
    select id into v_existing from order_payments where stripe_event_id = p_stripe_event_id;
    if v_existing is not null then return v_existing; end if;
  end if;

  insert into order_payments (order_id, amount, stripe_event_id)
  values (p_order_id, -p_amount, p_stripe_event_id)
  returning id into v_row;

  -- Partial refunds leave the order paid. Only a full reversal clears the flag,
  -- and clearing it matters: expire_stale_checkout_orders() only reclaims stock
  -- from orders where paid = false.
  select coalesce(sum(amount), 0) into v_net from order_payments where order_id = p_order_id;
  if v_net <= 0 then
    update sales_orders set paid = false where id = p_order_id;
  end if;

  return v_row;
end;
$$;

-- ── Dispute queue ──────────────────────────────────────────────────────────
-- A dispute is not a refund. The money is held, not returned, and staff have a
-- deadline to submit evidence. It gets its own table rather than a boolean on
-- sales_orders so the reason, deadline and outcome survive for the appeal.
create table if not exists payment_disputes (
  id uuid primary key default gen_random_uuid(),
  stripe_dispute_id text not null unique,
  stripe_event_id text unique,
  payment_intent_id text,
  order_id uuid references sales_orders(id) on delete set null,
  invoice_id uuid references invoices(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'usd',
  reason text,
  status text not null,
  evidence_due_by timestamptz,
  created_at timestamptz not null default now()
);

alter table payment_disputes enable row level security;

drop policy if exists "staff dispute read" on payment_disputes;
create policy "staff dispute read" on payment_disputes
  for select using (current_profile_role() = 'staff');

create index if not exists payment_disputes_order_id_idx on payment_disputes (order_id);
create index if not exists payment_disputes_invoice_id_idx on payment_disputes (invoice_id);

create or replace function record_payment_dispute(
  p_stripe_dispute_id text,
  p_payment_intent_id text,
  p_amount numeric,
  p_reason text,
  p_status text,
  p_evidence_due_by timestamptz default null,
  p_order_id uuid default null,
  p_invoice_id uuid default null,
  p_stripe_event_id text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_row uuid;
begin
  if current_profile_role() is distinct from 'staff' and auth.uid() is not null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- A dispute moves through several statuses, each firing an event. Upsert so
  -- the row tracks the latest state instead of erroring on the second event.
  insert into payment_disputes (
    stripe_dispute_id, stripe_event_id, payment_intent_id, order_id, invoice_id,
    amount, reason, status, evidence_due_by
  )
  values (
    p_stripe_dispute_id, p_stripe_event_id, p_payment_intent_id, p_order_id, p_invoice_id,
    p_amount, p_reason, p_status, p_evidence_due_by
  )
  on conflict (stripe_dispute_id) do update
    set status = excluded.status,
        reason = coalesce(excluded.reason, payment_disputes.reason),
        evidence_due_by = coalesce(excluded.evidence_due_by, payment_disputes.evidence_due_by)
  returning id into v_row;

  return v_row;
end;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────
-- Only the Stripe webhook (service_role) may move money. Migration 018 showed
-- that default privileges re-expose new functions to anon on every apply, so
-- revoke explicitly rather than relying on the default.
revoke execute on function public.reverse_payment(uuid, numeric, text, text, text) from anon, authenticated;
revoke execute on function public.reverse_order_payment(uuid, numeric, text) from anon, authenticated;
revoke execute on function public.record_payment_dispute(text, text, numeric, text, text, timestamptz, uuid, uuid, text) from anon, authenticated;

grant execute on function public.reverse_payment(uuid, numeric, text, text, text) to service_role;
grant execute on function public.reverse_order_payment(uuid, numeric, text) to service_role;
grant execute on function public.record_payment_dispute(text, text, numeric, text, text, timestamptz, uuid, uuid, text) to service_role;
