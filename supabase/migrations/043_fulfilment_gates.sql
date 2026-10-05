-- 043: fulfilment gates (docs/LIABILITY-REMEDIATION-PLAN.md, 1.1, 1.6, 3.7).
--
-- Rules the admin buttons used to leave to whoever clicked them:
--   * Pay before you ship: a card order is staged, handed over or delivered
--     only after its payment is captured. Net-terms orders ship once confirmed.
--   * A held order (credit limit, compliance review, paid after cancellation)
--     moves only after a named staff member releases it.
--   * A will-call order is released to a named person whose ID was checked,
--     and the record keeps who checked it.
-- They live in the database so no client, script or future screen can skip
-- them.

-- Why an order cannot be fulfilled yet, or null when it can. The same rule
-- as readyToFulfil in src/lib/backend/shipstation.ts, plus holds.
create or replace function public.order_fulfilment_block(p_order_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v sales_orders%rowtype;
begin
  select * into v from sales_orders where id = p_order_id;
  if not found then return 'order not found'; end if;
  if v.status = 'cancelled' then return 'the order is cancelled'; end if;
  if v.hold_reason is not null then return 'the order is on hold (' || v.hold_reason || '); release it first'; end if;
  -- Orders created by staff from a quote carry no payment mode: account terms.
  if v.payment_mode is null then return null; end if;
  if v.payment_mode = 'card' then
    if v.paid and v.checkout_state = 'paid' then return null; end if;
    if v.checkout_state = 'authorized' then return 'the card is authorized but not charged; confirm stock and capture it first'; end if;
    return 'the card payment has not been taken';
  end if;
  if v.payment_mode = 'net_terms' then
    if v.checkout_state = 'confirmed' then return null; end if;
    return 'the net-terms order is not confirmed';
  end if;
  if v.payment_mode = 'freight_quote' then
    if v.paid then return null; end if;
    if v.account_id is not null and exists (
      select 1 from invoices i where i.order_id = v.id and i.status not in ('void', 'draft')
    ) then return null; end if;
    return 'the freight quote has not been paid or invoiced on account';
  end if;
  return 'unknown payment mode ' || v.payment_mode;
end;
$$;

revoke execute on function public.order_fulfilment_block(uuid) from public, anon, authenticated;
grant execute on function public.order_fulfilment_block(uuid) to service_role;

-- Staff advance an order. Moving it forward (staged, out, delivered, picked
-- up) requires it to be ready; picked_up also needs the collector's name and
-- an ID check. Moving it back to pending is always allowed.
drop function if exists public.advance_fulfillment(uuid, text);
create or replace function public.advance_fulfillment(
  p_order_id uuid,
  p_status text,
  p_collected_by text default null,
  p_id_checked boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_block text;
  v_staff text;
begin
  perform assert_staff();
  if p_status not in ('pending', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'picked_up', 'cancelled') then
    raise exception 'invalid fulfillment status %', p_status;
  end if;
  perform 1 from sales_orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;

  if p_status in ('ready_for_pickup', 'out_for_delivery', 'delivered', 'picked_up') then
    v_block := order_fulfilment_block(p_order_id);
    if v_block is not null then
      raise exception 'Cannot advance: %', v_block using errcode = 'P0001';
    end if;
  end if;
  if p_status = 'cancelled' then
    raise exception 'Cancel the order from the order actions, so the payment is released or refunded with it.' using errcode = 'P0001';
  end if;

  if p_status = 'picked_up' then
    if nullif(btrim(coalesce(p_collected_by, '')), '') is null or not coalesce(p_id_checked, false) then
      raise exception 'Record who collected the order and confirm you checked their ID.' using errcode = 'P0001';
    end if;
    select coalesce(nullif(name, ''), email, auth.uid()::text) into v_staff from user_profiles where id = auth.uid();
    update sales_orders
      set picked_up_by = left(btrim(p_collected_by), 200),
          pickup_verified_by = coalesce(v_staff, auth.uid()::text),
          pickup_verified_at = now()
      where id = p_order_id;
  end if;

  update sales_orders
  set fulfillment_status = p_status,
      fulfilled_at = case
        when p_status in ('delivered', 'picked_up') then coalesce(fulfilled_at, now())
        else null
      end
  where id = p_order_id;
end;
$$;

revoke execute on function public.advance_fulfillment(uuid, text, text, boolean) from public, anon;
grant execute on function public.advance_fulfillment(uuid, text, text, boolean) to authenticated;

-- Staff cancel an order that has not shipped and holds no captured payment
-- (a held net-terms order, an unpaid freight quote). Card authorizations are
-- released through Stripe first by the app (cancelAuthorizedOrder); a paid
-- order is refunded, never cancelled here. Service role only: the admin
-- server action checks the staff session before calling it.
create or replace function public.cancel_unshipped_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v sales_orders%rowtype;
  r record;
begin
  select * into v from sales_orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v.paid then raise exception 'This order has a captured payment. Refund it instead.' using errcode = 'P0001'; end if;
  if v.fulfillment_status in ('out_for_delivery', 'delivered', 'picked_up') or v.status = 'shipped' then
    raise exception 'This order has already left the counter.' using errcode = 'P0001';
  end if;
  if v.status = 'cancelled' then return; end if;

  for r in
    select ir.id, ir.lot_id, ir.quantity, ol.id as order_line_id, ol.sku_id
    from inventory_reservations ir
    join order_lines ol on ol.id = ir.order_line_id
    where ol.order_id = p_order_id and ir.status = 'active'
    for update of ir
  loop
    update inventory_lots set reserved = greatest(0, reserved - r.quantity) where id = r.lot_id;
    update inventory_reservations set status = 'released' where id = r.id;
    update order_lines set reserved_quantity = greatest(0, reserved_quantity - r.quantity) where id = r.order_line_id;
    insert into inventory_movements (sku_id, lot_id, movement_type, quantity, reference_type, reference_id, note)
    values (r.sku_id, r.lot_id, 'release', r.quantity, 'sales_order', p_order_id, 'Released: order cancelled by staff');
  end loop;

  update sales_orders
    set status = 'cancelled',
        fulfillment_status = 'cancelled',
        reservation_expires_at = null,
        checkout_updated_at = now(),
        hold_detail = left(concat_ws(' · ', hold_detail, 'Cancelled: ' || coalesce(p_reason, '')), 1000),
        hold_reason = null
    where id = p_order_id;
end;
$$;

revoke execute on function public.cancel_unshipped_order(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_unshipped_order(uuid, text) to service_role;
