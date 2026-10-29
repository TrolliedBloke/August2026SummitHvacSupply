-- Read-only catalog assertions. Run after migrations 030–035 in a test database.
-- Raises an exception on missing schema, public write grants, missing RLS,
-- or executable operational RPCs; no fixtures or customer data are changed.
begin;
do $$
declare tbl text; proc regprocedure; role_name text;
begin
  foreach tbl in array array['referrals','finder_sessions','marketing_consents','planning_series','category_stock_alerts','audience_exports','lifecycle_deliveries'] loop
    if to_regclass('public.' || tbl) is null then raise exception 'missing table %', tbl; end if;
    if not (select relrowsecurity from pg_class where oid = to_regclass('public.' || tbl)) then raise exception 'RLS disabled: %', tbl; end if;
    if has_table_privilege('anon', 'public.' || tbl, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'anon has privileges: %', tbl; end if;
    if has_table_privilege('authenticated', 'public.' || tbl, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'authenticated can mutate: %', tbl; end if;
  end loop;
  foreach proc in array array[
    'public.record_license_verification(uuid,text,text)'::regprocedure,
    'public.record_epa608_sighting(uuid,text,text,text)'::regprocedure,
    'public.approve_dealer_application(uuid,text,text)'::regprocedure,
    'public.introduce_installer(uuid,uuid,text)'::regprocedure,
    'public.record_referral_outcome(uuid,text,text,text)'::regprocedure,
    'public.record_marketing_preference(text,text,text,boolean)'::regprocedure
  ] loop
    foreach role_name in array array['anon','authenticated'] loop
      if has_function_privilege(role_name, proc, 'EXECUTE') then raise exception '% can execute %', role_name, proc; end if;
    end loop;
    if not has_function_privilege('service_role', proc, 'EXECUTE') then raise exception 'service_role cannot execute %', proc; end if;
  end loop;
end $$;
rollback;
