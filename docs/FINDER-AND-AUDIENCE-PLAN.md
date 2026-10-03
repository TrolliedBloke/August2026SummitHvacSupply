# Summit HVAC Supply — System Finder, Lifecycle Email and Ad Audiences

**Date:** 2026-10-01 · **Source:** "Pressure-Testing the Quiz-Driven Personalization and Ad Plan" (research memo, October 2026) · **Depends on:** `PLAN.md` Phases 0, 1 and 3, and `docs/DESIGN-REMEDIATION-STATUS.md` DR-EXT-03 and DR-EXT-04.

This plan turns the memo's recommendations into work on this codebase. The memo assumes a Shopify + Octane AI + Klaviyo stack. Summit doesn't run on that stack, and most of the pieces it recommends buying already exist here in some form. This plan builds on what's already in the repo.

## Implementation decisions and status — October 1, 2026

The original inventory below describes the pre-implementation scan. The implementation builds on the current stack. Paid advertising remains disabled pending the documented gates. The owner confirmed that the TCL, Tosot and Carrier dealer agreements permit homeowner sales; online-purchase warranty coverage remains unknown and customer copy uses the neutral brand-policy disclosure. Unknown warranty coverage does not itself exclude a system under this decision, but a disallowed sale or explicit lack of coverage does.

The finder currently has three AHRI-matched systems, of which exactly one is homeowner-eligible: the TCL 3-ton ducted pair, AHRI 215869484. R-410A remains excluded from homeowner recommendations.

The owner reports applying migrations 030–035 through the Supabase SQL Editor, with `lifecycle-dispatch-hourly` paused. Follow-up migration 035 adds atomic consent updates, delivery claims, paid-order segment updates, referral outcome actors, and serialized installer introductions. Database application and security remain independently unverified; see `supabase/tests/finder_security.sql` and `npm run test:security`.

The Claude handoff reported live migrations 024/025 missing. This has not been independently reverified from this local checkout, which has no Supabase credentials. QuickBooks sync setup is separate from the finder migrations and remains an operations follow-up.

## The findings that shape this plan

**1. About half of this is already built.** Here is how each of the memo's recommendations maps to the repo:

| Memo recommends | Already in the repo | Gap |
|---|---|---|
| A 4–6 question finder | `src/components/system-sizer.tsx` (3 inputs, **not rendered anywhere**), `/tools/system-sizing-estimator` (1 input, a different sizing rule) | A finder with a fork, branched paths and results |
| A contractor/homeowner fork | `src/components/home/audience-paths.tsx` (two doors: retail and contractor sign-in) | The fork should route into a guided path, not only to a page |
| Routing homeowners to an installer | The homeowner request already promises "introduce a qualified installer" (`src/lib/backend/homeowner.ts`), with a consent checkbox covering it | Nothing performs the introduction: no installer opt-in, no matching, no attribution |
| Verified pro tier (CSLB + EPA 608) | Dealer application collects license number and state; `approve_dealer_application` (migration 026) sets role and price tier | No EPA 608 field, no record that staff checked the license, no license-class check |
| Volume pricing tier | `accounts.price_tier` (default `standard`) | Only `standard` exists; ops defines the others |
| Answers stored on the profile | `site_events` (first-party events) | No per-person finder record |
| Lifecycle email | `src/lib/backend/lifecycle.ts`: back-in-stock, a 3-step abandoned cart, a day-14 review request, unsubscribe tokens, CAN-SPAM footer | No marketing-consent record, no nurture series, **and no scheduler runs dispatch** (see "Found during the scan") |
| Email results after showing them, not before | `/api/sizing-match` already does exactly this, and its comment states that principle | Needs a finder version that can carry a marketing opt-in |
| Education on permits, Title 24 and HERS | Guides: `bay-area-hvac-permits`, `california-title-24-hvac-changeouts`, `r-32-r-454b-a2l-transition` | Link them from finder results |
| CCPA "Do Not Sell or Share" and GPC | Privacy notice covers CCPA rights | No opt-out link, no GPC handling, and **the notice promises Summit does not share data for cross-context behavioral advertising** |

**2. The store can't sell anything yet, so ads come last.** No SKUs are purchasable, every record is `quote_only`, and 91 of 100 product pages can't be indexed (`PLAN.md`). The finder is still useful today, because its homeowner output is a quote request plus an installer introduction, and that already works. Paid ads aren't useful yet: they would send paying traffic to a catalog that can only say "request a quote".

**3. Running retargeting ads breaks a promise on the privacy page.** `src/content/legal/privacy.tsx` says Summit does "not share it for cross-context behavioral advertising". A Meta Pixel, a Google Ads tag or a Customer Match upload makes that statement false the day it ships. So the privacy notice has to be rewritten and approved by counsel *before* Phase 6. Counsel is already reviewing that page under DR-EXT-03, so add this question to that review now instead of paying for a second one.

**4. The catalog's compliance data is too thin to filter on yet.** The memo says to filter non-compliant AC out of California recommendations. Today:

- Only 12 of 76 equipment records carry SEER2/EER2/HSPF2.
- 27 records are `requires_matched_combination`. For those, the efficiency rating depends on the indoor/outdoor pairing, so there's no per-SKU rating to filter on.
- 17 records are R-410A mini-splits, and 10 of them are among the 23 priced SKUs, which are the ones closest to selling.

A filter that treats a missing rating as compliant is the same mistake the sellability gate exists to prevent. So the finder can only *recommend* equipment whose compliance is proven, and it routes everything else to "staff confirms the matched system".

**5. The memo's warranty findings are about brands Summit doesn't sell.** The Daikin and Mitsubishi warranty policies it cites don't apply directly: the catalog is TCL (37), Tosot (29), Carrier (11), unbranded (22) and DEWALT (1). The catalog records each brand's warranty term but not its policy on internet sales. Meanwhile, the chat assistant tells shoppers that "DIY installation also voids the manufacturer warranty" (`src/lib/backend/chat.ts:38`), which nobody has checked against these three brands.

### Volume math, using the memo's own rates

The memo's funnel: 1,000 paid clicks ≈ $8,330 → 30% start the finder × 65% complete × 40% opt in ≈ **78 emails** → at a 40% match rate ≈ **31 matched users**.

Each ad audience needs about 250 opted-in emails to clear 100 matched users. Four audiences is about 1,000 emails, which is roughly 12,800 paid clicks, or **about $107,000** if the audiences fill from paid traffic alone. So the audiences have to fill from organic finder traffic and the existing customer list first. Paid ads are something that uses an audience once it exists; they're too expensive a way to build one.

These funnel rates come from quiz-software vendors. Phase 3.6 measures Summit's real rates, and those replace the estimates here.

---

## Decisions needed before starting

| # | Decision | Recommendation |
|---|---|---|
| D1 | Move to Shopify + Octane AI + Klaviyo, or build on the current stack? | **Build on the current stack.** Trade approval, account pricing, lifecycle email and events already exist. Moving to Shopify throws away the sellability gate, the research provenance and the trade identity model. Put off any Klaviyo decision until the Phase 6 gate (see 6.2). |
| D2 | Run paid ads before any SKU is purchasable? | **No.** Phase 6 is gated on purchasable SKUs or on an explicit decision to run lead-generation ads, plus counsel approval. |
| D3 | Who reads the TCL, Tosot and Carrier dealer agreements and warranty terms for internet sales? | Ops and the brand reps. This blocks 1.2 and the homeowner path's eligibility rule. |
| D4 | Does Summit want to run an installer referral network (the "two-sided flywheel")? | **Yes, staff-mediated at first.** Without one, the homeowner path ends at a quote form, and the memo's best long-term argument depends on it. |

---

## Phase 1 — California compliance data on the catalog (eng + ops)

The finder can't recommend anything safely until this phase is done. It runs in parallel with catalog verification work in `PLAN.md` Phase 1, which uses the same research pipeline.

**1.1 — Efficiency rules as a versioned policy. [eng, S]**
Create `src/lib/efficiency-policy.ts`, modeled on `fulfillment-policy.ts`. It holds the DOE Southwest-region minimums (split AC under 45k BTU: 14.3 SEER2 / 11.7 EER2; 45k and up: 13.8 / 11.2; split heat pump: 14.3 SEER2 / 7.5 HSPF2), with a source URL, `reviewedAt` and a review state. The memo notes one aggregator lists 15.2 SEER2 for heat pumps; the policy uses the manufacturer tables and records why.

**1.2 — Brand policy per brand. [ops research → eng, S]**
Create `src/lib/brand-policy.ts`. For each brand it records:
- `internetSaleWarranty`: `covered` | `requires_licensed_install` | `not_covered` | `unknown`
- `homeownerSaleAllowed` (from the dealer agreement)
- a source and `reviewedAt`

All three brands start as `unknown`. The chat prompt and lifecycle email copy read their warranty claims from this file instead of stating them inline.

**1.3 — A California eligibility status on each SKU. [eng, M]**
Add a derived `caResidential` status to each SKU in the importer: `compliant` | `requires_matched_combination` | `noncompliant` | `unknown`. It's computed from the record's SEER2/EER2/HSPF2 fields, its `ahri.status` and the 1.1 policy. A missing rating is never `compliant`. Then add `homeownerEligible(sku)`, which is true only when:
- `caResidential === "compliant"`, **and**
- the brand allows homeowner sales and its online warranty policy isn't `not_covered`; unknown warranty terms use the neutral disclosure (owner decision above), **and**
- the SKU isn't R-410A while 1.4 is still open.

Add the counts to `reconciliation.generated.json` so progress is visible.

**1.4 — R-410A: confirm before promoting. [ops + counsel]**
Get written confirmation from CARB or the manufacturers (TCL and Tosot cover all 17 R-410A records) that pre-2025 split inventory can be installed in California. Rheem's reading treats a standalone condenser swap as a new installation, which would rule it out.

Until that confirmation exists, R-410A SKUs:
- stay visible on the contractor path, with a notice,
- are left out of homeowner finder results,
- are never featured in ads.

Separately, ops starts recording manufacture date by lot when R-410A stock is received. That's a receiving-process change, not code. The memo also notes California's SB 1206 bans sales of bulk virgin R-410A from 2030; Summit doesn't stock refrigerant today.

*Verification:* `homeownerEligible` has unit tests covering each exclusion. The reconciliation output reports a `homeownerEligible` count. Today that count will be at or near zero, and it rises as `PLAN.md` Phase 1 research lands. That's expected: an empty homeowner shortlist routes to the installer path, which is still a useful result.

---

## Phase 2 — Contractor verification and installer referrals (eng + ops)

**2.1 — Three tiers, defined in code. [eng, S]**

| Tier | How someone gets there | What they get |
|---|---|---|
| Self-identified pro | Picks "contractor" in the finder | Contractor content, stock alerts, and an invitation to apply. **No pricing.** |
| Verified pro | Approved dealer application with the license checked (2.2) | Account pricing (already exists), quick order, reorder, saved lists |
| Homeowner | Default | Retail pricing, education, installer introduction |

The rule this enforces: account pricing still comes from the signed-in account only (`lib/commerce/price-presentation.ts`). A finder answer never changes a price.

**2.2 — Record that the license was checked. [eng, M]**
Migration 030 adds these fields to `dealer_applications`:
- `license_verified_at`, `license_verified_by`, `license_classification` (C-20, C-38, B, …)
- `epa608_certification_type` (I / II / III / Universal) and `epa608_certificate_number`, both optional on the application

On the admin dealers page:
- Link to CSLB's public license lookup with the license number filled in.
- Staff record the classification and the date they checked.
- `approve_dealer_application` refuses an application for a `licensed: true` business type unless `license_verified_at` is set.

Leave out document upload for now, for the reason `DESIGN-REMEDIATION-STATUS.md` gives: storage, malware scanning and retention need a requirement first. Staff record "card sighted" with a date instead. **EPA 608 becomes mandatory the day Summit lists any refrigerant SKU.** The EPA requires sellers of refrigerant to verify certification; pre-charged equipment is not restricted.

**2.3 — Installer opt-in. [eng, M]**
On approved trade accounts, add `accepts_homeowner_referrals`, `referral_zips` (text[]) and `referral_paused_at`, editable from the dealer portal. Only accounts with a verified license (2.2) can opt in.

**2.4 — Staff-mediated matching and attribution. [eng, M]**
Add an admin queue of homeowner requests (from the existing form and from the finder), each showing the opted-in installers whose `referral_zips` cover the request's ZIP. Staff coordinate the introduction with the homeowner and installer, then record it; the action does not send messages. The introduction is recorded in `referrals`. Attribution is computed at report time from paid orders for that account after `introduced_at`. Each order counts only against the most recent preceding introduction, avoiding double counting. This is a correlation, not proof that an order belongs to the homeowner's project; orders do not carry a referral ID.

Matching stays manual until volume justifies automating it. The existing consent copy already covers sharing project details with an installer the homeowner agrees to be introduced to.

*Verification:* The security suite gains checks that an anonymous or homeowner session can't read `referrals` or the referral fields on other accounts. An application can't be approved without a recorded license check.

---

## Phase 3 — The finder (eng, ~2 weeks)

**3.1 — One sizing rule. [eng, S]**
There are two sizing rules today:
- The `SystemSizer` bands: 9k ≈ 400 sq ft, 12k ≈ 550, 18k ≈ 750, 24k ≈ 1,000
- The estimator's 25 BTU per sq ft

The shared bands are now in `src/lib/sizing.ts`, used by the finder, estimator and chat instructions. `system-sizer.tsx` and the unused `/api/sizing-match` endpoint are deleted. The old endpoint emailed browser-supplied titles and links; `/api/finder/email` builds its message from the saved session and server catalog instead.

**3.2 — `/finder`: the fork plus 4–5 questions per path. [eng, L]**
The question flow lives in a typed config file (`src/lib/finder/questions.ts`) so copy and branching can change without touching the component.

- **Q1 — Fork:** "Who's this for?"
  - My home → homeowner path
  - I'm a contractor → contractor path
  - "I know what I need" → `/products` (the memo's "Shop equipment" exit)
- **Homeowner path:**
  1. Goal: replace a failed system / replace an aging system / add cooling or heating to some rooms / new space or ADU
  2. Current system: ducted central / furnace only / no ducts / not sure
  3. Size: rooms and approximate area
  4. Priority: lowest upfront cost / lower bills / quiet and even comfort / air quality is a priority
  5. ZIP (optional): labeled "For climate zone and local permit info only, not marketing"
- **Contractor path:**
  1. Need: equipment for a job / parts and supplies / open an account
  2. System type
  3. Tonnage or BTU
  4. When: will-call today / this week / planning
  5. Job ZIP (optional)

Design:
- Progress bar, no account required, every question skippable except the fork.
- No budget question at launch. "Lowest upfront cost" under priority captures the intent without asking for a number.
- Never ask about income or health conditions.
- Follows THEME.md: weights 400/500, green only on actions, transitions of 150 ms or less, no entrance animation.

**3.3 — Results. [eng, M]**

- **Homeowner results:**
  - Up to 3 options from the `homeownerEligible` set, each showing its compliance status.
  - A "What your install will involve" checklist: mechanical permit; HERS verification (duct leakage, refrigerant charge, airflow); the installer's Manual J. Each item links to the existing permit and Title 24 guides.
  - **No dollar figures for permit, HERS or installed cost until they're sourced for the Bay Area and reviewed** (same pattern as the fulfillment policy). The memo's figures come from Los Angeles.
  - Primary action: "Get matched with a licensed installer". It opens the homeowner request with ZIP, home type, ducts and timeline pre-filled from the answers.
  - Counter phone and text are always shown.
  - When the eligible set is empty, the installer action becomes the main result instead of an apology.
- **Contractor results:**
  - SKUs in that category and capacity, with live stock (`live-inventory.ts`) and will-call.
  - An "Apply for an account" or "Sign in" action.
  - No pricing unless the visitor is signed in to a verified account.

**3.4 — "Email me my shortlist and install checklist" after results. [eng, S]**
This is a transactional send through `/api/finder/email`. A **separate, unchecked** checkbox, "Send me occasional emails about planning this project", records marketing consent (4.1). Without that box ticked, the person gets the one email and nothing else. Delivery errors are reported rather than claiming an email was sent when no provider is configured.

**3.5 — Persist answers. [eng, S]**
Migration 031 adds a `finder_sessions` table:
- `id`, `path`, `answers` (jsonb, validated by zod), `segment` (derived, 3.7), `completed_at`
- `email` (nullable), `homeowner_request_id`, `consent_id`

RLS is enabled, with a staff-only read policy. The migration revokes default grants up front: migration 029 exists because the default grants on new tables leave anon with SELECT and authenticated with TRUNCATE, and RLS doesn't govern TRUNCATE. The same applies to every new table in this plan (`referrals`, `marketing_consents`). An anonymous session is identified by a signed cookie (`lib/backend/signed-cookie.ts`), not a third-party id.

**3.6 — Measure the funnel. [eng, S]**
Record these in `site_events`:
`finder_started`, `finder_step` (with step number), `finder_completed`, `finder_results_viewed`, `finder_shortlist_emailed`, `finder_marketing_optin`, `finder_installer_requested`, `finder_apply_clicked`.

Add an admin card showing start → completion → opt-in rates. **These measured rates replace the vendor estimates in the volume math above.**

**3.7 — Segments, for email and on-site use only. [eng, S]**
Each finished session gets one segment:
- `contractor`
- `homeowner_active` (goal is a failed or aging system, or timeline is ASAP or this month)
- `homeowner_researching`
- `customer` (has a paid order)

Finer personas (budget replacer, efficiency seeker, and so on) can be tags on the session for email copy, but they never become ad audiences (6.1).

**3.8 — Entry points. [eng, S]**
- A "Not sure what you need? Find your system" line under the two doors in `audience-paths.tsx`. This keeps the two-door split THEME.md requires.
- `/homeowners`, zero-result search, empty catalog filter states, and the local landing pages.

*Verification:*
- Unit tests for the question config, segment derivation and the eligibility filter.
- A Playwright flow through each path, including skipping questions and the empty-results case.
- Axe A/AA checks on every step.
- The responsive matrix at 320–1440 px.
- Run `scripts/design-screens.ts` for the new routes.

---

## Phase 4 — Consent and lifecycle email (eng)

**4.0 — Schedule lifecycle dispatch. [eng, S] — do this first.**
Nothing calls `/api/lifecycle/dispatch` on a schedule. Its comment says a Vercel cron runs it hourly, but commit `d52a1fb` removed that cron so deploys would pass on the Hobby plan, and `004_cron.sql` only schedules low-stock alerts and AR statements. As a result, back-in-stock, abandoned-cart and review emails don't send automatically today.

Fix: add a `pg_cron` job that calls the route with `CRON_SECRET`, reusing `private.invoke_function` from migration 004. Then correct the comment.

**4.1 — A marketing-consent record. [eng, M]**
Migration 032 adds a `marketing_consents` table:
- `email`, `channel` (`email`)
- `source` (`finder`, `checkout`, `account`, …)
- `notice_version` (from `content/legal/registry.ts`)
- `consented_at`, `withdrawn_at`
- `ad_sharing_opt_out_at`

Every marketing send and every audience export (6.2) checks this table; a transactional send doesn't need to. The existing unsubscribe tokens set `withdrawn_at`.

**4.2 — Homeowner planning series: Day 0 / 1 / 3 / 7 / 14 / 30. [eng + content, M]**
Only for opted-in `homeowner_*` segments. It's built on the `lifecycle.ts` dispatcher pattern with the existing email shell and unsubscribe. Content:

- Day 0: your shortlist
- Day 1: what the permit and HERS visit involve
- Day 3: ducted vs. ductless for your answer
- Day 7: rebates (links the rebate guide; no promised amounts)
- Day 14: talk to an installer
- Day 30: still planning?

No discounts, following the rule the existing lifecycle code already states. The series stops when the person submits a homeowner request or places an order.

**4.3 — Contractor alerts. [eng, S]**
Extend `back_in_stock_subscriptions` so a contractor can subscribe by category and tonnage, not only by single SKU. Reorder reminders come later, once paid orders exist.

**4.4 — SMS: not in scope.** Summit has no SMS provider. If SMS is added later, it needs its own unchecked checkbox with the TCPA disclosure, never bundled with email consent.

*Verification:*
- A test that a person without consent receives only transactional email.
- Dispatch is idempotent per stage (each stage sends at most once).
- Unsubscribing stops the series mid-flight.

---

## Phase 5 — Privacy readiness for ads (counsel + eng). Gate for Phase 6.

**5.1 — Decide whether to "share" at all. [counsel + owner]**
Running ad tags or uploading customer lists counts as "sharing" under the CCPA. Summit may meet the CCPA's data-volume threshold (data from 100,000+ California consumers or households a year, roughly 275 California visitors a day) even with modest revenue. Add these questions to the DR-EXT-03 counsel review:

- Does Summit meet a CCPA threshold?
- Rewrite the "We do not sell your personal information" section to describe ad sharing accurately.
- List the categories of data the finder collects.
- Confirm the collection disclosures satisfy Google's Customer Match policy.

**5.2 — "Do Not Sell or Share My Personal Information". [eng, M]**
- Add the link to the footer, next to Privacy Policy.
- The opt-out page sets a first-party cookie and, when an email is known, sets `ad_sharing_opt_out_at`.
- Treat the `Sec-GPC: 1` header (server) and `navigator.globalPrivacyControl` (client) as an opt-out:
  - ad tags never load for that visitor,
  - their email is never exported to an ad platform.

**5.3 — Load ad tags only with consent. [eng, M]**
A small loader injects the chosen ad tags only after the visitor consents, and never for anyone who has opted out (5.2). The CSP in `next.config.ts` then allows only the specific hosts those tags need. Server-side conversion APIs are an option worth weighing, because they keep third-party scripts off the page entirely.

*Verification:*
- With GPC on, an e2e test sees no ad-host network requests.
- An opted-out email is absent from the export.
- The production CSP still contains no wildcard hosts.

---

## Phase 6 — Ad audiences and campaigns (marketing). Gated.

**Gate (all four must be true):**
1. Purchasable SKUs > 0, or the owner has explicitly approved lead-generation ads.
2. Counsel has approved the 5.1 privacy notice.
3. 5.2 and 5.3 are live.
4. A segment has at least 250 consented, not-opted-out emails before it's used as an audience.

**6.1 — Three or four broad audiences.** Contractors; homeowners, active; homeowners, researching; past purchasers (used only as an exclusion, and later for maintenance and accessories). Each needs 100+ matched users before it's split further.

**6.2 — How audiences get to the platforms.** The staff-only admin export provides SHA-256 hashes of normalized emails in CSV, filtered against current consent and opt-outs, with every export logged before the file is released. Target audiences require 250 addresses; purchaser exclusions require 100. Purchasers cannot be exported for targeting. Only consent under the current notice version counts; permission collected under a no-sharing notice must be renewed after an approved notice is published. Uploads remain manual and ads remain gated. Also:
- Contractor lists are mostly business emails, which match poorly to personal Google and Meta accounts. Collect a mobile number where it's natural to.
- Check Customer Match eligibility in Audience Manager before planning around it. The memo's eligibility figures are secondhand.

**6.3 — Creative rules:**
- Contractor stock ads only for SKUs with a live in-stock count, at the moment the ad runs.
- Homeowner ads lead with education: "what your install involves", "repair or replace".
- No DIY framing.
- No warranty claim that `brand-policy.ts` doesn't support.
- Never promote R-410A while 1.4 is open.

**6.4 — Landing pages:** `/finder`, the existing guides and the local landing pages. Never a product page that can't be indexed.

---

## Phase 7 — The feedback loop (month 4 onward)

- Feed paid orders back into `finder_sessions.segment` (`customer`).
- Split a segment only once it clears 100 matched users.
- Report on the referral loop: homeowner request → referral → orders from that installer account. If homeowner leads produce contractor orders, that two-sided loop is worth more to Summit than one-off retail sales.
- Day-7 warranty registration reminders are transactional and derive terms from sourced catalog warranty records. Day-45 maintenance/accessory email requires active marketing consent. New scheduled flows use durable delivery claims to prevent repeat sends; failed or interrupted claims require staff review. See the deployment notes in `docs/HANDOFF-FINDER-PLAN.md`.

---

## Sequencing

```
PLAN.md P0/P1  ████████████████████████   catalog: sellable SKUs and verified identity (already running)
Phase 1        ░░████                     compliance data; 1.2/1.4 wait on ops and counsel
Phase 2          ░░█████                  verification tiers and installer opt-in
Phase 3              ██████               finder (after 1.3 and 3.1)
Phase 4.0      ██                         lifecycle cron (do now, unrelated to the rest)
Phase 4.1–4.3           ████              consent and series (after 3.5)
Phase 5        ░░░░░░░░████               counsel in DR-EXT-03, then eng
Phase 6                       ░░░░████    gated: sellable SKUs + counsel + 250 per segment
```

What can start today: 4.0, 1.1, 3.1, 2.1, and the 1.2/1.4 research. The finder can launch before any SKU is purchasable, because its homeowner output is an installer introduction.

## What not to do

- **Do not advertise to a DIY-installer persona.** EPA treats connecting pre-charged lines as work that requires 608 certification, and California change-outs need a permit and HERS verification. The site already says "equipment supply only"; keep it that way.
- **Do not let a finder answer unlock pricing.** Self-identification is for routing content only.
- **Do not put an email gate in front of results.** Results first, then an optional email.
- **Do not publish install-cost or permit figures that haven't been sourced and reviewed for the Bay Area.** The memo's figures come from Los Angeles.
- **Do not count a missing efficiency rating as compliant** to make the homeowner shortlist longer.
- **Do not ship a pixel or upload a list while the privacy notice still says Summit doesn't share data.**
- **Do not add Shopify or Octane AI alongside this stack.** They duplicate trade pricing, the catalog gate and lifecycle email, and split customer data across two systems.
- **Do not loosen the sellability gate or the indexability bar** to give ads something to land on.

## Found during the scan (fix regardless of this plan)

1. **Lifecycle emails don't send automatically.** See 4.0.
2. **The abandoned-cart email makes claims nobody has sourced.** `src/lib/backend/lifecycle.ts:265` states "$2,200–$3,600 all-in" versus "$6,800+" and "Your warranty stays intact with licensed installation". Nothing sources the figures, and the warranty claim hasn't been checked per brand. Remove them or source them. The second email ends up reading from `brand-policy.ts` (1.2).
3. **The chat assistant asserts a warranty rule nobody has verified.** `src/lib/backend/chat.ts:38` says DIY installation voids the manufacturer warranty, which hasn't been checked for TCL, Tosot or Carrier. Its answer should come from `brand-policy.ts` once 1.2 lands.
4. **`src/components/system-sizer.tsx` is dead code.** Nothing renders it. See 3.1.
