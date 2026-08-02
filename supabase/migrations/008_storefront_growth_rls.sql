-- ============================================================================
-- 008_storefront_growth_rls.sql
-- Row-level security for the five tables introduced in 007_storefront_growth.
-- 007 shipped without RLS while every other table in the schema has it; these
-- five hold customer PII (emails, chat bodies, cart contents, job lists), so
-- without RLS they are readable through PostgREST by anyone holding the anon
-- key -- which is public by design (NEXT_PUBLIC_SUPABASE_*, shipped to every
-- browser).
--
-- Design notes:
--  * Every read/write path for these tables is server-side through
--    createServiceRoleSupabaseClient() (src/lib/backend/{events,lists,chat}.ts).
--    The service role bypasses RLS, so enabling it here does not touch a single
--    working code path. No client component queries these tables directly.
--  * Because of that, the default posture is DENY: we add no anon policies at
--    all. Anonymous inserts (notify-me signups, analytics events, chat) already
--    travel through server routes that hold the service role. Adding an
--    anon-insert policy would widen the surface for no functional gain.
--  * saved_lists is the one table with a real owner column (user_id), so it
--    additionally gets an owner-scoped read for any future client-side use.
--  * Policies are dropped first so this migration is safely re-runnable.
-- ============================================================================

-- ── Enable RLS ──────────────────────────────────────────────────────────────
alter table back_in_stock_subscriptions enable row level security;
alter table cart_snapshots              enable row level security;
alter table chat_transcripts            enable row level security;
alter table saved_lists                 enable row level security;
alter table site_events                 enable row level security;

-- ── back_in_stock_subscriptions: email list. Staff read only. ───────────────
-- No anon select under any circumstance: this table is a harvestable list of
-- customer email addresses.
drop policy if exists "staff read back in stock" on back_in_stock_subscriptions;
create policy "staff read back in stock" on back_in_stock_subscriptions for select
  using (current_profile_role() = 'staff');

-- ── cart_snapshots: abandoned-cart contents keyed by email. Staff read. ─────
drop policy if exists "staff read cart snapshots" on cart_snapshots;
create policy "staff read cart snapshots" on cart_snapshots for select
  using (current_profile_role() = 'staff');

-- ── chat_transcripts: message bodies, may contain anything a user typed. ────
drop policy if exists "staff read chat transcripts" on chat_transcripts;
create policy "staff read chat transcripts" on chat_transcripts for select
  using (current_profile_role() = 'staff');

-- ── saved_lists: owner-scoped, plus staff for support. ─────────────────────
drop policy if exists "owner read saved lists" on saved_lists;
create policy "owner read saved lists" on saved_lists for select
  using (user_id = auth.uid());

drop policy if exists "owner write saved lists" on saved_lists;
create policy "owner write saved lists" on saved_lists for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "staff read saved lists" on saved_lists;
create policy "staff read saved lists" on saved_lists for select
  using (current_profile_role() = 'staff');

-- ── site_events: behavioural analytics. Staff read. ────────────────────────
drop policy if exists "staff read site events" on site_events;
create policy "staff read site events" on site_events for select
  using (current_profile_role() = 'staff');
