-- ============================================================================
-- 007_storefront_growth.sql
-- Lifecycle email (back-in-stock + abandoned cart), AI chat transcripts,
-- saved lists, and lightweight site analytics events.
-- Storefront SKUs live in application code (src/lib/products.ts), so sku ids
-- here are plain text — no FK to the wholesale `skus` table.
-- ============================================================================

-- Back-in-stock: one row per (email, sku) waiting on inventory.
create table if not exists back_in_stock_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  sku_id text not null,
  sku_code text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unsubscribed boolean not null default false,
  unsubscribe_token uuid not null default gen_random_uuid(),
  unique (email, sku_id)
);
create index if not exists bis_pending_idx
  on back_in_stock_subscriptions (sku_id) where notified_at is null and not unsubscribed;

-- Abandoned carts: captured at checkout email entry; cleared on order success.
create table if not exists cart_snapshots (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  items jsonb not null,
  subtotal numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  emails_sent int not null default 0,
  last_email_at timestamptz,
  completed_at timestamptz,
  unsubscribed boolean not null default false,
  unsubscribe_token uuid not null default gen_random_uuid()
);
create index if not exists cart_snapshots_due_idx
  on cart_snapshots (created_at) where completed_at is null and not unsubscribed;

-- AI chat transcripts: what buyers actually ask is free market research.
create table if not exists chat_transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_transcripts_session_idx on chat_transcripts (session_id, created_at);

-- Saved lists ("truck stock") for trade accounts.
create table if not exists saved_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  items jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_lists_user_idx on saved_lists (user_id);

-- Lightweight analytics events (never CVR alone).
create table if not exists site_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  page text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists site_events_name_idx on site_events (name, created_at);
