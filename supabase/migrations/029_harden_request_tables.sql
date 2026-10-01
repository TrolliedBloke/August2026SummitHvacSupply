-- 029: tighten grants left by 026-028 (found by the post-apply check, 2026-10-01).
--
-- The new tables were created with the project's default grants: anon held
-- SELECT/REFERENCES/TRIGGER and authenticated held TRUNCATE. RLS already
-- limited reads to staff, but TRUNCATE is not governed by RLS, and anon never
-- needs these tables at all. Staff read them through the authenticated role
-- (the "staff read" policies), so authenticated keeps SELECT.
--
-- Also pins search_path on dealer_application_transition_allowed (advisor
-- 0011). It references no tables, so an empty search_path is safe.
--
-- Re-runnable.

revoke all on public.homeowner_requests, public.homeowner_request_events, public.dealer_application_events from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.homeowner_requests, public.homeowner_request_events, public.dealer_application_events
  from authenticated;

alter function public.dealer_application_transition_allowed(text, text) set search_path = '';
