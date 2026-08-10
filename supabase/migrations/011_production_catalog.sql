-- Production HVAC catalog. Kept separate from the intentional demo `skus`
-- table so existing operational examples and order history remain intact.
create table if not exists catalog_products (
  id text primary key,
  source_row integer not null unique,
  source_sku text not null,
  catalog_sku text not null unique,
  slug text not null unique,
  model_number text,
  name text not null,
  brand text not null,
  category text not null,
  product_type text not null,
  description text,
  btu integer,
  tonnage numeric(6,2),
  zones text,
  voltage text,
  refrigerant text,
  compatible_outdoor_sku text,
  bundle_name text,
  retail_price numeric(12,2),
  -- contractor_price deliberately does NOT live here. This table is published
  -- to anon by the "public read publishable catalog" policy below, and RLS is
  -- row level -- a readable row exposes every column -- so trade pricing stored
  -- here would be world-readable the moment it was populated. It lives in
  -- catalog_product_trade_pricing (migration 015), which no anon policy grants.
  --
  -- Removed from the column list rather than dropped in 015, so the ordering of
  -- 011 and 015 cannot matter: there is never a window where the column exists
  -- on a publicly readable table.
  inventory_quantity integer,
  inventory_status text not null default 'unknown'
    check (inventory_status in ('unknown', 'in_stock', 'low_stock', 'out_of_stock', 'lead_time')),
  image_url text,
  image_verified boolean not null default false,
  warranty jsonb,
  specifications jsonb not null default '{}'::jsonb,
  research_status text not null default 'csv_only'
    check (research_status in ('csv_only', 'in_progress', 'verified', 'conflict')),
  publication_status text not null default 'needs_review'
    check (publication_status in ('quote_only', 'needs_review', 'published', 'archived')),
  quote_eligible boolean not null default true,
  purchase_eligible boolean not null default false,
  notes text,
  issues jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (retail_price is null or retail_price > 0),
  check (inventory_quantity is null or inventory_quantity >= 0),
  check (purchase_eligible = false or (retail_price is not null and inventory_quantity is not null and inventory_status <> 'unknown'))
);

create table if not exists catalog_product_evidence (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references catalog_products(id) on delete cascade,
  field_name text not null,
  value jsonb,
  source_url text,
  source_type text not null,
  source_reference text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'conflict', 'rejected')),
  verified_at timestamptz,
  notes text,
  unique(product_id, field_name, source_reference)
);

-- Cost is deliberately isolated from the publicly readable product row.
create table if not exists catalog_product_costs (
  product_id text primary key references catalog_products(id) on delete cascade,
  unit_cost numeric(12,2),
  updated_at timestamptz not null default now(),
  check (unit_cost is null or unit_cost > 0)
);

-- Trade pricing, isolated for the same reason as cost. Created here rather than
-- in a later migration so there is no ordering in which catalog_products exists
-- while trade pricing has nowhere protected to live.
create table if not exists catalog_product_trade_pricing (
  product_id text primary key references catalog_products(id) on delete cascade,
  contractor_price numeric(12,2),
  price_tier text not null default 'standard',
  effective_from date not null default current_date,
  updated_at timestamptz not null default now(),
  check (contractor_price is null or contractor_price > 0)
);

create table if not exists catalog_product_media (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references catalog_products(id) on delete cascade,
  kind text not null check (kind in ('image', 'dimension_diagram', 'installed_image', 'packaging')),
  url text not null,
  alt_text text,
  source_url text not null,
  exact_model_verified boolean not null default false,
  sort_order integer not null default 0,
  unique(product_id, url)
);

create table if not exists catalog_product_documents (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references catalog_products(id) on delete cascade,
  kind text not null,
  title text not null,
  url text not null,
  source_url text not null,
  exact_model_verified boolean not null default false,
  unique(product_id, url)
);

create table if not exists catalog_product_relationships (
  id uuid primary key default gen_random_uuid(),
  from_product_id text not null references catalog_products(id) on delete cascade,
  to_product_id text not null references catalog_products(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('compatible', 'required', 'optional', 'replacement', 'bundle_component', 'ahri_match')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'conflict', 'rejected')),
  source_url text,
  notes text,
  unique(from_product_id, to_product_id, relationship_type)
);

create table if not exists catalog_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_sha256 text not null,
  source_rows integer not null,
  generated_records integer not null,
  collision_groups integer not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists catalog_products_search_idx on catalog_products using gin (
  to_tsvector('simple', coalesce(catalog_sku, '') || ' ' || coalesce(source_sku, '') || ' ' || coalesce(model_number, '') || ' ' || coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(product_type, ''))
);
create index if not exists catalog_products_category_idx on catalog_products(category, publication_status);

alter table catalog_products enable row level security;
alter table catalog_product_evidence enable row level security;
alter table catalog_product_costs enable row level security;
alter table catalog_product_trade_pricing enable row level security;
alter table catalog_product_media enable row level security;
alter table catalog_product_documents enable row level security;
alter table catalog_product_relationships enable row level security;
alter table catalog_import_runs enable row level security;

create policy "public read publishable catalog" on catalog_products for select
  using (publication_status in ('quote_only', 'published'));
create policy "public read verified media" on catalog_product_media for select using (exact_model_verified = true);
create policy "public read verified documents" on catalog_product_documents for select using (exact_model_verified = true);
create policy "public read verified relationships" on catalog_product_relationships for select using (verification_status = 'verified');

create policy "staff manage catalog products" on catalog_products for all using (current_profile_role() = 'staff') with check (current_profile_role() = 'staff');
create policy "staff manage catalog evidence" on catalog_product_evidence for all using (current_profile_role() = 'staff') with check (current_profile_role() = 'staff');
create policy "staff manage catalog costs" on catalog_product_costs for all using (current_profile_role() = 'staff') with check (current_profile_role() = 'staff');

-- Trade pricing: no anon policy at all, so unauthenticated callers get an empty
-- result rather than a filtered one. Trade roles read; only staff write.
create policy "trade reads trade pricing" on catalog_product_trade_pricing
  for select using (current_profile_role() in ('dealer', 'installer', 'staff'));
create policy "staff manages trade pricing" on catalog_product_trade_pricing
  for all using (current_profile_role() = 'staff')
  with check (current_profile_role() = 'staff');

-- Neither cost nor trade pricing is ever reachable through the public API.
revoke all on catalog_product_costs from anon, authenticated;
revoke all on catalog_product_trade_pricing from anon;
create policy "staff manage catalog media" on catalog_product_media for all using (current_profile_role() = 'staff') with check (current_profile_role() = 'staff');
create policy "staff manage catalog documents" on catalog_product_documents for all using (current_profile_role() = 'staff') with check (current_profile_role() = 'staff');
create policy "staff manage catalog relationships" on catalog_product_relationships for all using (current_profile_role() = 'staff') with check (current_profile_role() = 'staff');
create policy "staff read import runs" on catalog_import_runs for select using (current_profile_role() = 'staff');

grant all on catalog_products, catalog_product_evidence, catalog_product_costs, catalog_product_media,
  catalog_product_documents, catalog_product_relationships, catalog_import_runs to service_role;
