-- 046: rate limits shared across server instances (docs/LIABILITY-REMEDIATION-PLAN.md, 5.1).
--
-- The in-process limiter (src/lib/backend/rate-limit.ts) counts per server
-- instance, so on serverless hosting its real limit is (limit x instances).
-- For the AI chat, where every call costs money, the count lives here: one
-- row per key per fixed window, taken atomically. The chat route also uses a
-- global daily key as a spend cap.

create table if not exists public.api_rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

alter table public.api_rate_limits enable row level security;
-- No policies: only the service role (which bypasses RLS) reads or writes it.

create index if not exists api_rate_limits_window_idx on public.api_rate_limits (window_start);

-- True when this call is within the limit. The window is fixed and aligned to
-- the epoch, so every instance agrees on it.
create or replace function public.take_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into api_rate_limits as r (key, window_start, count)
  values (left(p_key, 200), v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning count into v_count;
  -- Old windows are cleared opportunistically, so the table stays small.
  if random() < 0.01 then
    delete from api_rate_limits where window_start < now() - interval '2 days';
  end if;
  return v_count <= p_limit;
end;
$$;

revoke execute on function public.take_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_rate_limit(text, integer, integer) to service_role;
