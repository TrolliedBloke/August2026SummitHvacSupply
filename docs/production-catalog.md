# Production catalog boundary and operating runbook

## Source of truth

- `data/catalog/inventory-source.csv` is the immutable import input copied from the supplied inventory sheet.
- `scripts/import-inventory-catalog.ts` is the only supported normalization path.
- `src/data/catalog.generated.json` supplies public catalog pages at build time.
- `data/catalog/reconciliation.generated.json` proves row coverage and collision handling.
- `data/catalog/research-ledger.generated.json` reports exact-model research status and missing evidence for every row.
- `data/catalog/research-overrides.json` contains reviewed manufacturer evidence. A field must not be added without an exact-model source.
- `data/catalog/media-families.json` maps locally hosted manufacturer photography to the applicable branded product families and records provenance.
- `scripts/sync-production-catalog.ts` idempotently upserts generated records, server-only costs, evidence, and the import-run report after migration 011 is applied.

The legacy `src/lib/products.ts`, demo `skus` table, reviews, documents, portal inventory, seeded orders, and operational examples are intentional demonstrations. They are not imported into `catalog_products`, are removed from public discovery, and are never used as verified production product claims.

## Public request flow

```text
inventory CSV -> validated importer -> generated catalog -> search/category/product page -> quote list -> quote request
                                      |                    |
                                      |                    +-> no checkout unless purchase_eligible
                                      +-> reconciliation + research ledger -> staff catalog dashboard
```

All current records are quote-only. Inventory is explicitly `unknown`; compatibility, warranty, documents, and exact images are unavailable until evidence is approved. Checkout rejects any record without approved price, inventory, and purchase eligibility.

## Import and database workflow

1. Replace `data/catalog/inventory-source.csv` only with an approved source export.
2. Run `npm run catalog:import`.
3. Review the reconciliation dashboard/report, especially all collision groups and inferred fields.
4. Add exact-model sources to `research-overrides.json`; rerun the importer.
5. Run `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`.
6. Apply Supabase migrations through `011_production_catalog.sql` in the target environment.
7. With service-role credentials set, run `npm run catalog:sync` from an approved deployment/admin environment.
8. Verify `/api/health/catalog` and the staff-only `/admin/catalog` dashboard.

`catalog_product_costs` is isolated from the public product table and has no anonymous policy. Public RLS exposes only quote/published products and separately verified media, documents, and relationships.

## Promotion gates

A product can become directly purchasable only when all of these are true:

- positive approved retail or account price;
- verified inventory or an explicitly supported backorder state;
- approved sellable/publication state;
- defined fulfillment handling;
- no unresolved compatibility requirement;
- exact technical/document/image claims backed by evidence.

The SQL constraint and server checkout validation both enforce the price/inventory portion of this gate. Product sitemap inclusion is separately controlled by SEO readiness.

## Current honest status

- 100 source rows map to 100 unique generated records.
- 91 normalized source identifiers and nine collision groups are preserved as distinct variants pending human confirmation.
- 23 rows contain a positive source sell price; no `$0` price is published.
- Inventory is unknown for all 100 records, so zero records are purchase eligible.
- Manufacturer-backed family imagery covers all 77 branded records and is labeled as family-level evidence. Exact-model imagery, documents, warranty, and compatibility remain unpublished until verified. The 23 unbranded accessories intentionally retain an unavailable-image state pending warehouse photography.
- No database sync or deployment is performed automatically by the importer.

## Operational ownership

- Catalog owner: approves row dispositions, price state, publication state, and collision resolution.
- Technical owner: runs migrations/import/sync, reviews health checks, and owns rollback.
- Sales/warehouse owner: verifies current inventory, fulfillment, and quote response.
- Product-research owner: records official exact-model evidence and conflicts.

Backups and rollback follow the Supabase project policy. Before a production sync, capture a database backup and retain the source CSV SHA-256 from the reconciliation report. Generated files are deterministic from the source plus reviewed overrides and can be rebuilt at any time.
