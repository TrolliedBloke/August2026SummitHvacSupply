-- 027: structured customer requests (design remediation 13, 16, 17).
--
-- Homeowner requests get their own typed table and lifecycle instead of a
-- newline-joined message in contact_requests. Contact and quote requests gain
-- structured context, a customer-facing reference, and a client request id
-- that makes retries idempotent. Re-runnable.

-- Homeowner requests ---------------------------------------------------------------
create table if not exists homeowner_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  client_request_id uuid unique,
  status text not null default 'received'
    check (status in ('received', 'needs_information', 'referred', 'closed')),
  queue text not null default 'homeowner_desk',
  zip text not null check (zip ~ '^[0-9]{5}$'),
  city text,
  home_type text not null,
  zones text not null,
  existing_ducts text not null,
  rebate_interest text not null check (rebate_interest in ('yes', 'no', 'unknown')),
  timeline text not null,
  name text not null,
  email text not null,
  phone text,
  consent_to_contact boolean not null,
  service_area text not null check (service_area in ('route', 'outside_route', 'unknown')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists homeowner_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references homeowner_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  actor text not null,
  created_at timestamptz not null default now()
);

alter table homeowner_requests enable row level security;
alter table homeowner_request_events enable row level security;
drop policy if exists "staff read homeowner requests" on homeowner_requests;
create policy "staff read homeowner requests" on homeowner_requests for select using (current_profile_role() = 'staff');
drop policy if exists "staff read homeowner request events" on homeowner_request_events;
create policy "staff read homeowner request events" on homeowner_request_events for select using (current_profile_role() = 'staff');
revoke insert, update, delete on homeowner_requests, homeowner_request_events from anon, authenticated;

-- Contact requests: routing and context --------------------------------------------
alter table contact_requests add column if not exists reference text;
alter table contact_requests add column if not exists queue text;
alter table contact_requests add column if not exists urgency text not null default 'standard';
alter table contact_requests add column if not exists sku text;
alter table contact_requests add column if not exists order_ref text;
alter table contact_requests add column if not exists branch_id text;
alter table contact_requests add column if not exists zip text;
alter table contact_requests add column if not exists source_url text;
alter table contact_requests add column if not exists client_request_id uuid;
create unique index if not exists contact_requests_client_request_id
  on contact_requests (client_request_id) where client_request_id is not null;
do $$ begin
  alter table contact_requests add constraint contact_requests_urgency_check check (urgency in ('standard', 'urgent'));
exception when duplicate_object then null; end $$;

-- Quote requests: typed draft and lifecycle -----------------------------------------
alter table quote_requests add column if not exists reference text;
alter table quote_requests add column if not exists client_request_id uuid;
alter table quote_requests add column if not exists project_type text;
alter table quote_requests add column if not exists zip text;
alter table quote_requests add column if not exists requested_date date;
alter table quote_requests add column if not exists lifecycle text not null default 'received';
create unique index if not exists quote_requests_client_request_id
  on quote_requests (client_request_id) where client_request_id is not null;
do $$ begin
  alter table quote_requests add constraint quote_requests_lifecycle_check
    check (lifecycle in ('received', 'needs_information', 'in_review', 'quoted', 'closed'));
exception when duplicate_object then null; end $$;

alter table quote_request_lines add column if not exists catalog_product_id text;
alter table quote_request_lines add column if not exists intent text;
alter table quote_request_lines add column if not exists validation text;
