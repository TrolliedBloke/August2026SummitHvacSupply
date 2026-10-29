-- 042: pipeline hardening (docs/QA-REPORT-2026-10-04.md: QA-002, QA-005, QA-019).
--
-- 1. private.invoke_function / private.invoke_site_route raise when
--    private.app_config is not filled in. They used to RAISE NOTICE and
--    return, so every scheduled job reported "succeeded" while doing nothing
--    (QuickBooks sync, low-stock alert, AR statements, payment safety). A
--    failure now shows as failed in cron.job_run_details.
-- 2. record_external_shipment() locks the order, treats a repeated notice as a
--    duplicate even without a tracking number, and no longer marks an unpaid or
--    cancelled order as an ordinary shipment: the shipment is still recorded
--    (the label exists; hiding it would lose a fact), but the order goes on
--    hold with a staff alert and the caller is told not to email the buyer.
-- 3. crm_task_for_request() (039's version): a draft dealer application opens
--    no review task until it is submitted, and a request reopened without a
--    task gets one.
--
-- Re-runnable.

/* 1. Scheduled jobs fail loudly ------------------------------------------------------ */

create or replace function private.invoke_function(p_name text)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
declare cfg private.app_config;
begin
  select * into cfg from private.app_config limit 1;
  if not found or cfg.functions_base_url is null or cfg.service_role_key is null then
    raise exception 'private.app_config has no functions_base_url/service_role_key; % did not run', p_name;
  end if;
  perform net.http_post(
    url := cfg.functions_base_url || '/' || p_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cfg.service_role_key
    ),
    body := '{}'::jsonb
  );
end;
$$;

create or replace function private.invoke_site_route(p_path text)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
declare cfg private.app_config;
begin
  select * into cfg from private.app_config limit 1;
  if not found or cfg.site_base_url is null or cfg.cron_secret is null then
    raise exception 'private.app_config has no site_base_url/cron_secret; % did not run', p_path;
  end if;
  perform net.http_get(
    url := rtrim(cfg.site_base_url, '/') || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || cfg.cron_secret)
  );
end;
$$;

revoke all on function private.invoke_function(text) from public, anon, authenticated;
revoke all on function private.invoke_site_route(text) from public, anon, authenticated;

/* 2. Ship notices --------------------------------------------------------------------- */

-- One shipment per tracking number per order, also under concurrent retries.
create unique index if not exists shipments_order_tracking_unique
  on shipments (order_id, tracking_number) where tracking_number is not null;

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
  v_tracking text := nullif(btrim(coalesce(p_tracking, '')), '');
  v_problem text;
begin
  -- The lock serialises ShipStation's retries of the same notice.
  select * into v_order from sales_orders where order_number = p_order_number for update;
  if not found then
    raise exception 'order % not found', p_order_number using errcode = 'P0002';
  end if;

  if v_tracking is not null then
    select id into v_existing from shipments where order_id = v_order.id and tracking_number = v_tracking limit 1;
  elsif v_order.status = 'shipped' then
    -- No tracking number (a will-call handover or a local run): the order is
    -- shipped as a whole, so a second untracked notice is the same event.
    select id into v_existing from shipments where order_id = v_order.id order by shipped_at desc nulls last limit 1;
  end if;
  if v_existing is not null then
    return jsonb_build_object('order_id', v_order.id, 'shipment_id', v_existing, 'duplicate', true);
  end if;

  -- Pay before you ship: card orders need a captured payment, net-terms
  -- orders a confirmed checkout. Anything else that leaves the building is
  -- recorded, held and escalated -- never treated as a normal shipment.
  v_problem := case
    when v_order.status = 'cancelled' then 'shipped_after_cancellation'
    when v_order.hold_reason is not null then 'shipped_while_on_hold'
    when not (v_order.paid or (v_order.payment_mode = 'net_terms' and v_order.checkout_state = 'confirmed')) then 'shipped_without_payment'
  end;

  insert into shipments (order_id, shipment_number, carrier, tracking_number, status, shipped_at)
  values (
    v_order.id,
    'SHP-' || nextval('seq_shipment_number'),
    nullif(concat_ws(' ', nullif(p_carrier, ''), nullif(p_service, '')), ''),
    v_tracking,
    'shipped',
    coalesce(p_shipped_at, now())
  )
  returning id into v_ship;

  -- Same bookkeeping as ship_order(): consume active reservations.
  for res in
    select r.*, ol.sku_id from inventory_reservations r
    join order_lines ol on ol.id = r.order_line_id
    where ol.order_id = v_order.id and r.status = 'active'
    for update of r
  loop
    update inventory_lots set on_hand = on_hand - res.quantity, reserved = reserved - res.quantity where id = res.lot_id;
    update inventory_reservations set status = 'shipped' where id = res.id;
    update order_lines set shipped_quantity = shipped_quantity + res.quantity where id = res.order_line_id;
    insert into inventory_movements (sku_id, lot_id, movement_type, quantity, reference_type, reference_id, note)
    values (res.sku_id, res.lot_id, 'shipment', res.quantity, 'shipment', v_ship, 'Shipped (ShipStation)');
  end loop;

  update order_lines set shipped_quantity = quantity, fulfillment_status = 'fulfilled'
  where order_id = v_order.id and shipped_quantity < quantity;

  if v_problem is null then
    update sales_orders
    set status = 'shipped',
        fulfillment_status = case when fulfillment_method = 'pickup' then 'picked_up' else 'out_for_delivery' end,
        fulfilled_at = case when fulfillment_method = 'pickup' then coalesce(fulfilled_at, now()) else fulfilled_at end
    where id = v_order.id;
  else
    -- Keep the order's status as it was; the hold and the alert are the record.
    update sales_orders
    set hold_reason = coalesce(hold_reason, v_problem),
        hold_detail = coalesce(hold_detail, 'ShipStation reported a shipment for an order that was not ready to ship. Check payment and the goods before anything else is sent.'),
        hold_set_at = coalesce(hold_set_at, now())
    where id = v_order.id;
    insert into staff_alerts (kind, dedupe_key, subject, body, severity, related_type, related_id)
    values (
      v_problem,
      v_problem || ':' || v_order.id,
      'Shipped without clearance: ' || v_order.order_number,
      'ShipStation reported shipment ' || coalesce(v_tracking, '(no tracking)') || ' for ' || v_order.order_number
        || ' (status ' || v_order.status::text || ', checkout ' || v_order.checkout_state || ', paid ' || v_order.paid::text || ').',
      'urgent',
      'order',
      v_order.id::text
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'shipment_id', v_ship,
    'duplicate', false,
    'needs_review', v_problem is not null,
    'problem', v_problem,
    'method', v_order.fulfillment_method,
    'buyer_email', v_order.buyer_email,
    'buyer_name', v_order.buyer_name
  );
end;
$$;

revoke all on function public.record_external_shipment(text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_external_shipment(text, text, text, text, timestamptz) to service_role;

/* 3. Auto-tasks (039's function with two changes) --------------------------------------- */

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
  ref text;
begin
  -- A dealer application still being filled in is not waiting on staff.
  if tg_table_name = 'dealer_applications' and r->>'status' = 'draft' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if private.request_is_closed(tg_table_name, r) then
      update public.tasks set status = 'done', completed_at = coalesce(completed_at, now())
      where source_type = tg_table_name and source_id = (r->>'id')::uuid and status <> 'done';
      return null;
    end if;
    update public.tasks set status = 'open', completed_at = null
    where source_type = tg_table_name and source_id = (r->>'id')::uuid and status = 'done';
    if exists (select 1 from public.tasks where source_type = tg_table_name and source_id = (r->>'id')::uuid) then
      return null;
    end if;
    -- Open with no task: a request that arrived closed and was reopened, or a
    -- draft that was just submitted. Fall through and create one.
  elsif private.request_is_closed(tg_table_name, r) then
    return null;
  end if;

  label := case tg_table_name
    when 'quote_requests' then 'Reply to quote request'
    when 'contact_requests' then case when r->>'channel' = 'email' then 'Reply to support email' else 'Reply to message' end
    when 'homeowner_requests' then 'Contact homeowner about installer help'
    when 'dealer_applications' then 'Review dealer application'
    when 'rmas' then 'Process return'
    when 'warranty_claims' then 'Handle warranty claim'
    when 'privacy_requests' then 'Complete privacy request'
  end;
  ref := coalesce(nullif(r->>'reference', ''), nullif(r->>'rma_number', ''), nullif(r->>'claim_number', ''));
  who := coalesce(nullif(r->>'company', ''), nullif(r->>'contact_name', ''), nullif(r->>'name', ''),
    nullif(r->>'requester_name', ''), nullif(r->>'claimant_name', ''),
    r->>'email', r->>'requester_email', r->>'claimant_email');
  insert into public.tasks (account_id, title, owner_role, status, due_at, source_type, source_id)
  values (
    nullif(r->>'account_id', '')::uuid,
    left(label || coalesce(' ' || ref, '') || coalesce(' (' || who || ')', ''), 200),
    'staff',
    'open',
    private.next_business_day(now()),
    tg_table_name,
    (r->>'id')::uuid
  )
  on conflict (source_type, source_id) where source_id is not null do nothing;
  return null;
exception when others then
  -- A dashboard task is never worth a customer's lost request.
  return null;
end;
$$;

revoke all on function private.crm_task_for_request() from public, anon, authenticated;
