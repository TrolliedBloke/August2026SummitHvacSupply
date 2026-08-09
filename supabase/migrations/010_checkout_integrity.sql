-- Server-authoritative checkout lifecycle, retry deduplication, and expiring
-- inventory reservations for unpaid card orders.
alter table sales_orders add column if not exists checkout_state text not null default 'confirmed'
  check (checkout_state in ('checkout_started', 'payment_pending', 'paid', 'payment_failed', 'expired', 'confirmed'));
alter table sales_orders add column if not exists checkout_idempotency_key uuid;
alter table sales_orders add column if not exists reservation_expires_at timestamptz;
alter table sales_orders add column if not exists payment_intent_id text;
alter table sales_orders add column if not exists payment_mode text
  check (payment_mode in ('card', 'net_terms', 'freight_quote'));
alter table sales_orders add column if not exists checkout_updated_at timestamptz not null default now();

create unique index if not exists sales_orders_checkout_idempotency_key_idx
  on sales_orders(checkout_idempotency_key) where checkout_idempotency_key is not null;
create index if not exists sales_orders_reservation_expiry_idx
  on sales_orders(reservation_expires_at) where checkout_state = 'payment_pending';

create or replace function release_checkout_order(p_order_id uuid, p_state text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if p_state not in ('payment_failed', 'expired') then
    raise exception 'invalid terminal checkout state %', p_state;
  end if;

  for r in
    select ir.id, ir.lot_id, ir.quantity, ol.id as order_line_id, ol.sku_id
    from inventory_reservations ir
    join order_lines ol on ol.id = ir.order_line_id
    where ol.order_id = p_order_id and ir.status = 'active'
    for update of ir
  loop
    update inventory_lots
      set reserved = greatest(0, reserved - r.quantity)
      where id = r.lot_id;
    update inventory_reservations set status = 'released' where id = r.id;
    update order_lines
      set reserved_quantity = greatest(0, reserved_quantity - r.quantity)
      where id = r.order_line_id;
    insert into inventory_movements
      (sku_id, lot_id, movement_type, quantity, reference_type, reference_id, note)
    values
      (r.sku_id, r.lot_id, 'release', r.quantity, 'sales_order', p_order_id, 'Released by checkout lifecycle');
  end loop;

  update sales_orders
    set checkout_state = p_state,
        checkout_updated_at = now(),
        reservation_expires_at = null,
        fulfillment_status = 'cancelled',
        status = 'cancelled'
    where id = p_order_id and paid = false
      and checkout_state not in ('paid', 'confirmed', 'expired');
end;
$$;

create or replace function expire_stale_checkout_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare
  row record;
  released integer := 0;
begin
  for row in
    select id from sales_orders
    where checkout_state = 'payment_pending'
      and paid = false
      and reservation_expires_at <= now()
    for update skip locked
  loop
    perform release_checkout_order(row.id, 'expired');
    released := released + 1;
  end loop;
  return released;
end;
$$;

create or replace function mark_order_paid(p_order_id uuid, p_amount numeric, p_stripe_event_id text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_row uuid;
begin
  if p_stripe_event_id is not null then
    select id into v_existing from order_payments where stripe_event_id = p_stripe_event_id;
    if v_existing is not null then return v_existing; end if;
  end if;
  insert into order_payments (order_id, amount, stripe_event_id)
  values (p_order_id, p_amount, p_stripe_event_id) returning id into v_row;
  update sales_orders set paid = true, checkout_state = 'paid', reservation_expires_at = null,
    checkout_updated_at = now() where id = p_order_id;
  return v_row;
end;
$$;

grant execute on function release_checkout_order(uuid, text) to service_role;
grant execute on function expire_stale_checkout_orders() to service_role;
grant execute on function mark_order_paid(uuid, numeric, text) to service_role;
