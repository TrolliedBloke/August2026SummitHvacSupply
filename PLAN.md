# Summit HVAC Supply — Launch Readiness Plan

**Date:** 2026-08-24 · Supersedes `docs/PLAN-2026-08-02.md`, which is now complete except for its Phase 1 legal review (carried forward here as Phase 3).

Derived from a full scan of the running site: every route, every internal link, all 100 catalog records, structured data, headers, and the import pipeline.

## The finding that shapes this plan

The application is in good shape. The catalog behind it is empty.

Almost nothing on this list is engineering work. Phases 0 and 1 are warehouse and catalog tasks, and they are the only things standing between this site and taking an order. An engineer cannot do them, and adding features will not move them.

| Measured | Value |
|---|---|
| SKUs that can be bought | **0 of 100** |
| SKUs with a price on file | 23 |
| SKUs with any description | **1 of 100** |
| Product pages indexable | 9 of 100 |
| Records with an identity conflict | 52 |
| SKU collision groups awaiting a human | 9 |
| Records with no image | 44 |
| Sitemap URLs returning 200 | 43 of 43 |

## Corrected during the scan

**The checkout guard is not broken.** An earlier pass flagged `/checkout` as serving a 200 with zero purchasable SKUs. That was a measurement artefact, not a defect. `redirect()` does fire; Next 16 serves it on a statically prerendered route as a 200 document carrying `<meta http-equiv="refresh" content="1;url=/quote">` plus a `NEXT_REDIRECT;replace;/quote;307` payload for the client router. `curl` follows neither. A real browser lands on `/quote`. No work required — recorded here so nobody re-opens it.

---

## Phase 0 — Unblock selling (warehouse, ~a day of counting)

**0.1 — Put real stock quantities in `data/catalog/inventory-source.csv`, then re-run the importer.**

Every record is `quote_only` because the sellability gate in `scripts/import-inventory-catalog.ts` requires a price *and* known stock *and* an unconflicted identity. `inventoryQuantity` is null for all 100 rows, so the gate closes on every one — including the 23 that already carry a price.

This is deliberate and correct. The gate's own comment says it starts publishing prices the moment real stock lands. Nothing in the code needs to change.

*Verification:* re-run the import; `data/catalog/reconciliation.generated.json` should show `purchaseEligible` above zero and `unknownInventory` below 100. Load a priced SKU and confirm it offers purchase rather than a quote. Confirm `/checkout` now renders instead of bouncing to `/quote`.

**0.2 — Confirm or delete the invented operating figures.**

`src/lib/site.ts:55` marks every `FULFILLMENT` value as shaped-to-length and unconfirmed, and they render as plain fact on the homepage and product pages: "Will-call ready in 30 min", the 2:00 PM next-day cutoff. `/delivery` carries six more and tells the visitor in its own copy that they are placeholders.

A missing number costs less than a wrong promise. Delete anything the counter will not stand behind.

*Verification:* zero `TODO(summit-ops)` markers left in `src/lib/site.ts` and `src/app/delivery/page.tsx`.

---

## Phase 1 — Catalog verification (longest pole, human, weeks not days)

This is the work that turns a 100-row spreadsheet into a catalog. It runs in parallel with everything else and it is the reason the site cannot be indexed today.

**1.1 — Work the 53-entry queue in `data/catalog/human-verification-queue.json`, priced SKUs first.**

52 records carry an unresolved identity conflict across five types, including `MODEL_NOT_FOUND` and `MANUFACTURER_IDENTITY_UNCERTAIN`. The DCT414 case — catalogued as an air-conditioner duct when it is a DEWALT infrared thermometer — was one instance of this pattern, not a one-off. Start with the 23 priced records: they are closest to earning money.

**1.2 — Settle the 9 SKU collision groups.** Each is two source rows normalising to one identifier, currently held as `separate_variant_pending_human_confirmation`. Someone has to say whether each pair is two real variants or one duplicate. The importer deliberately refuses to guess.

**1.3 — Write product copy.** Exactly one record in a hundred has a description; the median length is zero characters. Thin pages are why the SEO gate holds 91 of 100 back, and no amount of technical SEO substitutes for a page that says nothing.

**1.4 — Close the image gap.** 44 records have no image at all and exact-model coverage sits at 56%. A reference image with a fitment warning is acceptable where the exact model is unavailable — the LS143850FT line set is the pattern to follow — but it is not a substitute for the real thing.

*Verification per record:* `getSkuSeoState()` reports `indexable: true`, and the SKU appears in `sitemap-products.xml`. Track progress by the sitemap URL count: 9 today, 100 at the finish.

**Dependency:** 1.1 gates 1.2, 1.3 and 1.4 for any given record — there is no point writing copy for a product whose identity is disputed.

---

## Phase 2 — Engineering cleanup (~2 hours, all of it mechanical)

**2.1 — Add metadata to the four indexable pages missing it.** `/contact`, `/quote`, `/dealers` and the `/products/[series]` template define neither `metadata` nor `generateMetadata`, so they inherit the layout default and compete with each other in results. The other five without metadata are auth pages and correctly noindex. Four `pageMetadata()` calls; the helper already exists.

*Verification:* every non-auth `page.tsx` exports one of the two.

**2.2 — Apply `supabase/migrations/022_review_requests.sql`.** The day-14 review request depends on `fulfilled_at` and `review_request_sent_at`. Until the migration runs, the dispatcher finds nothing and silently sends zero.

*Verification:* mark an order delivered, confirm `fulfilled_at` is stamped, then `POST /api/lifecycle/dispatch` with `{ "advanceDays": 14 }` and confirm `reviewRequestsSent` is non-zero.

**2.3 — Confirm `SHOW_PLACEHOLDER_REVIEWS` is unset in production.** The sample reviews in `src/lib/reviews.ts` are correctly gated and the file warns loudly. This is a one-line environment check, not a code change.

---

## Phase 3 — Legal (blocking on someone else's calendar, so start it now)

**3.1 — Have counsel read `/returns`, `/privacy`, `/terms` and `/shipping`.**

All four are written to common HVAC-distribution practice and none has been reviewed. The returns page now states a 15% restocking fee, a 15-day RMA window, a 5-business-day concealed-damage deadline, and who pays freight in each direction — real money terms that have to be enforceable. Every page carries a dev-only banner saying it is unreviewed; that banner is for the team and never renders in production.

California specifics worth raising: Civil Code §1723 conspicuous-posting requirements, and whether the CCPA threshold applies.

---

## Sequencing

```
Phase 0  ███                            warehouse — unblocks selling, do first
Phase 1  ░░████████████████████         catalog — longest pole, start day one
Phase 2      ░░██                       engineering — two hours, any time
Phase 3  ░░░░████████                   legal — someone else's calendar
```

Phases 0 and 3 start immediately: one is quick and unblocks revenue, the other is slow and outside our control. Phase 1 is the long pole. Phase 2 is small enough to slot in anywhere and should not be used as a way to look busy while Phase 1 waits.

## What not to do

- **Do not loosen the sellability gate to make the store transact.** Selling a unit we cannot identify and do not know we hold is worse than not selling. The gate is the safety feature, not the bug.
- **Do not lower the SEO indexability bar to get more pages indexed.** Publishing a model number the manufacturer does not list invites a contractor to order the wrong equipment. Nine correct pages beat a hundred wrong ones.
- **Do not generate product descriptions from the SKU name.** That is exactly how "Air Conditioner Duct Model 414" happened.
- **Do not seed reviews or `AggregateRating`.** Still deliberate, still correct, still costs conversion today.
- **Do not redesign anything.** The token discipline, image handling, security headers and structured data are assets. The gap here is data, not design.
