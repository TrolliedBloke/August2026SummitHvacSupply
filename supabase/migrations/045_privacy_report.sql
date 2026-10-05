-- 045: the "right to know" report (docs/LIABILITY-REMEDIATION-PLAN.md, 6.1).
--
-- Every record held about one email, matched exactly (lower + trim) in SQL.
-- Matching in the app with ILIKE would treat "_" in an address as a wildcard
-- and could pull another person's rows into someone's report. Service role
-- only; the staff page checks the session first.

create or replace function public.privacy_report(p_email text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with e as (select lower(btrim(p_email)) as v),
  orders as (select * from sales_orders where lower(btrim(buyer_email)) = (select v from e))
  select jsonb_build_object(
    'email', (select v from e),
    'generated_at', now(),
    'account_profiles', coalesce((select jsonb_agg(to_jsonb(p) - 'id') from user_profiles p where lower(btrim(p.email)) = (select v from e)), '[]'::jsonb),
    'account_contacts', coalesce((select jsonb_agg(to_jsonb(c) - 'id') from contacts c where lower(btrim(c.email)) = (select v from e)), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
        'order_number', o.order_number, 'created_at', o.created_at, 'status', o.status, 'total', o.total, 'paid', o.paid,
        'fulfillment_method', o.fulfillment_method, 'delivery_address', o.delivery_address, 'delivery_zip', o.delivery_zip,
        'buyer_name', o.buyer_name, 'buyer_phone', o.buyer_phone, 'buyer_company', o.buyer_company, 'po_number', o.po_number,
        'picked_up_by', o.picked_up_by, 'acknowledgements', o.install_acknowledgement,
        'lines', coalesce((select jsonb_agg(jsonb_build_object('description', l.description, 'quantity', l.quantity, 'unit_price', l.unit_price)) from order_lines l where l.order_id = o.id), '[]'::jsonb)
      )) from orders o), '[]'::jsonb),
    'returns', coalesce((select jsonb_agg(to_jsonb(r) - 'staff_notes') from rmas r where lower(btrim(r.requester_email)) = (select v from e) or r.order_id in (select id from orders)), '[]'::jsonb),
    'warranty_claims', coalesce((select jsonb_agg(to_jsonb(w) - 'staff_notes') from warranty_claims w where lower(btrim(w.claimant_email)) = (select v from e)), '[]'::jsonb),
    'quote_requests', coalesce((select jsonb_agg(to_jsonb(q)) from quote_requests q where lower(btrim(q.email)) = (select v from e)), '[]'::jsonb),
    'contact_requests', coalesce((select jsonb_agg(to_jsonb(c)) from contact_requests c where lower(btrim(c.email)) = (select v from e)), '[]'::jsonb),
    'homeowner_requests', coalesce((select jsonb_agg(to_jsonb(h)) from homeowner_requests h where lower(btrim(h.email)) = (select v from e)), '[]'::jsonb),
    'dealer_applications', coalesce((select jsonb_agg(to_jsonb(d) - 'idempotency_key') from dealer_applications d where lower(btrim(d.email)) = (select v from e)), '[]'::jsonb),
    'saved_carts', coalesce((select jsonb_agg(to_jsonb(c) - 'unsubscribe_token') from cart_snapshots c where lower(btrim(c.email)) = (select v from e)), '[]'::jsonb),
    'stock_alerts', coalesce((select jsonb_agg(to_jsonb(s) - 'unsubscribe_token') from back_in_stock_subscriptions s where lower(btrim(s.email)) = (select v from e)), '[]'::jsonb),
    'category_alerts', coalesce((select jsonb_agg(to_jsonb(s) - 'unsubscribe_token') from category_stock_alerts s where lower(btrim(s.email)) = (select v from e)), '[]'::jsonb),
    'system_finder', coalesce((select jsonb_agg(to_jsonb(f)) from finder_sessions f where f.email = (select v from e)), '[]'::jsonb),
    'planning_emails', coalesce((select jsonb_agg(to_jsonb(p)) from planning_series p where p.email = (select v from e)), '[]'::jsonb),
    'marketing_consent', coalesce((select jsonb_agg(to_jsonb(m) - 'unsubscribe_token') from marketing_consents m where m.email = (select v from e)), '[]'::jsonb),
    'emails_sent', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'subject', m.subject, 'status', m.status, 'sent_at', m.sent_at)) from email_messages m where coalesce(m.normalized_email, lower(btrim(m.to_email))) = (select v from e)), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(to_jsonb(pr)) from product_reviews pr where pr.verified_order_id in (select id from orders)), '[]'::jsonb),
    'privacy_requests', coalesce((select jsonb_agg(to_jsonb(pq)) from privacy_requests pq where lower(btrim(pq.email)) = (select v from e)), '[]'::jsonb),
    'not_searchable', jsonb_build_array(
      'Chat transcripts are stored by browser session, not by email, so they cannot be matched to a person. They are deleted under the retention schedule.',
      'Site analytics events carry no email.'
    )
  );
$$;

revoke execute on function public.privacy_report(text) from public, anon, authenticated;
grant execute on function public.privacy_report(text) to service_role;
