-- 039: liability safeguards (docs/LIABILITY-REMEDIATION-PLAN.md, phases 1, 2, 3, 6, 7).
--
-- Payments
--   * New checkout states: 'authorized' (card held, not charged, waiting for the
--     counter to confirm stock) and 'paid_needs_review' (money arrived for an
--     order that was already cancelled or expired -- never silently cancelled).
--   * mark_order_authorized(): records a card authorization; reports whether the
--     order is still live so the webhook can release a stale authorization.
--   * mark_order_paid(): unchanged for live orders; a payment on a cancelled or
--     expired order is recorded, held and flagged instead of leaving a charged
--     customer with a cancelled order.
--   * Order holds (credit limit, compliance, payment review) keep an order out
--     of fulfilment until a named staff member releases it.
-- Evidence
--   * install_acknowledgement: what the buyer agreed to at checkout, verbatim.
--   * Will-call pickup: who collected, and which staff member checked.
-- Returns, warranty, privacy
--   * rmas and warranty_claims gain the fields a guest or phone case needs.
--   * privacy_requests: know / delete / correct requests with a 45-day due date.
--   * All three open staff tasks through the auto-task trigger (migration 038).
-- Operations
--   * staff_alerts: one row per distinct problem (deduplicated), so an alert is
--     emailed once, not every 15 minutes.
--   * job_heartbeats: proof that background jobs ran.
--   * payment_reconciliation_runs: what the Stripe reconciliation found.
--
-- Re-runnable.

create schema if not exists private;

/* Checkout states --------------------------------------------------------------- */

alter table sales_orders drop constraint if exists sales_orders_checkout_state_check;
alter table sales_orders add constraint sales_orders_checkout_state_check
  check (checkout_state in ('checkout_started', 'payment_pending', 'authorized', 'paid', 'paid_needs_review', 'payment_failed', 'expired', 'confirmed'));

alter table sales_orders add column if not exists authorized_at timestamptz;
alter table sales_orders add column if not exists authorization_expires_at timestamptz;

/* Holds, acknowledgements, pickup evidence -------------------------------------- */

alter table sales_orders add column if not exists hold_reason text;
alter table sales_orders add column if not exists hold_detail text;
alter table sales_orders add column if not exists hold_set_at timestamptz;
alter table sales_orders add column if not exists hold_released_by text;
alter table sales_orders add column if not exists hold_released_at timestamptz;
alter table sales_orders add column if not exists install_acknowledgement jsonb;
alter table sales_orders add column if not exists picked_up_by text;
alter table sales_orders add column if not exists pickup_verified_by text;
alter table sales_orders add column if not exists pickup_verified_at timestamptz;

create index if not exists sales_orders_hold_idx on sales_orders (hold_set_at) where hold_reason is not null;
create index if not exists sales_orders_authorized_idx on sales_orders (authorization_expires_at) where checkout_state = 'authorized';

/* Payment functions ------------------------------------------------------------------ */

create or replace function mark_order_authorized(p_order_id uuid, p_amount numeric, p_stripe_event_id text default null, p_expires_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order sales_orders%rowtype;
begin
  select * into v_order from sales_orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('live', false, 'reason', 'not_found');
  end if;
  -- An authorization for an order that is no longer live must be released by
  -- the caller; nothing here revives a cancelled order.
  if v_order.status = 'cancelled' or v_order.checkout_state in ('expired', 'payment_failed') then
    return jsonb_build_object('live', false, 'reason', v_order.checkout_state);
  end if;
  if v_order.checkout_state in ('paid', 'paid_needs_review', 'authorized') then
    return jsonb_build_object('live', true, 'reason', 'already_' || v_order.checkout_state);
  end if;
  update sales_orders
  set checkout_state = 'authorized',
      authorized_at = now(),
      authorization_expires_at = coalesce(p_expires_at, now() + interval '7 days'),
      -- The stock stays held until the counter confirms or releases it.
      reservation_expires_at = null,
      checkout_updated_at = now()
  where id = p_order_id;
  return jsonb_build_object('live', true, 'reason', 'authorized');
end;
$$;

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
  insert into order_payments (order_id, amount, stripe_event_id)
  values (p_order_id, p_amount, p_stripe_event_id) returning id into v_row;

  if v_order.status = 'cancelled' or v_order.checkout_state in ('expired', 'payment_failed') then
    -- Money arrived for an order we had already let go. Record it, keep the
    -- order out of fulfilment, and make staff decide: re-reserve or refund.
    update sales_orders
    set paid = true,
        checkout_state = 'paid_needs_review',
        hold_reason = 'paid_after_cancellation',
        hold_detail = 'Payment received after the order was cancelled or expired. Re-reserve stock and fulfil, or refund.',
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

revoke all on function mark_order_authorized(uuid, numeric, text, timestamptz) from public, anon, authenticated;
grant execute on function mark_order_authorized(uuid, numeric, text, timestamptz) to service_role;
revoke all on function mark_order_paid(uuid, numeric, text) from public, anon, authenticated;
grant execute on function mark_order_paid(uuid, numeric, text) to service_role;

/* Returns ------------------------------------------------------------------------------ */

alter table rmas add column if not exists requester_name text;
alter table rmas add column if not exists requester_email text;
alter table rmas add column if not exists channel text not null default 'portal';
alter table rmas add column if not exists decision text;
alter table rmas add column if not exists refund_amount numeric(12, 2);
alter table rmas add column if not exists refund_id text;
alter table rmas add column if not exists received_at timestamptz;
alter table rmas add column if not exists decided_by text;
alter table rmas add column if not exists decided_at timestamptz;
alter table rmas add column if not exists closed_at timestamptz;
alter table rmas add column if not exists staff_notes text;

/* Warranty ---------------------------------------------------------------------------- */

alter table warranty_claims add column if not exists order_id uuid references sales_orders(id) on delete set null;
alter table warranty_claims add column if not exists order_ref text;
alter table warranty_claims add column if not exists claimant_name text;
alter table warranty_claims add column if not exists claimant_email text;
alter table warranty_claims add column if not exists claimant_phone text;
alter table warranty_claims add column if not exists product_description text;
alter table warranty_claims add column if not exists model_number text;
alter table warranty_claims add column if not exists install_date date;
alter table warranty_claims add column if not exists installer_name text;
alter table warranty_claims add column if not exists installer_license text;
alter table warranty_claims add column if not exists client_request_id uuid;
alter table warranty_claims add column if not exists staff_notes text;
create unique index if not exists warranty_claims_client_request_unique on warranty_claims (client_request_id) where client_request_id is not null;

/* Privacy requests --------------------------------------------------------------------- */

create table if not exists privacy_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  email text not null,
  name text,
  kind text not null check (kind in ('know', 'delete', 'correct', 'opt_out')),
  details text,
  status text not null default 'received' check (status in ('received', 'verifying', 'in_progress', 'completed', 'rejected')),
  -- CCPA: respond within 45 days of receipt.
  due_at timestamptz not null default (now() + interval '45 days'),
  verified_at timestamptz,
  completed_at timestamptz,
  completed_by text,
  outcome text,
  client_request_id uuid unique,
  created_at timestamptz not null default now()
);
alter table privacy_requests enable row level security;
drop policy if exists "staff read privacy requests" on privacy_requests;
create policy "staff read privacy requests" on privacy_requests for select using (current_profile_role() = 'staff');
revoke all on privacy_requests from anon;
revoke insert, update, delete, truncate, references, trigger on privacy_requests from authenticated;

/* Staff alerts, heartbeats, reconciliation ------------------------------------------ */

create table if not exists staff_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  -- One open alert per problem: the same key is not emailed twice.
  dedupe_key text not null unique,
  subject text not null,
  body text,
  severity text not null default 'normal' check (severity in ('normal', 'urgent')),
  related_type text,
  related_id text,
  emailed_at timestamptz,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);
create index if not exists staff_alerts_open_idx on staff_alerts (created_at desc) where resolved_at is null;

create table if not exists job_heartbeats (
  job text primary key,
  last_run_at timestamptz not null,
  last_status text not null check (last_status in ('ok', 'error')),
  detail jsonb
);

create table if not exists payment_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  checked integer not null default 0,
  fixed integer not null default 0,
  issues jsonb not null default '[]'::jsonb,
  error text
);

do $$
declare
  t text;
begin
  foreach t in array array['staff_alerts', 'job_heartbeats', 'payment_reconciliation_runs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "staff read %s" on public.%I', t, t);
    execute format('create policy "staff read %s" on public.%I for select using (current_profile_role() = ''staff'')', t, t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
  end loop;
end;
$$;

/* Auto-tasks for returns, warranty and privacy --------------------------------------- */

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
    when 'rmas' then coalesce(p_row->>'status', '') = 'closed'
    when 'warranty_claims' then coalesce(p_row->>'status', '') = 'closed'
    when 'privacy_requests' then coalesce(p_row->>'status', '') in ('completed', 'rejected')
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
  ref text;
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
  return null;
end;
$$;

revoke all on function private.crm_task_for_request() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['rmas', 'warranty_claims', 'privacy_requests'] loop
    execute format('drop trigger if exists crm_task_for_request on public.%I', t);
    execute format(
      'create trigger crm_task_for_request after insert or update on public.%I for each row execute function private.crm_task_for_request()',
      t
    );
  end loop;
  foreach t in array array['rmas', 'warranty_claims', 'privacy_requests', 'staff_alerts'] loop
    execute format('drop trigger if exists crm_notify_change on public.%I', t);
    execute format(
      'create trigger crm_notify_change after insert or update or delete on public.%I for each statement execute function private.crm_notify_change()',
      t
    );
  end loop;
end;
$$;

-- Backfill: tasks for returns and warranty claims that are open today.
insert into tasks (account_id, title, owner_role, status, due_at, source_type, source_id)
select r.account_id, left('Process return ' || r.rma_number, 200), 'staff', 'open', private.next_business_day(r.created_at), 'rmas', r.id
from rmas r where r.status <> 'closed'
on conflict (source_type, source_id) where source_id is not null do nothing;

insert into tasks (account_id, title, owner_role, status, due_at, source_type, source_id)
select w.account_id, left('Handle warranty claim ' || w.claim_number, 200), 'staff', 'open', private.next_business_day(w.created_at), 'warranty_claims', w.id
from warranty_claims w where w.status <> 'closed'
on conflict (source_type, source_id) where source_id is not null do nothing;
