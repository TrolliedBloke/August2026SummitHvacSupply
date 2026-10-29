-- 038: pipeline automation (docs/PIPELINE-ARCHITECTURE-PLAN.md, phases 2-4).
--
-- 1. sales_orders.buyer_phone / buyer_company / po_number. Checkout has written
--    these since July but no migration created them, so every live checkout
--    insert failed with "column does not exist" before payment.
-- 2. Auto-tasks. Every new quote, contact, homeowner and dealer request opens
--    a staff task due the next business day; moving the request to a closed
--    state completes it, and reopening reopens it. Triggers never block the
--    customer's write.
-- 3. Inbound support email lands in contact_requests (channel = 'email'),
--    deduplicated on the provider's message id.
-- 4. email_messages records delivery outcomes from the provider's webhooks.
-- 5. record_external_shipment(): ShipStation's ship notification marks an order
--    shipped with the same inventory bookkeeping as ship_order(), callable only
--    by the service role (ship_order requires a staff session).
--
-- Re-runnable.

create schema if not exists private;

/* 1. Columns checkout already writes ----------------------------------------- */

alter table sales_orders add column if not exists buyer_phone text;
alter table sales_orders add column if not exists buyer_company text;
alter table sales_orders add column if not exists po_number text;

/* 2. Auto-tasks ------------------------------------------------------------------ */

alter table tasks add column if not exists source_type text;
alter table tasks add column if not exists source_id uuid;
alter table tasks add column if not exists completed_at timestamptz;
create unique index if not exists tasks_source_unique on tasks (source_type, source_id) where source_id is not null;

/** Next business day at 17:00 Pacific, as an internal working target. */
create or replace function private.next_business_day(p_from timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (
    (date_trunc('day', p_from at time zone 'America/Los_Angeles')
      + case extract(isodow from p_from at time zone 'America/Los_Angeles')
          when 5 then interval '3 days'
          when 6 then interval '2 days'
          else interval '1 day'
        end
      + interval '17 hours') at time zone 'America/Los_Angeles'
  );
$$;

/** Which status values mean "handled", per request table. */
create or replace function private.request_is_closed(p_table text, p_row jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_table
    when 'quote_requests' then coalesce(p_row->>'lifecycle', '') in ('quoted', 'closed')
    when 'contact_requests' then coalesce(p_row->>'status', '') in ('closed', 'resolved')
    when 'homeowner_requests' then coalesce(p_row->>'status', '') in ('referred', 'closed')
    when 'dealer_applications' then coalesce(p_row->>'status', '') in ('approved', 'rejected', 'withdrawn')
    else false
  end;
$$;

create or replace function private.crm_task_for_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := to_jsonb(new);
  label text;
  who text;
begin
  if tg_op = 'INSERT' then
    if private.request_is_closed(tg_table_name, r) then
      return null;
    end if;
    label := case tg_table_name
      when 'quote_requests' then 'Reply to quote request'
      when 'contact_requests' then case when r->>'channel' = 'email' then 'Reply to support email' else 'Reply to message' end
      when 'homeowner_requests' then 'Contact homeowner about installer help'
      when 'dealer_applications' then 'Review dealer application'
    end;
    who := coalesce(nullif(r->>'company', ''), nullif(r->>'contact_name', ''), nullif(r->>'name', ''), r->>'email');
    insert into public.tasks (account_id, title, owner_role, status, due_at, source_type, source_id)
    values (
      nullif(r->>'account_id', '')::uuid,
      left(label || coalesce(' ' || nullif(r->>'reference', ''), '') || coalesce(' (' || who || ')', ''), 200),
      'staff',
      'open',
      private.next_business_day(now()),
      tg_table_name,
      (r->>'id')::uuid
    )
    on conflict (source_type, source_id) where source_id is not null do nothing;
  elsif tg_op = 'UPDATE' then
    if private.request_is_closed(tg_table_name, r) then
      update public.tasks set status = 'done', completed_at = coalesce(completed_at, now())
      where source_type = tg_table_name and source_id = (r->>'id')::uuid and status <> 'done';
    else
      update public.tasks set status = 'open', completed_at = null
      where source_type = tg_table_name and source_id = (r->>'id')::uuid and status = 'done';
    end if;
  end if;
  return null;
exception when others then
  -- A dashboard task is never worth a customer's lost request.
  return null;
end;
$$;

revoke all on function private.crm_task_for_request() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['quote_requests', 'contact_requests', 'homeowner_requests', 'dealer_applications'] loop
    execute format('drop trigger if exists crm_task_for_request on public.%I', t);
    execute format(
      'create trigger crm_task_for_request after insert or update on public.%I for each row execute function private.crm_task_for_request()',
      t
    );
  end loop;
  -- Tasks and shipments also refresh the live customer view (migration 037).
  foreach t in array array['tasks', 'shipments'] loop
    execute format('drop trigger if exists crm_notify_change on public.%I', t);
    execute format(
      'create trigger crm_notify_change after insert or update or delete on public.%I for each statement execute function private.crm_notify_change()',
      t
    );
  end loop;
end;
$$;

/* Backfill: a task for every request that is open today. */
insert into tasks (account_id, title, owner_role, status, due_at, source_type, source_id)
select q.account_id, left('Reply to quote request' || coalesce(' ' || q.reference, '') || ' (' || q.name || ')', 200), 'staff', 'open', private.next_business_day(q.created_at), 'quote_requests', q.id
from quote_requests q where not private.request_is_closed('quote_requests', to_jsonb(q))
on conflict (source_type, source_id) where source_id is not null do nothing;

insert into tasks (account_id, title, owner_role, status, due_at, source_type, source_id)
select null, left('Reply to message' || coalesce(' ' || c.reference, '') || ' (' || c.name || ')', 200), 'staff', 'open', private.next_business_day(c.created_at), 'contact_requests', c.id
from contact_requests c where not private.request_is_closed('contact_requests', to_jsonb(c))
on conflict (source_type, source_id) where source_id is not null do nothing;

insert into tasks (account_id, title, owner_role, status, due_at, source_type, source_id)
select null, left('Contact homeowner about installer help' || coalesce(' ' || h.reference, '') || ' (' || h.name || ')', 200), 'staff', 'open', private.next_business_day(h.created_at), 'homeowner_requests', h.id
from homeowner_requests h where not private.request_is_closed('homeowner_requests', to_jsonb(h))
on conflict (source_type, source_id) where source_id is not null do nothing;

insert into tasks (account_id, title, owner_role, status, due_at, source_type, source_id)
select d.account_id, left('Review dealer application' || coalesce(' ' || d.reference, '') || ' (' || d.company || ')', 200), 'staff', 'open', private.next_business_day(d.created_at), 'dealer_applications', d.id
from dealer_applications d where not private.request_is_closed('dealer_applications', to_jsonb(d))
on conflict (source_type, source_id) where source_id is not null do nothing;

/* 3. Inbound support email --------------------------------------------------------- */

alter table contact_requests add column if not exists channel text not null default 'web';
alter table contact_requests add column if not exists external_id text;
create unique index if not exists contact_requests_external_id_unique on contact_requests (external_id) where external_id is not null;

/* 4. Delivery outcomes for sent email ------------------------------------------------ */

alter table email_messages add column if not exists delivery_status text;
alter table email_messages add column if not exists delivery_updated_at timestamptz;
create index if not exists email_messages_provider_id_idx on email_messages (provider_id) where provider_id is not null;

/* 5. Shipments recorded by ShipStation -------------------------------------------------- */

create or replace function public.record_external_shipment(
  p_order_number text,
  p_carrier text,
  p_service text,
  p_tracking text,
  p_shipped_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order sales_orders%rowtype;
  v_ship uuid;
  res record;
  v_existing uuid;
begin
  select * into v_order from sales_orders where order_number = p_order_number;
  if not found then
    raise exception 'order % not found', p_order_number using errcode = 'P0002';
  end if;

  -- ShipStation retries notifications; the same tracking number is one shipment.
  if nullif(p_tracking, '') is not null then
    select id into v_existing from shipments where order_id = v_order.id and tracking_number = p_tracking limit 1;
    if v_existing is not null then
      return jsonb_build_object('order_id', v_order.id, 'shipment_id', v_existing, 'duplicate', true);
    end if;
  end if;

  insert into shipments (order_id, shipment_number, carrier, tracking_number, status, shipped_at)
  values (
    v_order.id,
    'SHP-' || nextval('seq_shipment_number'),
    nullif(concat_ws(' ', nullif(p_carrier, ''), nullif(p_service, '')), ''),
    nullif(p_tracking, ''),
    'shipped',
    coalesce(p_shipped_at, now())
  )
  returning id into v_ship;

  -- Same bookkeeping as ship_order(): consume active reservations.
  for res in
    select r.*, ol.sku_id from inventory_reservations r
    join order_lines ol on ol.id = r.order_line_id
    where ol.order_id = v_order.id and r.status = 'active'
  loop
    update inventory_lots set on_hand = on_hand - res.quantity, reserved = reserved - res.quantity where id = res.lot_id;
    update inventory_reservations set status = 'shipped' where id = res.id;
    update order_lines set shipped_quantity = shipped_quantity + res.quantity where id = res.order_line_id;
    insert into inventory_movements (sku_id, lot_id, movement_type, quantity, reference_type, reference_id, note)
    values (res.sku_id, res.lot_id, 'shipment', res.quantity, 'shipment', v_ship, 'Shipped (ShipStation)');
  end loop;

  -- A ship notice covers the whole order, including lines that were never
  -- reserved (products not quantity-tracked in the catalog).
  update order_lines set shipped_quantity = quantity, fulfillment_status = 'fulfilled'
  where order_id = v_order.id and shipped_quantity < quantity;

  -- Will-call orders marked shipped in ShipStation were handed over at the
  -- counter; delivered orders are on their way, not yet delivered.
  update sales_orders
  set status = 'shipped',
      fulfillment_status = case when fulfillment_method = 'pickup' then 'picked_up' else 'out_for_delivery' end,
      fulfilled_at = case when fulfillment_method = 'pickup' then coalesce(fulfilled_at, now()) else fulfilled_at end
  where id = v_order.id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'shipment_id', v_ship,
    'duplicate', false,
    'method', v_order.fulfillment_method,
    'buyer_email', v_order.buyer_email,
    'buyer_name', v_order.buyer_name
  );
end;
$$;

revoke all on function public.record_external_shipment(text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_external_shipment(text, text, text, text, timestamptz) to service_role;
