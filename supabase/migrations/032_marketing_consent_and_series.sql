-- 032: marketing consent, the homeowner planning series, and contractor
-- category stock alerts (docs/FINDER-AND-AUDIENCE-PLAN.md 4.1-4.3, 5.2).
--
-- marketing_consents is the one record every marketing send and every ad
-- audience export reads. A transactional email (a receipt, a shortlist the
-- person asked for) does not need it. A row can exist with consented_at null:
-- that is a person who never opted in but did opt out of ad sharing, and the
-- opt-out must still be honored.
--
-- Re-runnable.

create table if not exists marketing_consents (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email))),
  channel text not null default 'email' check (channel in ('email')),
  source text not null check (source in ('finder', 'checkout', 'account', 'homeowner_request', 'staff', 'opt_out_form')),
  notice_version text not null,
  consented_at timestamptz,
  withdrawn_at timestamptz,
  ad_sharing_opt_out_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, channel)
);
alter table marketing_consents enable row level security;
drop policy if exists "staff read marketing consents" on marketing_consents;
create policy "staff read marketing consents" on marketing_consents for select using (current_profile_role() = 'staff');
revoke all on marketing_consents from anon;
revoke insert, update, delete, truncate, references, trigger on marketing_consents from authenticated;

-- Homeowner planning series: Day 0/1/3/7/14/30, one row per person. ------------
create table if not exists planning_series (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email))),
  finder_session_id uuid references finder_sessions(id) on delete set null,
  segment text not null check (segment in ('homeowner_active', 'homeowner_researching')),
  stage integer not null default 0 check (stage between 0 and 6),
  started_at timestamptz not null default now(),
  last_sent_at timestamptz,
  stopped_at timestamptz,
  stop_reason text check (stop_reason is null or stop_reason in ('completed', 'unsubscribed', 'requested_installer', 'ordered', 'consent_withdrawn')),
  created_at timestamptz not null default now()
);
create index if not exists planning_series_due_idx on planning_series (stage, started_at) where stopped_at is null;
alter table planning_series enable row level security;
drop policy if exists "staff read planning series" on planning_series;
create policy "staff read planning series" on planning_series for select using (current_profile_role() = 'staff');
revoke all on planning_series from anon;
revoke insert, update, delete, truncate, references, trigger on planning_series from authenticated;

-- Contractor alerts by category and capacity, not only by single SKU. ----------
create table if not exists category_stock_alerts (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email))),
  category text not null,
  btu integer check (btu is null or btu between 6000 and 240000),
  created_at timestamptz not null default now(),
  last_notified_at timestamptz,
  notified_skus text[] not null default '{}',
  unsubscribed boolean not null default false,
  unsubscribe_token uuid not null default gen_random_uuid() unique
);
create unique index if not exists category_stock_alerts_one_per_lane
  on category_stock_alerts (email, category, coalesce(btu, 0));
alter table category_stock_alerts enable row level security;
drop policy if exists "staff read category stock alerts" on category_stock_alerts;
create policy "staff read category stock alerts" on category_stock_alerts for select using (current_profile_role() = 'staff');
revoke all on category_stock_alerts from anon;
revoke insert, update, delete, truncate, references, trigger on category_stock_alerts from authenticated;

-- Post-purchase flows (plan Phase 7). -------------------------------------------
-- warranty_reminder_sent_at: day 7, transactional -- registration details for
--   equipment the customer bought, sent only when the warranty requires it.
-- maintenance_email_sent_at: day 45, marketing -- sent only with consent.
alter table sales_orders add column if not exists warranty_reminder_sent_at timestamptz;
alter table sales_orders add column if not exists maintenance_email_sent_at timestamptz;
