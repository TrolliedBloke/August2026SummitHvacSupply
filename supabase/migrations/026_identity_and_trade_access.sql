-- 026: identity, trade applications, and access state (design remediation 14, 18, 21).
--
-- Separates three questions that used to blur together:
--   * who the person is            -> auth.users + user_profiles (one per normalized email)
--   * what they applied for        -> dealer_applications, with an explicit state machine
--   * what they may access         -> user_profiles.access_status + accounts.status
--
-- Approval is one idempotent transaction (approve_dealer_application) that
-- creates or links the business account, sets the profile role and price
-- tier, and writes an audit event. Running it twice changes nothing.
--
-- Re-runnable: every statement is guarded.

-- Access state, separate from authentication. ---------------------------------
alter table user_profiles add column if not exists access_status text not null default 'active';
do $$ begin
  alter table user_profiles add constraint user_profiles_access_status_check
    check (access_status in ('active', 'suspended', 'disabled'));
exception when duplicate_object then null; end $$;

-- One canonical identity per normalized email.
create unique index if not exists user_profiles_email_normalized_key
  on user_profiles (lower(btrim(email)));

-- Dealer application lifecycle. -----------------------------------------------
alter table dealer_applications add column if not exists normalized_email text
  generated always as (lower(btrim(email))) stored;
alter table dealer_applications add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table dealer_applications add column if not exists account_id uuid references accounts(id) on delete set null;
alter table dealer_applications add column if not exists entity_type text;
alter table dealer_applications add column if not exists tax_id_last4 text;
alter table dealer_applications add column if not exists license_applicable boolean;
alter table dealer_applications add column if not exists license_state text;
alter table dealer_applications add column if not exists resale_certificate_number text;
alter table dealer_applications add column if not exists resale_certificate_state text;
alter table dealer_applications add column if not exists idempotency_key uuid;
alter table dealer_applications add column if not exists status_reason text;
alter table dealer_applications add column if not exists reference text;
alter table dealer_applications add column if not exists updated_at timestamptz not null default now();

-- Legacy rows used 'pending_review'; that is now 'submitted'.
update dealer_applications set status = 'submitted' where status = 'pending_review';
alter table dealer_applications alter column status set default 'submitted';
do $$ begin
  alter table dealer_applications add constraint dealer_applications_status_check
    check (status in ('draft', 'submitted', 'needs_information', 'under_review', 'approved', 'rejected', 'withdrawn'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table dealer_applications add constraint dealer_applications_entity_type_check
    check (entity_type is null or entity_type in ('sole_proprietor', 'partnership', 'llc', 'corporation', 'nonprofit', 'government'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table dealer_applications add constraint dealer_applications_tax_last4_check
    check (tax_id_last4 is null or tax_id_last4 ~ '^[0-9]{4}$');
exception when duplicate_object then null; end $$;

-- A retry with the same key is the same application.
create unique index if not exists dealer_applications_idempotency_key
  on dealer_applications (idempotency_key) where idempotency_key is not null;
-- One open application per person: a second submission routes to recovery.
create unique index if not exists dealer_applications_one_open_per_email
  on dealer_applications (normalized_email)
  where status in ('submitted', 'needs_information', 'under_review');

create table if not exists dealer_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references dealer_applications(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason_code text,
  actor text not null,
  created_at timestamptz not null default now()
);
alter table dealer_application_events enable row level security;
drop policy if exists "staff read dealer application events" on dealer_application_events;
create policy "staff read dealer application events" on dealer_application_events
  for select using (current_profile_role() = 'staff');
revoke insert, update, delete on dealer_application_events from anon, authenticated;

-- A person may apply before creating their sign-in. When that auth identity is
-- created later, link the newest application by normalized email and project
-- an already-approved account immediately. This replaces migration 012's
-- retail-only trigger without letting client metadata choose a wholesale role.
create or replace function public.handle_new_retail_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_application dealer_applications%rowtype;
  v_role app_role := 'homeowner';
  v_account uuid := null;
begin
  select * into v_application
  from dealer_applications
  where normalized_email = lower(btrim(new.email))
  order by created_at desc
  limit 1;

  if v_application.status = 'approved' and v_application.account_id is not null then
    v_role := 'dealer';
    v_account := v_application.account_id;
  end if;

  insert into public.user_profiles (id, role, name, email, account_id, access_status)
  values (
    new.id,
    v_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), nullif(v_application.contact_name, ''), split_part(new.email, '@', 1)),
    new.email,
    v_account,
    'active'
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(nullif(user_profiles.name, ''), excluded.name),
    role = case when v_role = 'dealer' then v_role else user_profiles.role end,
    account_id = coalesce(v_account, user_profiles.account_id);

  if v_application.id is not null then
    update dealer_applications set user_id = new.id, updated_at = now() where id = v_application.id;
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_retail_user() from public, anon, authenticated;

-- Permitted transitions. Anything else raises. ----------------------------------
create or replace function public.dealer_application_transition_allowed(p_from text, p_to text)
returns boolean language sql immutable as $$
  select (p_from, p_to) in (
    ('draft', 'submitted'), ('draft', 'withdrawn'),
    ('submitted', 'under_review'), ('submitted', 'needs_information'), ('submitted', 'withdrawn'),
    ('submitted', 'rejected'), ('submitted', 'approved'),
    ('needs_information', 'submitted'), ('needs_information', 'under_review'), ('needs_information', 'withdrawn'),
    ('needs_information', 'rejected'),
    ('under_review', 'approved'), ('under_review', 'rejected'), ('under_review', 'needs_information'),
    ('rejected', 'submitted'), ('withdrawn', 'submitted')
  );
$$;
revoke all on function public.dealer_application_transition_allowed(text, text) from public, anon, authenticated;

create or replace function public.transition_dealer_application(
  p_application_id uuid, p_to text, p_reason text, p_actor text
) returns text
language plpgsql security definer set search_path = public as $$
declare v_from text;
begin
  select status into v_from from dealer_applications where id = p_application_id for update;
  if v_from is null then raise exception 'application % not found', p_application_id; end if;
  if v_from = p_to then return v_from; end if;  -- idempotent
  if not dealer_application_transition_allowed(v_from, p_to) then
    raise exception 'transition % -> % is not allowed', v_from, p_to using errcode = 'check_violation';
  end if;
  update dealer_applications set status = p_to, status_reason = p_reason, updated_at = now() where id = p_application_id;
  insert into dealer_application_events (application_id, from_status, to_status, reason_code, actor)
    values (p_application_id, v_from, p_to, p_reason, p_actor);
  return p_to;
end $$;

-- Approval: one transaction, idempotent. ------------------------------------------
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

  -- Link the existing person by user id, else by normalized email.
  select id into v_profile from user_profiles
    where id = v_app.user_id or lower(btrim(email)) = v_app.normalized_email
    order by (id = v_app.user_id) desc limit 1;

  -- A damaged/legacy identity can have an auth user but no profile. Repair it
  -- inside the approval transaction so the approved account is never orphaned.
  if v_profile is null and v_app.user_id is not null then
    insert into user_profiles (id, role, name, email, account_id, access_status)
      values (v_app.user_id, 'homeowner', v_app.contact_name, v_app.email, null, 'active')
      on conflict (id) do nothing;
    select id into v_profile from user_profiles where id = v_app.user_id;
  end if;

  -- Reuse the person's business account if one exists; otherwise create it.
  if v_profile is not null then
    select account_id into v_account from user_profiles where id = v_profile and account_id is not null;
  end if;
  if v_account is null then
    insert into accounts (type, name, status, price_tier, service_area, license_number)
      values ('dealer', v_app.company, 'active', coalesce(p_price_tier, 'standard'), v_app.service_area, v_app.license_number)
      returning id into v_account;
  else
    update accounts set status = 'active', price_tier = coalesce(p_price_tier, price_tier) where id = v_account;
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

revoke all on function public.transition_dealer_application(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.approve_dealer_application(uuid, text, text) from public, anon, authenticated;
grant execute on function public.transition_dealer_application(uuid, text, text, text) to service_role;
grant execute on function public.approve_dealer_application(uuid, text, text) to service_role;
