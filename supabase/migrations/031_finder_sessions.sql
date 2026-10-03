-- 031: system finder sessions (docs/FINDER-AND-AUDIENCE-PLAN.md 3.5).
--
-- One row per finder run. Answers are the structured choices the finder
-- offers -- no free text, no income, no health -- validated by zod before they
-- reach this table (lib/finder/questions.ts). An email is present only when
-- the visitor asked for their shortlist to be sent.
--
-- Default grants on a new table give anon SELECT and authenticated TRUNCATE
-- (see 029); both are revoked here up front. Writes go through the service role.
--
-- Re-runnable.

create table if not exists finder_sessions (
  id uuid primary key default gen_random_uuid(),
  path text not null check (path in ('homeowner', 'contractor')),
  answers jsonb not null default '{}'::jsonb,
  segment text check (segment in ('contractor', 'homeowner_active', 'homeowner_researching', 'customer')),
  tags text[] not null default '{}',
  result_skus text[] not null default '{}',
  completed_at timestamptz,
  email text check (email is null or email = lower(btrim(email))),
  shortlist_sent_at timestamptz,
  homeowner_request_id uuid references homeowner_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finder_sessions_email_idx on finder_sessions (email) where email is not null;
create index if not exists finder_sessions_completed_idx on finder_sessions (completed_at) where completed_at is not null;

alter table finder_sessions enable row level security;
drop policy if exists "staff read finder sessions" on finder_sessions;
create policy "staff read finder sessions" on finder_sessions for select using (current_profile_role() = 'staff');
revoke all on finder_sessions from anon;
revoke insert, update, delete, truncate, references, trigger on finder_sessions from authenticated;
