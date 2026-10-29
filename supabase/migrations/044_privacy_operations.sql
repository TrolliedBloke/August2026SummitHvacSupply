-- 044: privacy operations (docs/LIABILITY-REMEDIATION-PLAN.md, 6.1 and 6.3).
--
-- erase_personal_data: a verified deletion request, in one transaction.
-- Marketing and enquiry data about the person is deleted or anonymised.
-- Records the business may have to keep -- orders, invoices, returns,
-- warranty claims, dealer applications, the email send log -- are left as
-- they are until counsel answers C-7 on retention; the staff page says so in
-- the outcome it records. The email stays on marketing_consents as a
-- withdrawn row, so we never email the person again.
--
-- apply_retention: the scheduled clean-up, DRY RUN by default and not
-- scheduled. Counsel (C-7) sets the periods; the values below are the plan's
-- proposal. Schedule it only once they are approved.

create or replace function public.erase_personal_data(p_email text, p_request_id uuid, p_by text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e text := lower(btrim(p_email));
  n jsonb := '{}'::jsonb;
  c integer;
begin
  if e is null or e = '' or position('@' in e) = 0 then
    raise exception 'an email is required' using errcode = '22023';
  end if;
  if not exists (select 1 from privacy_requests where id = p_request_id and lower(btrim(email)) = e and kind = 'delete' and verified_at is not null) then
    raise exception 'no verified deletion request for this email' using errcode = 'P0001';
  end if;

  delete from cart_snapshots where lower(btrim(email)) = e; get diagnostics c = row_count; n := n || jsonb_build_object('cart_snapshots_deleted', c);
  delete from back_in_stock_subscriptions where lower(btrim(email)) = e; get diagnostics c = row_count; n := n || jsonb_build_object('stock_alerts_deleted', c);
  delete from category_stock_alerts where lower(btrim(email)) = e; get diagnostics c = row_count; n := n || jsonb_build_object('category_alerts_deleted', c);
  delete from planning_series where email = e; get diagnostics c = row_count; n := n || jsonb_build_object('planning_series_deleted', c);
  delete from finder_sessions where email = e; get diagnostics c = row_count; n := n || jsonb_build_object('finder_sessions_deleted', c);

  update marketing_consents
    set withdrawn_at = coalesce(withdrawn_at, now()), ad_sharing_opt_out_at = coalesce(ad_sharing_opt_out_at, now()), updated_at = now()
    where email = e;
  get diagnostics c = row_count; n := n || jsonb_build_object('consents_withdrawn_kept_for_suppression', c);

  update contact_requests
    set name = 'Deleted on request', email = 'deleted-' || id || '@invalid.invalid', message = '[deleted on request]', source_url = null, zip = null
    where lower(btrim(email)) = e;
  get diagnostics c = row_count; n := n || jsonb_build_object('contact_requests_anonymised', c);

  update quote_requests
    set name = 'Deleted on request', email = 'deleted-' || id || '@invalid.invalid', phone = null, need = '[deleted on request]'
    where lower(btrim(email)) = e;
  get diagnostics c = row_count; n := n || jsonb_build_object('quote_requests_anonymised', c);

  update homeowner_requests
    set name = 'Deleted on request', email = 'deleted-' || id || '@invalid.invalid', phone = null, notes = null, city = null
    where lower(btrim(email)) = e;
  get diagnostics c = row_count; n := n || jsonb_build_object('homeowner_requests_anonymised', c);

  insert into activity_log (event, entity_type, entity_id)
  values ('privacy_erasure:' || left(coalesce(p_by, 'staff'), 80), 'privacy_requests', p_request_id);

  return n;
end;
$$;

revoke execute on function public.erase_personal_data(text, uuid, text) from public, anon, authenticated;
grant execute on function public.erase_personal_data(text, uuid, text) to service_role;

create or replace function private.apply_retention(p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n jsonb := jsonb_build_object('dry_run', p_dry_run);
  c integer;
begin
  -- TODO(counsel C-7): confirm these periods before scheduling.
  if p_dry_run then
    select count(*) into c from chat_transcripts where created_at < now() - interval '90 days'; n := n || jsonb_build_object('chat_transcripts', c);
    select count(*) into c from cart_snapshots where completed_at is null and coalesce(updated_at, created_at) < now() - interval '90 days'; n := n || jsonb_build_object('abandoned_carts', c);
    select count(*) into c from finder_sessions where email is null and created_at < now() - interval '30 days'; n := n || jsonb_build_object('anonymous_finder_sessions', c);
    return n;
  end if;
  delete from chat_transcripts where created_at < now() - interval '90 days'; get diagnostics c = row_count; n := n || jsonb_build_object('chat_transcripts', c);
  delete from cart_snapshots where completed_at is null and coalesce(updated_at, created_at) < now() - interval '90 days'; get diagnostics c = row_count; n := n || jsonb_build_object('abandoned_carts', c);
  delete from finder_sessions where email is null and created_at < now() - interval '30 days'; get diagnostics c = row_count; n := n || jsonb_build_object('anonymous_finder_sessions', c);
  return n;
end;
$$;

revoke execute on function private.apply_retention(boolean) from public, anon, authenticated;
