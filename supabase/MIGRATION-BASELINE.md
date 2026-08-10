# Migration baseline — read before running `supabase db push`

Status as of 2026-08-10, project `cswrezdcwdqnhwplmddr` (named "crm").

## What was wrong

`supabase_migrations.schema_migrations` was **empty** while the database was
fully populated. Migrations 001–004 had been applied by hand and the repository
had no record of what production contained. The live database then sat at ~005
while the application expected 014/017 — which is why cart snapshots, delivery
zones, back-in-stock and the entire production catalog silently did not work.

That is why a hand-patched database is not production-ready even when it looks
fine: the security controls exist only as statements someone remembered to run.

## Current state — all applied

| Migration | Applied | Notes |
|---|---|---|
| 001 wholesale_demo | yes (by hand, pre-tracking) | recorded retroactively |
| 002 operations | yes (by hand) | recorded retroactively |
| 003 ledger | yes (by hand) | recorded retroactively |
| 004 cron | yes (by hand) | recorded retroactively |
| 005 contact_requests | **2026-08-10** | anon INSERT policy deliberately omitted |
| 006 fulfillment | **2026-08-10** | + PUBLIC revoke the original lacked |
| 007+008 storefront growth | **2026-08-10** | applied as ONE unit, see below |
| 009 review_ingestion | **2026-08-10** | view forced to `security_invoker` |
| 010 checkout_integrity | **2026-08-10** | + PUBLIC revoke |
| 011 production_catalog | **2026-08-10** | trade pricing table created here |
| 012 retail_accounts | **2026-08-10** | signup trigger; role is never client-set |
| 013 restrict_internal_reads | 2026-08-10 | |
| 014 order_line_product_identity | **2026-08-10** | the 22P02 fix |
| 015 protect_trade_pricing | 2026-08-10 | |
| 016 lock_operational_rpc | 2026-08-10 | |
| 017 revoke_anon_dml | 2026-08-10 | |
| 018 default_privileges | **2026-08-10** | the root-cause fix |
| 019 restrict_pg_net | applied, **no-op** | not owner; see below |

### 007 and 008 must stay together

007 creates five tables holding customer PII (emails, cart contents, chat
bodies, saved lists) and shipped without RLS; 008 adds it. Applying them as
separate steps leaves a window in which those tables are readable through
PostgREST with the public anon key. They were applied as a single unit.

### Why 001–004 must never be re-run

`001_wholesale_demo.sql` uses bare `create table accounts (...)` with no
`if not exists`, so replaying it against the live database fails immediately.
They are recorded as applied rather than made idempotent.

## The three privilege traps

Each of these reported success while changing nothing. The only reliable check
is to re-test as `anon` over HTTP afterwards — which is what
`tests/security.live.test.ts` does (38 assertions).

1. **A column-level `REVOKE` is inert while the role holds table-level
   `SELECT`.** Postgres checks the table grant first. Revoking
   `(cost, dealer_price)` from anon changed nothing; the values kept being
   served. Fix: withdraw the table grant, then grant back the safe columns.
2. **`EXECUTE` defaults to `PUBLIC` on function creation.** The ACL reads
   `=X/postgres`; that bare `=` *is* PUBLIC. Revoking from `anon` by name
   removes a grant that was never there.
3. **Supabase's `ALTER DEFAULT PRIVILEGES` grants anon EXECUTE on every new
   function and ALL on every new table in `public`.** This is the one that
   matters most: it made every migration a chance to reopen a closed hole.
   Applying 006/010/012/014 re-exposed `mark_order_paid` to anon despite each
   migration revoking from PUBLIC. Migration 018 changes the default, so new
   objects are not auto-granted to anon.

**Any future migration that creates a function or table should still be
followed by `npm run test:security`.** 018 removes the default grant, but a
migration can always add an explicit one.

## Clean-database reproducibility — UNVERIFIED

Not proven. Verifying it needs an isolated database; a Supabase branch is a
paid resource and was declined, and there is no local Postgres, Docker or
Supabase CLI auth on this machine.

What *is* true: migrations 001→019 are ordered, the two known ordering hazards
were removed (contractor_price is never created on a publicly readable table,
and `catalog_product_trade_pricing` is created in 011 beside `catalog_products`
rather than in a later migration), and every applied migration is idempotent or
guarded. So a clean run is expected to reproduce production.

It has **not been measured**. Before trusting it:

1. Create a branch or throwaway project.
2. `supabase db push` 001→019 from empty.
3. Run `npm run test:security` against it — all 38 must pass.
4. Diff `pg_policy`, `information_schema.role_table_grants` and
   `has_function_privilege(...)` for anon/authenticated against production.

## Not fixable from here

- **pg_net grants.** Its functions are owned by `supabase_admin`; migrations run
  as `postgres`, which is not a superuser on Supabase, and a non-owner `REVOKE`
  is silently ignored — verified: `has_function_privilege('anon',
  'net.http_post', 'EXECUTE')` is still true. Needs Supabase support. Actual
  exposure today is nil: PostgREST exposes only `public` and `graphql_public`,
  and pg_net's functions live in `net`.
- **Leaked-password protection.** No auth-config endpoint in the Supabase MCP.
  Dashboard → Authentication → Policies.
