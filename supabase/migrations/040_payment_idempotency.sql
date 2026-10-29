-- 040: payment idempotency and confirmation-email claims
-- (docs/LIABILITY-REMEDIATION-PLAN.md, 1.1 and 1.4).
--
-- * mark_order_paid records one payment per order. Staff capture, the Stripe
--   webhook, checkout expiry and reconciliation can each report the same money
--   with different event ids; only the first is recorded. Refunds are separate
--   (reverse_order_payment) and unaffected.
-- * claim_order_confirmation: an atomic "my turn to send this order's
--   confirmation" for the hourly retry and the confirmation page, so two
--   callers never send it twice and failures stop after five attempts.
--
-- Re-runnable.

create or replace function mark_order_paid(p_order_id uuid, p_amount numeric, p_stripe_event_id text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_row uuid;
  v_order sales_orders%rowtype;
begin
  if p_stripe_event_id is not null then
    select id into v_existing from order_payments where stripe_event_id = p_stripe_event_id;
    if v_existing is not null then return v_existing; end if;
  end if;
  select * into v_order from sales_orders where id = p_order_id for update;
  if v_order.paid then
    select id into v_existing from order_payments where order_id = p_order_id and amount > 0 order by created_at limit 1;
    return v_existing;
  end if;
  insert into order_payments (order_id, amount, stripe_event_id)
  values (p_order_id, p_amount, p_stripe_event_id) returning id into v_row;

  if v_order.status = 'cancelled' or v_order.checkout_state in ('expired', 'payment_failed') then
    update sales_orders
    set paid = true,
        checkout_state = 'paid_needs_review',
        hold_reason = 'paid_after_cancellation',
        hold_detail = 'Payment received after the order was cancelled or expired. Confirm the stock is on the shelf and release, or refund.',
        hold_set_at = now(),
        checkout_updated_at = now()
    where id = p_order_id;
  else
    update sales_orders
    set paid = true, checkout_state = 'paid', reservation_expires_at = null, checkout_updated_at = now()
    where id = p_order_id;
  end if;
  return v_row;
end;
$$;

revoke all on function mark_order_paid(uuid, numeric, text) from public, anon, authenticated;
grant execute on function mark_order_paid(uuid, numeric, text) to service_role;

create or replace function claim_order_confirmation(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_claimed uuid;
begin
  update sales_orders
  set confirmation_email_attempts = confirmation_email_attempts + 1,
      confirmation_email_last_attempt_at = now()
  where id = p_order_id
    and confirmation_email_status in ('pending', 'failed')
    and confirmation_email_attempts < 5
    and (confirmation_email_last_attempt_at is null or confirmation_email_last_attempt_at < now() - interval '10 minutes')
  returning id into v_claimed;
  return v_claimed is not null;
end;
$$;

revoke all on function claim_order_confirmation(uuid) from public, anon, authenticated;
grant execute on function claim_order_confirmation(uuid) to service_role;
