-- Follow-up to 030–034, which the owner has already applied.
-- Atomic consent writes preserve an opt-out during concurrent opt-in requests.
create or replace function public.record_marketing_preference(
  p_email text, p_source text, p_notice_version text, p_opt_out boolean
) returns setof public.marketing_consents
language plpgsql security definer set search_path = public as $$
begin
  if p_opt_out then
    return query insert into marketing_consents(email, source, notice_version, ad_sharing_opt_out_at)
      values (lower(btrim(p_email)), p_source, p_notice_version, now())
      on conflict (email, channel) do update
        set ad_sharing_opt_out_at = now(), updated_at = now()
      returning *;
  else
    return query insert into marketing_consents(email, source, notice_version, consented_at)
      values (lower(btrim(p_email)), p_source, p_notice_version, now())
      on conflict (email, channel) do update
        set consented_at = now(), withdrawn_at = null, source = excluded.source,
            notice_version = excluded.notice_version, updated_at = now()
      returning *;
  end if;
end $$;
revoke all on function public.record_marketing_preference(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.record_marketing_preference(text, text, text, boolean) to service_role;

-- Durable claims give new lifecycle messages one delivery attempt per key.
-- Uncertain/crashed attempts remain claimed for staff review, rather than
-- retrying indefinitely after the provider's idempotency window expires.
create table if not exists lifecycle_deliveries (
  delivery_key text primary key,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz
);
alter table lifecycle_deliveries enable row level security;
drop policy if exists "staff read lifecycle deliveries" on lifecycle_deliveries;
create policy "staff read lifecycle deliveries" on lifecycle_deliveries
  for select using (current_profile_role() = 'staff');
revoke all on lifecycle_deliveries from anon;
revoke insert, update, delete, truncate, references, trigger on lifecycle_deliveries from authenticated;
grant all on lifecycle_deliveries to service_role;

-- Audit outcome changes and serialize introductions with installer opt-out.
alter table referrals add column if not exists outcome_by text;
create or replace function public.record_referral_outcome(
  p_referral_id uuid, p_outcome text, p_notes text, p_actor text
) returns void language plpgsql security definer set search_path = public as $$
begin
  update referrals set outcome = p_outcome, outcome_at = now(), outcome_by = p_actor,
    notes = nullif(btrim(p_notes), '') where id = p_referral_id;
  if not found then raise exception 'referral % not found', p_referral_id; end if;
end $$;
revoke all on function public.record_referral_outcome(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_referral_outcome(uuid, text, text, text) to service_role;

-- A newly supplied list cannot contain null elements masquerading as ZIPs.
create or replace function public.all_five_digit_zips(p_zips text[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(bool_and(z is not null and z ~ '^[0-9]{5}$'), true) from unnest(p_zips) as z
$$;

-- Paid orders update the persistent segment as well as report-time audiences.
create or replace function public.finder_order_paid()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.paid and new.buyer_email is not null then
    update finder_sessions set segment = 'customer', updated_at = now()
      where email = lower(btrim(new.buyer_email));
    update planning_series set stopped_at = now(), stop_reason = 'ordered'
      where email = lower(btrim(new.buyer_email)) and stopped_at is null;
  end if;
  return new;
end $$;
revoke all on function public.finder_order_paid() from public, anon, authenticated;
drop trigger if exists finder_order_paid on sales_orders;
create trigger finder_order_paid after insert or update of paid, buyer_email on sales_orders
  for each row execute function public.finder_order_paid();

create or replace function public.introduce_installer(
  p_request_id uuid, p_account_id uuid, p_actor text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_request homeowner_requests%rowtype;
  v_account accounts%rowtype;
  v_referral uuid;
begin
  select * into v_request from homeowner_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'homeowner request not found'; end if;
  select id into v_referral from referrals where homeowner_request_id = p_request_id and account_id = p_account_id;
  if v_referral is not null then return v_referral; end if;
  if v_request.status not in ('received', 'needs_information') or not v_request.consent_to_contact then
    raise exception 'request is not open for an introduction' using errcode = 'check_violation';
  end if;
  select * into v_account from accounts where id = p_account_id for update;
  if v_account.id is null or v_account.type <> 'dealer' or v_account.status <> 'active'
    or not v_account.accepts_homeowner_referrals or v_account.referral_paused_at is not null
    or v_account.license_verified_at is null or not (v_request.zip = any(v_account.referral_zips)) then
    raise exception 'installer no longer available for this request' using errcode = 'check_violation';
  end if;
  insert into referrals(homeowner_request_id, account_id, introduced_by)
    values(p_request_id, p_account_id, p_actor) returning id into v_referral;
  update homeowner_requests set status = 'referred', updated_at = now() where id = p_request_id;
  insert into homeowner_request_events(request_id, from_status, to_status, note, actor)
    values(p_request_id, v_request.status, 'referred', 'installer introduced', p_actor);
  return v_referral;
end $$;
revoke all on function public.introduce_installer(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.introduce_installer(uuid, uuid, text) to service_role;
