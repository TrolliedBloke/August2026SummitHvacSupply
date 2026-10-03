-- 034: ad audience export log (docs/FINDER-AND-AUDIENCE-PLAN.md 6.2).
--
-- Every export of customer emails for upload to Meta or Google is recorded:
-- who, which segment, how many rows, and the privacy-notice version in force.
-- The export itself is built server-side from marketing_consents and is
-- refused unless ads are enabled and the segment clears the minimum size
-- (lib/backend/audiences.ts). Emails are never stored here.
--
-- Re-runnable.

create table if not exists audience_exports (
  id uuid primary key default gen_random_uuid(),
  segment text not null check (segment in ('contractor', 'homeowner_active', 'homeowner_researching', 'customer')),
  purpose text not null check (purpose in ('target', 'exclude')),
  row_count integer not null check (row_count >= 0),
  notice_version text not null,
  exported_by text not null,
  exported_at timestamptz not null default now()
);
alter table audience_exports enable row level security;
drop policy if exists "staff read audience exports" on audience_exports;
create policy "staff read audience exports" on audience_exports for select using (current_profile_role() = 'staff');
revoke all on audience_exports from anon;
revoke insert, update, delete, truncate, references, trigger on audience_exports from authenticated;
