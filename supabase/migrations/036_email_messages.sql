-- 036: one log of every email Summit sends (docs/PIPELINE-ARCHITECTURE-PLAN.md, Phase 1).
--
-- The customer view answers "what have we sent this person?". Until now that
-- was scattered across flags (cart_snapshots.emails_sent, sales_orders
-- confirmation_email_status, finder_sessions.shortlist_sent_at, ...) and
-- lifecycle_deliveries, which stores only a key. Every send path --
-- src/lib/backend/email.ts and the send-receipt, ar-statements and
-- low-stock-alert edge functions -- now writes one row here.
--
-- The body is not stored: subject, kind and the provider id are enough to find
-- the message in Resend, and the log does not become a second copy of every
-- customer email. Writes come only from the service role.
--
-- Re-runnable.

create table if not exists email_messages (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  -- Lower-cased, trimmed: the key the customer view groups by.
  normalized_email text generated always as (lower(btrim(to_email))) stored,
  kind text not null default 'transactional',
  subject text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_id text,
  error text,
  related_type text,
  related_id text,
  sent_at timestamptz not null default now()
);

create index if not exists email_messages_normalized_email_idx on email_messages (normalized_email, sent_at desc);
create index if not exists email_messages_related_idx on email_messages (related_type, related_id);

alter table email_messages enable row level security;
drop policy if exists "staff read email messages" on email_messages;
create policy "staff read email messages" on email_messages for select using (current_profile_role() = 'staff');
revoke all on email_messages from anon;
revoke insert, update, delete, truncate, references, trigger on email_messages from authenticated;
