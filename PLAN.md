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

## Phase 2 — Engineering cleanup (done 2026-08-25, bar two dashboard toggles)

**2.1 — Add metadata to the pages missing it. — DONE 2026-08-24.**

Three pages, not four. `/products/[series]` calls `notFound()` unconditionally and generates zero static params — it is a deliberate 404 route and correctly has no metadata. The earlier count was wrong.

`/contact`, `/quote` and `/dealers` are all `"use client"`, and a client component cannot export `metadata`, so each got a sibling `layout.tsx` carrying a `pageMetadata()` call. That is the standard fix and the only reason those files exist.

*Verified:* each of the three serves a distinct `<title>`, description, and canonical.

**2.2 — Apply `supabase/migrations/022_review_requests.sql`. — APPLIED 2026-08-25.**

Applied to project `cswrezdcwdqnhwplmddr` (named "crm" in the dashboard — it is the Summit database; the name is misleading). It followed 021 with no gap.

One thing worth recording: before replacing `advance_fulfillment` I read the *live* function definition rather than assuming the repo's 006 version was current. Migration 016 (`lock_operational_rpc`) could plausibly have hardened it since, and a `create or replace` built from the older body would have silently reverted that. It had not been changed — but the check is the reason this was safe, and the same check belongs in front of any future `create or replace`.

*Verified live:* 2 columns added, partial index created, function body now stamps `fulfilled_at`. The one pre-existing order has `fulfilled_at IS NULL`, confirming the deliberate no-backfill behaviour — it will never receive a review request.

*Still to verify, by a human:* mark a real order delivered and confirm `fulfilled_at` stamps, then `POST /api/lifecycle/dispatch` with `{ "advanceDays": 14 }`. **Not done here on purpose** — that dispatch sends real email to a real customer, which is not an agent's call to make.

**2.4 — Database advisors, run after the 022 DDL. — NEW.**

The security linter surfaced one genuinely actionable item and a set of understood ones.

- **Leaked password protection is disabled.** Supabase can check new passwords against HaveIBeenPwned. It is a dashboard toggle, it costs nothing, and the portal accepts customer passwords today. **Turn it on.**
- `pg_net` sits in the `public` schema. Migration 019 already restricted its permissions, so the remaining exposure is schema placement rather than access. Low priority, non-trivial to move.
- Six tables report `rls_enabled_no_policy` at INFO. That is the intended posture, not a gap: they are service-role-only and 008 deliberately adds no anon policies. Deny-by-default with no policy is the strictest state, and the linter cannot tell it apart from an oversight.
- Nine `SECURITY DEFINER` functions are flagged as callable by signed-in users, including `advance_fulfillment`. Each calls `assert_staff()` as its first statement, which the linter cannot see. Worth a periodic re-read of that list to confirm every entry still guards itself — the lint is a useful prompt even though today's answer is "intentional".

None of these were introduced by 022; the flags on `advance_fulfillment` predate it.

**2.3 — Confirm `SHOW_PLACEHOLDER_REVIEWS` is unset in production. — Repo side clear; hosting still to check.**

Audited: the flag appears in no env file, no config, and no CI definition — the repo ships no `.env` at all. The gate is also stronger than the plan implied. `placeholderReviewsAllowed()` refuses in production *unless* the flag is explicitly `"true"`, so the default is safe and this is a real control rather than a reminder to tidy up.

Remaining: confirm the variable is absent from the hosting environment's dashboard. That is the one place a value could exist that the repo cannot see.

---

## Phase 3 — Legal (blocking on someone else's calendar, so start it now)

**3.1 — Have counsel read `/returns`, `/privacy`, `/terms` and `/shipping`.**

All four are written to common HVAC-distribution practice and none has been reviewed. Every page carries a dev-only banner saying so; that banner is for the team and never renders in production.

This is not a formality. These pages now make specific, enforceable promises about money, and the site charges cards against them.

**Specific questions to put to counsel:**

| Page | The question |
|---|---|
| Returns | Is a **15% restocking fee** enforceable as written, and is it disclosed early enough? California requires a retailer's return policy to be conspicuously posted (Civ. Code §1723) — a footer link may not clear that bar for a term that takes 15% of a $2,400 order. |
| Returns | The **15-day RMA window** and **5-business-day concealed-damage deadline** shift real risk onto the buyer. Confirm both are defensible and that the freight-damage language matches what the carriers' tariffs actually allow us to recover. |
| Returns | "**Special-order items are not returnable**" is close to absolute. Confirm it survives contact with consumer-protection law when the buyer is a homeowner rather than a trade account. |
| Returns | We refund **goods and tax but not outbound freight** on a change of mind. Confirm that split is disclosed before payment, not only after. |
| Terms | Limitation of liability, warranty disclaimers, and the venue/arbitration clause — the standard set, and the reason a lawyer reads this at all. |
| Privacy | Whether Summit meets a **CCPA/CPRA** threshold, and if so what the notice, opt-out, and deletion obligations are. Do not assume the answer; it turns on revenue and data volume. |
| Privacy | What the **Stripe** relationship makes us with respect to payment data, and whether the current notice describes it accurately. |
| Shipping | That the delivery terms do not contradict the returns page once Phase 0.2 replaces the placeholder figures. |

**Two audiences, one policy.** The site sells to both licensed contractors and homeowners. Consumer-protection rules that do not reach a B2B trade sale may well reach the homeowner buying one heat pump, and the current pages do not distinguish. Worth asking whether they should.

**Sequencing note:** Phase 0.2 changes delivery figures that the shipping page cites. Send counsel the pages *after* 0.2 lands, or expect to pay for a second read.

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
