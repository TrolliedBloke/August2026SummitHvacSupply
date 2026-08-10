-- ROOT CAUSE of the "anon can execute financial functions" class.
--
-- APPLIED to cswrezdcwdqnhwplmddr on 2026-08-10 as
-- `018_default_privileges_and_reclose_functions`.
--
-- Applying 006/010/012/014 re-exposed six SECURITY DEFINER functions to anon --
-- including mark_order_paid, which flips an order to paid -- even though each
-- migration ran `revoke execute ... from public`. The revoke was aimed at the
-- wrong grantee. The ACL showed EXPLICIT grants:
--   mark_order_paid: postgres=X/postgres | anon=X/postgres |
--                    authenticated=X/postgres | service_role=X/postgres
--
-- They come from Supabase's default privileges:
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, ...;
--
-- Every function created in `public` is therefore executable by
-- unauthenticated callers, and every new table fully writable by them, with RLS
-- as the only remaining control. Fixing objects one at a time is a treadmill:
-- the next migration reopens it. This changes the default.
--
-- THIRD distinct form of the same trap in this database:
--   1. column REVOKE inert under a table-level SELECT grant   (015)
--   2. EXECUTE granted to PUBLIC by default                   (016)
--   3. EXECUTE/DML granted to anon by DEFAULT PRIVILEGES      (here)
-- Each reported success while changing nothing.

alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate on tables from anon;

revoke execute on function public.mark_order_paid(uuid, numeric, text) from anon, authenticated;
revoke execute on function public.release_checkout_order(uuid, text) from anon, authenticated;
revoke execute on function public.expire_stale_checkout_orders() from anon, authenticated;
revoke execute on function public.reserve_public_order(uuid) from anon, authenticated;
revoke execute on function public.handle_new_retail_user() from anon, authenticated;
revoke execute on function public.advance_fulfillment(uuid, text) from anon;

do $$
declare t text;
begin
  foreach t in array array[
    'contact_requests','delivery_zones','order_payments',
    'back_in_stock_subscriptions','cart_snapshots','chat_transcripts',
    'saved_lists','site_events','product_reviews',
    'catalog_products','catalog_product_evidence','catalog_product_costs',
    'catalog_product_trade_pricing','catalog_product_media',
    'catalog_product_documents','catalog_product_relationships',
    'catalog_import_runs'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('revoke insert, update, delete, truncate on public.%I from anon', t);
    end if;
  end loop;
end $$;

revoke select on contact_requests, order_payments, back_in_stock_subscriptions,
  cart_snapshots, chat_transcripts, site_events, saved_lists from anon;
revoke all on catalog_product_costs from anon, authenticated;
revoke all on catalog_product_trade_pricing from anon;
revoke all on catalog_import_runs from anon;

notify pgrst, 'reload schema';
