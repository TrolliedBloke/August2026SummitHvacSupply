# Production release checklist

Release scope: public retail catalog with an approved-account wholesale path. Product identity is synchronized from the supplied inventory CSV; on-hand quantities are intentionally not imported or claimed.

## Catalog integrity

- [x] `data/catalog/inventory-source.csv` is the sole product-list import source.
- [x] 100 source rows produce 100 unique public catalog records.
- [x] Duplicate source identifiers remain separate, traceable variants.
- [x] Spreadsheet formulas, `$0` prices, invalid model prose, and acquisition cost are excluded from public data.
- [x] Carrier `26SCA5` products are categorized as air conditioners, not heat pumps.
- [x] The 23 positively priced records can be purchased; all 100 records can be sent to sales.
- [x] Checkout canonicalizes items server-side and rejects unpublished or unpriced purchase lines.

## Product media

- [x] Exactly 20 records have locally hosted, manufacturer-published media mapped by catalog SKU.
- [x] Multiple manufacturer views are used where the exact product page supplies them.
- [x] The broad family-image fallback was removed; no unrelated component image is reused merely because brand and category match.
- [x] No generated product render is presented as an actual item.
- [x] The 23 unbranded accessories retain an honest unavailable-image state pending Summit warehouse photography.
- [x] Every published media file exists locally and is tested during CI.
- [ ] Photograph the exact unbranded accessories and packaging in Summit's warehouse.
- [ ] Continue exact-model research for the 57 branded records that still have no publishable exact image.

## Application and security

- [x] Quote payloads are canonicalized against the server catalog.
- [x] Direct payment is available only for the 23 records with a positive, server-approved retail price.
- [x] Retail account creation is public; wholesale access remains staff-approved.
- [x] Payment confirmation requires signed, server-authoritative state.
- [x] Acquisition cost is isolated in `data/catalog/costs.generated.json` and is absent from browser-reachable JSON.
- [x] Catalog database tables, RLS policies, evidence, media, cost isolation, and import-run tracking are defined.
- [x] Catalog health and staff reconciliation screens exist.
- [x] Product pages publish honest media states and do not expose internal inventory-reconciliation language.

## Automated release gates

- [x] `npm run catalog:import`
- [x] `npm test`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run test:e2e`
- [x] `git diff --check`
- [x] Desktop, tablet, and mobile catalog layouts have no horizontal overflow.

## Environment and operations

- [ ] Apply Supabase migrations through `012_retail_accounts.sql` to the production project.
- [ ] Capture a production database backup before the first catalog sync.
- [ ] Run `npm run catalog:sync` with production service-role credentials from an approved admin environment.
- [ ] Verify `/api/health/catalog` after deployment.
- [ ] Confirm production environment variables, Stripe webhook secret, email provider, rate-limit storage, and observability alerts.
- [ ] Verify domain, TLS, redirects, robots, sitemap, analytics consent, privacy, terms, returns, and shipping policies in the deployed environment.
- [ ] Perform a real retail order, sales request, wholesale application, approval, and fulfillment handoff in production.

The unchecked items are deployment or human-verification tasks. They cannot be proven from the repository and must remain release gates for transactional commerce.
