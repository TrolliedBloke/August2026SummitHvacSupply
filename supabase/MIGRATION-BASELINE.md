# Migration baseline — read before running `supabase db push`

Status as of 2026-08-10, project `cswrezdcwdqnhwplmddr` (named "crm").

## What was wrong

`supabase_migrations.schema_migrations` was **empty** while the database was
fully populated. Migrations 001–004 had been applied by hand, so the repository
had no record of what production actually contained. Nothing could reproduce
production, and nothing could tell you what a fresh `db push` would do.

That is the reason a hand-patched database is not production-ready even when it
works: the security controls exist only as one-off statements someone
remembered to run.

## Live state, verified

| Migration | Applied? | Evidence |
|---|---|---|
| 001 wholesale_demo | **yes** (by hand) | `accounts`, `skus`, `order_lines`, `user_profiles` exist |
| 002 operations | **yes** (by hand) | `assert_staff`, `apply_payment`, `low_stock_skus` exist |
| 003 ledger | **yes** (by hand) | `journal_entries`, `post_journal`, `trial_balance` exist |
| 004 cron | **yes** (by hand) | schema `private` exists |
| 005 contact_requests | no | `contact_requests` absent |
| 006 fulfillment | no | `delivery_zones`, `order_payments`, `reserve_public_order` absent |
| 007 storefront_growth | no | `cart_snapshots`, `back_in_stock_subscriptions`, `saved_lists` absent |
| 008 storefront_growth_rls | no | depends on 007 |
| 009 review_ingestion | no | `product_reviews` absent |
| 010 checkout_integrity | no | `release_checkout_order` absent; `sales_orders.checkout_state` absent |
| 011 production_catalog | no | `catalog_products` absent |
| 012 retail_accounts | no | depends on 011 |
| 013 restrict_internal_reads | **yes** (2026-08-10) | `inventory_lots`/`bins` return `[]` to anon |
| 014 order_line_product_identity | no | `order_lines.catalog_product_id` absent |
| 015 protect_trade_pricing | **yes** (2026-08-10) | anon gets 401 on `skus.cost` |
| 016 lock_operational_rpc | **yes** (2026-08-10) | anon gets 401 on `rpc/apply_payment` |
| 017 revoke_anon_dml | **yes** (2026-08-10) | anon gets 401 on PATCH/DELETE |

The applied versions are now recorded in `schema_migrations`, so history matches
reality and `db push` will neither re-run them nor think they are pending.

## Why 001–004 must never be re-run

`001_wholesale_demo.sql` uses bare `create table accounts (...)` with no
`if not exists`. Running it against the live database fails immediately. They
are recorded as applied rather than made idempotent, because rewriting a
migration that has already run everywhere is worse than recording the truth.

## The security migrations are order-independent

013 and 015–017 only touch objects created in 001–003, so they hold regardless
of when 005–012 are applied. Two hazards were removed to guarantee that:

- **011 no longer defines `contractor_price` on `catalog_products`.** It was
  previously created there and dropped by 015. If 011 ran *after* 015 the drop
  would already have happened and trade pricing would sit on a table that anon
  can read. The column simply does not exist now, and
  `catalog_product_trade_pricing` is created in 011 alongside it.
- **015 no longer depends on `catalog_products` existing.** It is purely the
  `skus` / `purchase_order_lines` privilege fix, which is what is actually live.

## Applying the pending migrations

005–012 and 014 are real pending features (checkout integrity, cart snapshots,
delivery zones, the production catalog). They have **not** been applied, which
is why abandoned-cart capture, back-in-stock and the production catalog do not
work against this database.

Do not push them blind. Recommended sequence:

1. `supabase db branch create` (or a throwaway project) and push the full set
   there first, to prove 001→017 produces a working schema from empty.
2. Run `npm run test:security` against that branch. It must pass with the same
   19 assertions.
3. Only then apply 005–012 and 014 to the live project, in order.

## Two Postgres traps that made silent no-ops

Both were hit here; both migrations reported success while changing nothing.

1. **Column-level `REVOKE` is inert while the role holds table-level `SELECT`.**
   Postgres checks the table grant first. Revoke the table grant, then grant
   back the safe columns.
2. **`EXECUTE` defaults to `PUBLIC` on function creation.** The ACL shows
   `=X/postgres`; the bare `=` *is* PUBLIC. Revoking from `anon` by name removes
   a grant that was never there.

The only reliable check is to re-test as `anon` over HTTP afterwards, which is
what `tests/security.live.test.ts` does.
