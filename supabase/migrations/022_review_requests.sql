-- ============================================================================
-- 022_review_requests.sql
-- Day-14 post-delivery review request (PLAN.md 2.3).
--
-- Two facts were missing before this migration:
--   * WHEN an order was handed to the customer. fulfillment_status records the
--     terminal state but not its timestamp, so "14 days after delivery" was
--     not expressible. advance_fulfillment now stamps fulfilled_at the first
--     time an order reaches 'delivered' or 'picked_up', and clears it if the
--     order is walked back to a non-terminal state.
--   * WHETHER we already asked. Without this the dispatcher would re-send on
--     every run. It is a timestamp rather than a boolean so the send is
--     auditable after the fact.
--
-- Both columns are nullable with no default: existing orders predate the
-- feature and must not be treated as freshly delivered, which would blast a
-- review request at the entire order history on first run.
-- ============================================================================

alter table sales_orders add column if not exists fulfilled_at timestamptz;
alter table sales_orders add column if not exists review_request_sent_at timestamptz;

-- Partial index: the dispatcher only ever scans delivered-but-unasked orders,
-- which stays a small slice of the table.
create index if not exists sales_orders_review_request_due_idx
  on sales_orders (fulfilled_at)
  where review_request_sent_at is null and fulfilled_at is not null;

-- ── Stamp fulfilled_at on the terminal transition ───────────────────────────
create or replace function advance_fulfillment(p_order_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_staff();
  if p_status not in ('pending', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'picked_up', 'cancelled') then
    raise exception 'invalid fulfillment status %', p_status;
  end if;

  update sales_orders
  set fulfillment_status = p_status,
      -- coalesce keeps the ORIGINAL handover time if staff re-save a delivered
      -- order; the clock must not restart and re-arm a second request.
      fulfilled_at = case
        when p_status in ('delivered', 'picked_up') then coalesce(fulfilled_at, now())
        else null
      end
  where id = p_order_id;
end;
$$;

grant execute on function advance_fulfillment(uuid, text) to authenticated;
