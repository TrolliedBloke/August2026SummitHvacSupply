-- ============================================================================
-- 009_review_ingestion.sql
-- Real, consented product reviews -- the replacement for the placeholder array
-- in src/lib/reviews.ts, which is demo scaffolding and is blocked in production.
--
-- Design notes:
--  * Nothing is publishable by default. A row must clear THREE independent
--    gates before it can be rendered: status='approved', consent_publish=true,
--    and verified_order_id is not null. The read path enforces all three, so an
--    approved-but-unconsented row still cannot leak.
--  * audience (homeowner/contractor/property_manager) exists so product pages
--    can filter proof to the reader's segment -- a contractor does not care
--    that a garage office is comfortable.
--  * sku_id and series_slug mirror the file registry's key strategy, but a
--    review attached to a SKU must NOT be inherited by unrelated SKUs in the
--    same series; the read path keys on sku_id first and only falls back to
--    series when the review was explicitly filed against the series.
--  * Contractors get company_name; homeowners deliberately do not, so we never
--    publish more identity than the reviewer agreed to.
-- ============================================================================

create table if not exists product_reviews (
  id uuid primary key default gen_random_uuid(),

  -- What is being reviewed. Exactly one of these should drive display.
  sku_id text,
  series_slug text,

  -- Who is speaking. author_name is the display name the reviewer consented to
  -- (e.g. "Marcus T."), never a full name we inferred.
  author_name text not null,
  author_role text,
  company_name text,
  city text,
  audience text not null default 'homeowner'
    check (audience in ('homeowner', 'contractor', 'property_manager')),

  -- The review itself.
  rating int not null check (rating between 1 and 5),
  title text,
  body text not null,

  -- Verification + consent. All three gates below must pass to publish.
  verified_order_id uuid references sales_orders(id) on delete set null,
  consent_publish boolean not null default false,
  consent_recorded_at timestamptz,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  moderated_by uuid,
  moderated_at timestamptz,

  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- A review must be attached to something.
  constraint product_reviews_target_present
    check (sku_id is not null or series_slug is not null)
);

create index if not exists product_reviews_sku_idx
  on product_reviews (sku_id) where status = 'approved';
create index if not exists product_reviews_series_idx
  on product_reviews (series_slug) where status = 'approved';
create index if not exists product_reviews_status_idx
  on product_reviews (status, submitted_at desc);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Public may read ONLY fully cleared reviews. Everything else is staff-only.
-- Writes travel through the service role in the submission route, so no anon
-- insert policy is granted here.
alter table product_reviews enable row level security;

drop policy if exists "public read published reviews" on product_reviews;
create policy "public read published reviews" on product_reviews for select
  using (
    status = 'approved'
    and consent_publish = true
    and verified_order_id is not null
  );

drop policy if exists "staff read all reviews" on product_reviews;
create policy "staff read all reviews" on product_reviews for select
  using (current_profile_role() = 'staff');

drop policy if exists "staff moderate reviews" on product_reviews;
create policy "staff moderate reviews" on product_reviews for all
  using (current_profile_role() = 'staff')
  with check (current_profile_role() = 'staff');

-- ── Published view: the only shape the storefront should read ─────────────
-- Encodes the three gates once so a caller cannot forget one. Also withholds
-- company_name for non-contractors, matching what each reviewer consented to.
create or replace view published_product_reviews as
  select
    id,
    sku_id,
    series_slug,
    author_name,
    author_role,
    case when audience = 'contractor' then company_name else null end as company_name,
    city,
    audience,
    rating,
    title,
    body,
    (verified_order_id is not null) as verified_purchase,
    submitted_at
  from product_reviews
  where status = 'approved'
    and consent_publish = true
    and verified_order_id is not null;
