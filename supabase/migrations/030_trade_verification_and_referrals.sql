-- 030: verified-pro tier and installer referrals (docs/FINDER-AND-AUDIENCE-PLAN.md 2.2-2.4).
--
-- Three questions this migration keeps apart:
--   * did staff check the contractor license?      -> license_verified_* on the application and account
--   * is an EPA 608 card on file?                  -> epa608_* (optional until Summit lists refrigerant)
--   * which verified installers take homeowner     -> accounts.accepts_homeowner_referrals + referral_zips,
--     introductions, and who was introduced?          and the referrals table
--
-- approve_dealer_application is replaced. Its live definition was read before
-- writing this (2026-10-01) and matched 026 exactly, so the only change below
-- is the new license gate and the copy of the verification onto the account.
--
-- Re-runnable: every statement is guarded.

-- License and EPA 608 verification on the application. -------------------------
alter table dealer_applications add column if not exists license_verified_at timestamptz;
alter table dealer_applications add column if not exists license_verified_by text;
alter table dealer_applications add column if not exists license_classification text;
alter table dealer_applications add column if not exists epa608_certification_type text;
alter table dealer_applications add column if not exists epa608_certificate_number text;
alter table dealer_applications add column if not exists epa608_sighted_at timestamptz;
alter table dealer_applications add column if not exists epa608_sighted_by text;
do $$ begin
  alter table dealer_applications add constraint dealer_applications_epa608_type_check
    check (epa608_certification_type is null or epa608_certification_type in ('type_i', 'type_ii', 'type_iii', 'universal'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table dealer_applications add constraint dealer_applications_license_class_check
    check (license_classification is null or license_classification ~ '^[A-Z]-?[0-9]{0,2}$');
exception when duplicate_object then null; end $$;

-- What the approved account carries, and the installer opt-in. -------------------
alter table accounts add column if not exists license_verified_at timestamptz;
alter table accounts add column if not exists license_classification text;
alter table accounts add column if not exists epa608_on_file boolean not null default false;
alter table accounts add column if not exists accepts_homeowner_referrals boolean not null default false;
alter table accounts add column if not exists referral_zips text[] not null default '{}';
alter table accounts add column if not exists referral_paused_at timestamptz;
-- A CHECK cannot hold a subquery, so the per-element test lives in a function.
create or replace function public.all_five_digit_zips(p_zips text[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(bool_and(z ~ '^[0-9]{5}$'), true) from unnest(p_zips) as z
$$;
do $$ begin
  alter table accounts add constraint accounts_referral_zips_check
    check (public.all_five_digit_zips(referral_zips));
exception when duplicate_object then null; end $$;
-- Only a license staff checked may take homeowner introductions.
do $$ begin
  alter table accounts add constraint accounts_referrals_need_license
    check (not accepts_homeowner_referrals or license_verified_at is not null);
exception when duplicate_object then null; end $$;
create index if not exists accounts_referral_zips_idx on accounts using gin (referral_zips) where accepts_homeowner_referrals;

-- Staff record the license check. Idempotent; audited as an application event.
create or replace function public.record_license_verification(
  p_application_id uuid, p_classification text, p_actor text
) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_app dealer_applications%rowtype; v_at timestamptz := now();
begin
  select * into v_app from dealer_applications where id = p_application_id for update;
  if v_app.id is null then raise exception 'application % not found', p_application_id; end if;
  if not coalesce(v_app.license_applicable, false) or v_app.license_number is null then
    raise exception 'application % has no license to verify', p_application_id using errcode = 'check_violation';
  end if;
  update dealer_applications
    set license_verified_at = v_at, license_verified_by = p_actor,
        license_classification = upper(btrim(p_classification)), updated_at = now()
    where id = p_application_id;
  if v_app.account_id is not null then
    update accounts set license_verified_at = v_at, license_classification = upper(btrim(p_classification))
      where id = v_app.account_id;
  end if;
  insert into dealer_application_events (application_id, from_status, to_status, reason_code, actor)
    values (p_application_id, v_app.status, v_app.status, 'license_verified', p_actor);
  return v_at;
end $$;

create or replace function public.record_epa608_sighting(
  p_application_id uuid, p_type text, p_number text, p_actor text
) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_app dealer_applications%rowtype; v_at timestamptz := now();
begin
  select * into v_app from dealer_applications where id = p_application_id for update;
  if v_app.id is null then raise exception 'application % not found', p_application_id; end if;
  update dealer_applications
    set epa608_certification_type = p_type, epa608_certificate_number = nullif(btrim(p_number), ''),
        epa608_sighted_at = v_at, epa608_sighted_by = p_actor, updated_at = now()
    where id = p_application_id;
  if v_app.account_id is not null then
    update accounts set epa608_on_file = true where id = v_app.account_id;
  end if;
  insert into dealer_application_events (application_id, from_status, to_status, reason_code, actor)
    values (p_application_id, v_app.status, v_app.status, 'epa608_sighted', p_actor);
  return v_at;
end $$;

-- Approval now refuses an unverified license. -----------------------------------
create or replace function public.approve_dealer_application(
  p_application_id uuid, p_price_tier text, p_actor text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_app dealer_applications%rowtype;
  v_account uuid;
  v_profile uuid;
begin
  select * into v_app from dealer_applications where id = p_application_id for update;
  if v_app.id is null then raise exception 'application % not found', p_application_id; end if;
  if v_app.status = 'approved' and v_app.account_id is not null then
    return v_app.account_id;  -- already approved: no second account, no second event
  end if;
  if not dealer_application_transition_allowed(v_app.status, 'approved') then
    raise exception 'application in status % cannot be approved', v_app.status using errcode = 'check_violation';
  end if;
  -- 030: a business that declared a license is approved only after staff
  -- checked it. Self-identification never reaches account pricing.
  if coalesce(v_app.license_applicable, false) and v_app.license_verified_at is null then
    raise exception 'license on application % has not been verified', p_application_id using errcode = 'check_violation';
  end if;

  select id into v_profile from user_profiles
    where id = v_app.user_id or lower(btrim(email)) = v_app.normalized_email
    order by (id = v_app.user_id) desc limit 1;

  if v_profile is null and v_app.user_id is not null then
    insert into user_profiles (id, role, name, email, account_id, access_status)
      values (v_app.user_id, 'homeowner', v_app.contact_name, v_app.email, null, 'active')
      on conflict (id) do nothing;
    select id into v_profile from user_profiles where id = v_app.user_id;
  end if;

  if v_profile is not null then
    select account_id into v_account from user_profiles where id = v_profile and account_id is not null;
  end if;
  if v_account is null then
    insert into accounts (type, name, status, price_tier, service_area, license_number,
                          license_verified_at, license_classification, epa608_on_file)
      values ('dealer', v_app.company, 'active', coalesce(p_price_tier, 'standard'), v_app.service_area, v_app.license_number,
              v_app.license_verified_at, v_app.license_classification, v_app.epa608_sighted_at is not null)
      returning id into v_account;
  else
    update accounts set status = 'active', price_tier = coalesce(p_price_tier, price_tier),
      license_verified_at = coalesce(v_app.license_verified_at, license_verified_at),
      license_classification = coalesce(v_app.license_classification, license_classification),
      epa608_on_file = epa608_on_file or v_app.epa608_sighted_at is not null
    where id = v_account;
  end if;

  if v_profile is not null then
    update user_profiles set role = 'dealer', account_id = v_account, access_status = 'active' where id = v_profile;
  end if;

  update dealer_applications
    set status = 'approved', account_id = v_account, user_id = coalesce(user_id, v_profile), updated_at = now()
    where id = p_application_id;
  insert into dealer_application_events (application_id, from_status, to_status, reason_code, actor)
    values (p_application_id, v_app.status, 'approved', 'approved', p_actor);
  return v_account;
end $$;

-- Referrals: one row per introduction of a homeowner request to an installer. ----
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  homeowner_request_id uuid not null references homeowner_requests(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  introduced_at timestamptz not null default now(),
  introduced_by text not null,
  outcome text not null default 'introduced'
    check (outcome in ('introduced', 'contacted', 'quoted', 'installed', 'declined', 'no_response')),
  outcome_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 1000),
  unique (homeowner_request_id, account_id)
);
create index if not exists referrals_account_idx on referrals (account_id, introduced_at);
alter table referrals enable row level security;
drop policy if exists "staff read referrals" on referrals;
create policy "staff read referrals" on referrals for select using (current_profile_role() = 'staff');
revoke all on referrals from anon;
revoke insert, update, delete, truncate, references, trigger on referrals from authenticated;

-- Introduce one installer. Checks the installer is eligible for THIS request
-- inside the transaction, so a stale admin screen cannot introduce a paused
-- account or one that does not cover the ZIP.
create or replace function public.introduce_installer(
  p_request_id uuid, p_account_id uuid, p_actor text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_request homeowner_requests%rowtype;
  v_account accounts%rowtype;
  v_referral uuid;
begin
  select * into v_request from homeowner_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'homeowner request % not found', p_request_id; end if;
  if not v_request.consent_to_contact then
    raise exception 'request % has no consent to share details', p_request_id using errcode = 'check_violation';
  end if;
  select * into v_account from accounts where id = p_account_id;
  if v_account.id is null or v_account.status <> 'active' or not v_account.accepts_homeowner_referrals
     or v_account.referral_paused_at is not null or v_account.license_verified_at is null
     or not (v_request.zip = any (v_account.referral_zips)) then
    raise exception 'account % cannot take this introduction', p_account_id using errcode = 'check_violation';
  end if;

  insert into referrals (homeowner_request_id, account_id, introduced_by)
    values (p_request_id, p_account_id, p_actor)
    on conflict (homeowner_request_id, account_id) do update set introduced_by = referrals.introduced_by
    returning id into v_referral;

  if v_request.status <> 'referred' then
    update homeowner_requests set status = 'referred', updated_at = now() where id = p_request_id;
    insert into homeowner_request_events (request_id, from_status, to_status, note, actor)
      values (p_request_id, v_request.status, 'referred', 'installer introduced', p_actor);
  end if;
  return v_referral;
end $$;

create or replace function public.record_referral_outcome(
  p_referral_id uuid, p_outcome text, p_notes text, p_actor text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update referrals set outcome = p_outcome, outcome_at = now(), notes = coalesce(nullif(btrim(p_notes), ''), notes)
    where id = p_referral_id;
  if not found then raise exception 'referral % not found', p_referral_id; end if;
end $$;

revoke all on function public.record_license_verification(uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_epa608_sighting(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.approve_dealer_application(uuid, text, text) from public, anon, authenticated;
revoke all on function public.introduce_installer(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.record_referral_outcome(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_license_verification(uuid, text, text) to service_role;
grant execute on function public.record_epa608_sighting(uuid, text, text, text) to service_role;
grant execute on function public.approve_dealer_application(uuid, text, text) to service_role;
grant execute on function public.introduce_installer(uuid, uuid, text) to service_role;
grant execute on function public.record_referral_outcome(uuid, text, text, text) to service_role;
