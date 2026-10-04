-- 037: live updates for the staff customer view (/admin/customers).
--
-- Any change to a table the customer view reads sends one broadcast on the
-- private Realtime topic "crm". The payload is only the table name and the
-- operation -- no row data, no email addresses -- so nothing about a customer
-- leaves the database through Realtime. The page reacts by re-running its own
-- server query, which is already behind requireStaff and the service role.
--
-- Statement-level triggers: a bulk import fires one event, not one per row.
-- The trigger can never fail a write: a customer's order or request is worth
-- more than a dashboard refresh.
--
-- Only staff may receive the topic (policy on realtime.messages).
--
-- Re-runnable.

create schema if not exists private;

create or replace function private.crm_notify_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('table', tg_table_name, 'op', lower(tg_op)),
    'change',
    'crm',
    true
  );
  return null;
exception when others then
  return null;
end;
$$;

revoke all on function private.crm_notify_change() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'user_profiles', 'accounts', 'contacts',
    'quote_requests', 'contact_requests', 'homeowner_requests', 'dealer_applications',
    'sales_orders', 'order_lines', 'cart_snapshots',
    'back_in_stock_subscriptions', 'category_stock_alerts',
    'finder_sessions', 'marketing_consents', 'email_messages'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists crm_notify_change on public.%I', t);
      execute format(
        'create trigger crm_notify_change after insert or update or delete on public.%I for each statement execute function private.crm_notify_change()',
        t
      );
    end if;
  end loop;
end;
$$;

drop policy if exists "staff receive crm changes" on realtime.messages;
create policy "staff receive crm changes" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'crm' and public.current_profile_role() = 'staff');
