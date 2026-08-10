-- pg_net grants. APPLIED 2026-08-10; the function revokes were a NO-OP -- see below.
--
-- Accurate risk statement, having checked rather than assumed: pg_net's
-- functions live in the `net` schema, and PostgREST exposes only `public` and
-- `graphql_public` (supabase/config.toml). http_get/http_post are therefore NOT
-- reachable over the REST API by anon -- a probe returned PGRST202 "searched
-- for the function public.http_get", i.e. not found in the exposed schema,
-- which is a routing miss and not a permission check.
--
-- The extension is nonetheless registered in `public`
-- (pg_extension.extnamespace = public), which is what the advisor flags, and
-- EXECUTE on all of its functions is held by PUBLIC. That becomes real if `net`
-- is ever exposed through PostgREST, or if a SECURITY INVOKER function in
-- `public` calls net.http_post while running as the caller -- either gives
-- server-side request forgery from inside the database.
--
-- LIMITATION: these objects are owned by `supabase_admin`, and the migration
-- runs as `postgres`, which is not a superuser on Supabase. A REVOKE by a
-- non-owner is silently ignored, so the statements below changed nothing --
-- verified afterwards: has_function_privilege('anon','net.http_post','EXECUTE')
-- is still true. Withdrawing these grants requires supabase_admin, i.e. a
-- Supabase support request. Kept here so the intent is recorded and the
-- statements take effect on any database where the owner does match.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    join pg_extension e on e.oid = d.refobjid
    where e.extname = 'pg_net'
  loop
    begin
      execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    exception when insufficient_privilege then
      raise notice 'not owner of %, skipping', f.sig;
    end;
  end loop;
end $$;
