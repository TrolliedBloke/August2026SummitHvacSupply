# Production catalog boundary and operating runbook

## Source of truth

- `data/catalog/inventory-source.csv` is the immutable import input copied from the supplied inventory sheet.
- `scripts/import-inventory-catalog.ts` is the only supported normalization path.
- `src/data/catalog.generated.json` supplies public catalog pages at build time.
- `data/catalog/reconciliation.generated.json` proves row coverage and collision handling.
- `data/catalog/research-ledger.generated.json` reports exact-model research status and missing evidence for every row.
- `data/catalog/research-overrides.json` contains reviewed manufacturer evidence. A field must not be added without an exact-model source.
- `data/catalog/exact-media.json` maps locally hosted manufacturer photography to exact catalog SKUs and records manufacturer provenance. The importer has no family-image fallback.
- `scripts/sync-production-catalog.ts` idempotently upserts generated records, server-only costs, evidence, and the import-run report after migration 011 is applied.

The legacy `src/lib/products.ts`, demo `skus` table, reviews, documents, portal inventory, seeded orders, and operational examples are intentional demonstrations. They are not imported into `catalog_products`, are removed from public discovery, and are never used as verified production product claims.

## Public order and request flow

```text
inventory CSV -> validated importer -> generated catalog -> search/category/product page -> shared cart
                                      |                    |                |
                                      |                    |                +-> priced items -> retail checkout
                                      |                    +-> unpriced items -> sales request
                                      +-> reconciliation + research ledger -> staff catalog dashboard
```

The storefront supports retail orders and sales requests. Products with a positive source sell price are directly purchasable; products without a published price can be sent to sales from the same cart. Inventory quantity remains `unknown` because the supplied source did not include dependable on-hand counts, but that internal data state is not exposed as customer-facing warning copy. Wholesale pricing and tools require an approved wholesale account.

## Import and database workflow

1. Replace `data/catalog/inventory-source.csv` only with an approved source export.
2. Run `npm run catalog:import`.
3. Review the reconciliation dashboard/report, especially all collision groups and inferred fields.
4. Add exact-model sources to `research-overrides.json`; rerun the importer.
5. Run `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`.
6. Apply Supabase migrations through `012_retail_accounts.sql` in the target environment.
7. With service-role credentials set, run `npm run catalog:sync` from an approved deployment/admin environment.
8. Verify `/api/health/catalog` and the staff-only `/admin/catalog` dashboard.

`catalog_product_costs` is isolated from the public product table and has no anonymous policy. Public RLS exposes only quote/published products and separately verified media, documents, and relationships.

## Promotion gates

A product can become directly purchasable when all of these are true:

- positive approved retail or account price;
- verified inventory or fulfillment that explicitly supports ordering without quantity tracking;
- approved sellable/publication state;
- defined fulfillment handling;
- no unresolved compatibility requirement;
- exact technical/document/image claims backed by evidence.

Server checkout canonicalizes every cart line and enforces price and publication state. Quantity-tracked products use FIFO reservations; products that are not quantity-tracked create a normal pending order without claiming immediate stock. Product sitemap inclusion is separately controlled by SEO readiness.

## Current honest status

- 100 source rows map to 100 unique generated records.
- 91 normalized source identifiers and nine collision groups are preserved as distinct variants pending human confirmation.
- 23 rows contain a positive source sell price; no `$0` price is published.
- Inventory quantity is unknown for all 100 records; the 23 positively priced records are purchase eligible and all 100 can be sent to sales.
- Exact manufacturer-backed imagery covers 20 records. The importer publishes no family-image fallback: the remaining 57 branded records and 23 unbranded accessories intentionally show a neutral photo-coming-soon state until exact evidence or warehouse photography is available.
- Retail customers may create an account and purchase priced items. Wholesale users must apply and receive staff approval before wholesale access is granted.
- No database sync or deployment is performed automatically by the importer.

## Operational ownership

- Catalog owner: approves row dispositions, price state, publication state, and collision resolution.
- Technical owner: runs migrations/import/sync, reviews health checks, and owns rollback.
- Sales/warehouse owner: verifies current inventory, fulfillment, and quote response.
- Product-research owner: records official exact-model evidence and conflicts.

Backups and rollback follow the Supabase project policy. Before a production sync, capture a database backup and retain the source CSV SHA-256 from the reconciliation report. Generated files are deterministic from the source plus reviewed overrides and can be rebuilt at any time.
