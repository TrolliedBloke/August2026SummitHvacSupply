-- 028: order confirmation state and order-line returns (design remediation 25, 27).
--
-- Confirmation email delivery is tracked separately from the order: a failed
-- email never makes a successful order look failed, and staff can retry it.
-- RMAs can now be started from a catalog order line with the policy version
-- that evaluated it, and at most one open RMA exists per line. Re-runnable.

alter table sales_orders add column if not exists confirmation_email_status text not null default 'pending';
alter table sales_orders add column if not exists confirmation_email_attempts integer not null default 0;
alter table sales_orders add column if not exists confirmation_email_last_attempt_at timestamptz;
do $$ begin
  alter table sales_orders add constraint sales_orders_confirmation_email_status_check
    check (confirmation_email_status in ('pending', 'sent', 'failed', 'not_applicable'));
exception when duplicate_object then null; end $$;

alter table order_lines add column if not exists fulfillment_status text not null default 'pending';
do $$ begin
  alter table order_lines add constraint order_lines_fulfillment_status_check
    check (fulfillment_status in ('pending', 'ready', 'partial', 'backordered', 'fulfilled', 'cancelled'));
exception when duplicate_object then null; end $$;

alter table rmas add column if not exists order_line_id uuid references order_lines(id) on delete set null;
alter table rmas add column if not exists catalog_product_id text;
alter table rmas add column if not exists quantity integer check (quantity is null or quantity > 0);
alter table rmas add column if not exists policy_version text;
alter table rmas add column if not exists preliminary_outcome text;
alter table rmas add column if not exists facts jsonb;
alter table rmas add column if not exists requested_by uuid references auth.users(id) on delete set null;
create unique index if not exists rmas_one_open_per_line
  on rmas (order_line_id) where order_line_id is not null and status in ('open', 'waiting');
