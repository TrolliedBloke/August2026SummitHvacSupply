# Handoff: implementing FINDER-AND-AUDIENCE-PLAN.md

**Date:** 2026-10-01 · **State:** Codex implementation added on the existing uncommitted `main` checkout. Verification results are recorded below. Original Claude notes remain as historical context.

## Codex continuation

- Dealer staff screen: license date/class, CSLB link, license-check and EPA-card forms, and approval disabled until the required license check is recorded. Approved historical applications can also have credentials checked.
- Dealer portal: verified active accounts can opt into ZIP-based referrals and pause them. The server action derives the account ID from the authenticated profile.
- `/admin/referrals`: staff queue, available ZIP matches, recorded introductions, outcomes, and report-time attribution. It does not send messages. Paid orders are counted once, against the account's most recent preceding introduction.
- `/admin/audiences`: broad segment counts, advertising blockers and hashed CSV exports. Rechecks consent, requires 250 target addresses / 100 purchaser exclusions, logs exports, and refuses advertising before all gates pass. Old no-sharing notice consent cannot become advertising permission retroactively.
- Admin dashboard: six finder event stages and observed completion/opt-in rates.
- `docs/PRIVACY-AD-SHARING-DRAFT.md`: unpublished counsel draft with primary references and launch prerequisites.
- Privacy fixes: opt-out cookies and both GPC signals reach email capture; known finder/account emails are associated with opt-outs. Consent writes are atomic and database failures are not silently stored in memory. Public GPC requests do not add an authentication round trip.
- Email fixes: missing/rejecting providers no longer report successful delivery. Planning stops on paid orders or homeowner requests. New scheduled flows use durable claims to prevent duplicate stages; abandoned-cart marketing also requires consent.

### Database status

The owner reported running 030–034 in the live Supabase SQL Editor during this handoff. The supplied SQL explicitly pauses `lifecycle-dispatch-hourly`. This is owner-reported application, not an independent database check.

The owner also reported running **035** in the live Supabase SQL Editor: `supabase/migrations/035_finder_consent_and_delivery_hardening.sql`. This has not been independently verified. It adds the atomic consent RPC, lifecycle delivery ledger, paid-order trigger, referral outcome actor, ZIP validation, and introduction concurrency guards. The earlier migrations have not been rewritten after the owner applied them.

After migration 035, run `supabase/tests/finder_security.sql` and `npm run test:security` against the configured isolated database. This checkout has no `.env.local` or live database credentials, so authenticated dealer/staff integration and database execution cannot be independently checked here.

The original handoff reported QuickBooks migrations 024/025 missing live. Finder work does not apply them or activate QuickBooks. Confirm migration history, the deployed sync function, the private token, and successful sync runs separately; missing migrations alone do not establish every aspect of sync health.

### Email deployment and recovery

Set `AUTH_COOKIE_SECRET`, the Supabase server credentials, and `RESEND_API_KEY` in the deployment. Set the site's `CRON_SECRET`, then configure the matching `private.app_config.site_base_url` and `cron_secret`. If that table has no row, initialize the existing migration-004 configuration first; an UPDATE of an empty table does nothing. Only enable `lifecycle-dispatch-hourly` after the updated app and migrations are deployed.

Inspect `lifecycle_deliveries` for `sent_at IS NULL` after dispatch. Failed or interrupted claims are held to avoid duplicates: check the provider's delivery history before resetting a claim and rerunning. Sent claims whose flow-stage update failed also require reconciliation against the provider and stage; do not delete sent claims blindly.

### Verification

October 3 pre-push checks: all 173 unit tests, lint, and TypeScript passed again. GitHub access is available and previous `main` commits have successful Vercel Production deployments. The signed-in Vercel account (`binniela`) cannot access Summit's project in `gabrielchi-3942s-projects`. The Supabase connector is disabled by the workspace administrator, and no local database credentials are present. Consequently production environment values, cron state, migration execution, signed-in workflows, and QuickBooks sync remain unverified. No scheduler, ad gate, or QuickBooks configuration was changed during these checks.

- `npm run lint`, `npx tsc --noEmit`, and `npm run build`: passed using Node 24.19 (the machine's default Node 20.17 is below the project's supported minimum).
- `npm test`: 173 tests passed, none skipped. Email-provider calls in the new tests are mocked; no real marketing email was sent.
- `npm run test:e2e`: all 29 Chromium tests passed, including finder branches, homeowner prefill, privacy signals, signed-session rejection, responsive layouts, and automated accessibility checks. These use an isolated keyless preview, not the live database.
- Finder result screenshots at `test-results/finder-desktop.png` and `test-results/finder-mobile.png` were visually reviewed.
- `scripts/design-screens.ts` completed the public-page and interactive-state capture into `design/screens/index.html`; the new finder and privacy opt-out routes are included. The mobile opt-out screenshot was visually reviewed. Checkout redirects to `/quote` in this keyless preview, so this is not a live payment or authenticated-screen verification.
- `npm run catalog:compliance`: three matched systems, exactly one homeowner-eligible system (the TCL 3-ton ducted pair). No compliance gates were loosened.
- `npm run test:links`: all 19 checked external links responded. The CSLB detail URL also reached the official lookup site; CSLB may redirect to its search form.
- `git diff --check`: passed.
- Live security suites were skipped because database credentials are absent. Migration 035, SQL security assertions, real email delivery, and signed-in staff/dealer workflows against Supabase remain unverified. No deployment, advertising activation, or cron activation was performed.

Read `docs/FINDER-AND-AUDIENCE-PLAN.md` first; this note tracks progress against it. Read `AGENTS.md` too: this is Next 16, and the docs live in `node_modules/next/dist/docs/`.

## Decisions made by the owner (2026-10-01)

- **Stay on the current stack.** No Shopify, Octane AI or Klaviyo. Audiences go out as a manual staff export (plan 6.2).
- **Paid Meta and Google ads will run later.** Build the infrastructure, but keep it behind gates.
- **The dealer agreements are held by the owner, who says Summit may sell TCL, Tosot and Carrier to homeowners.** This is recorded in `src/lib/brand-policy.ts` as `homeownerSaleAllowed: true`. Nobody has checked each brand's warranty terms for online purchases, so `internetSaleWarranty` stays `"unknown"` and the UI shows `WARRANTY_DISCLOSURE` instead of making a claim. Don't change that without a source.
- **Implement the whole plan.**

## Done

**Phase 1: compliance data**
- `src/lib/efficiency-policy.ts`, `src/lib/brand-policy.ts`, `src/lib/refrigerant-policy.ts`.
- `src/lib/catalog/compliance.ts`: per-SKU California status, AHRI-matched systems, homeowner eligibility with reasons, and a summary. A missing rating is never compliant.
- `scripts/compliance-report.ts` (`npm run catalog:compliance`). Current result: 3 matched systems, **1 eligible for homeowners** (TCL36KHPU + TCL36KAHU, AHRI 215869484). The 410A pair is blocked by the R-410A hold; the 24K pair has no rating on file. That's the correct, honest result. Don't loosen it.
- Compliance counts on `/api/health/catalog` and `/admin/catalog`.
- Product page: a "California efficiency" spec row, an R-410A notice, and the warranty disclosure line.
- Unsourced claims removed: the "$2,200–$3,600" figures and the "warranty stays intact" line in the abandoned-cart email (`lifecycle.ts`), and the permit-fee and warranty claims in the chat prompt (`chat.ts`). The prompt now reads the brand policy, the R-410A policy and the sizing table, and includes the CA status on each catalog line.

**Phase 3.1:** `src/lib/sizing.ts` is the single sizing rule. The estimator in `seo-tool.tsx` uses it. Deleted `system-sizer.tsx` (dead code) and `/api/sizing-match`, which had no callers and emailed client-supplied titles and links.

**Phase 3: the finder**
- `src/lib/finder/questions.ts`: fork, branched paths, zod schemas, segments, tags.
- `src/lib/finder/recommend.ts`: pure results. Homeowners see only eligible systems; contractors see stock first, never a price.
- `src/lib/finder/email.ts`: shortlist email built server-side.
- `src/lib/finder/handoff.ts`: sessionStorage prefill for the homeowner form.
- `src/lib/backend/finder.ts`: run, store, signed `summit_finder` cookie, `sendShortlist`, `linkHomeownerRequest`.
- `POST /api/finder`, `POST /api/finder/email`, `POST /api/stock-alerts`.
- `src/app/finder/page.tsx` and `src/components/finder/finder.tsx` (the UI).
- Homeowner form prefill, and `/api/homeowner-requests` linking requests to finder sessions.
- Entry points: home audience paths, `/homeowners`, the catalog zero-results state, local landing pages, the footer, the sitemap.

**Phase 4**
- `lifecycle.ts`:
  - `emailShell` and `escapeHtml` are now exported.
  - Back-in-stock now applies the live inventory overlay. Before this it could never fire.
  - Planning series (Day 0/1/3/7/14/30), category stock alerts, day-7 warranty-registration reminder (transactional), day-45 maintenance email (needs consent).
  - Unsubscribe kinds `marketing` and `category`.
- `src/lib/backend/consent.ts`: marketing consent, ad-sharing opt-out, GPC header helper.
- The dispatch route runs every flow. Its stale "Vercel cron" comment is fixed.

**Phase 5 (the code half)**
- Privacy notice is now v1.1, with v1.0 archived. It lists finder data, says marketing needs an opt-in, and names the opt-out page and GPC. `PRIVACY_DISCLOSES_AD_SHARING = false` in `privacy.tsx`.
- `src/lib/ads-config.ts` has five gates. Today all are closed, so nothing loads.
- `src/components/ad-tags.tsx`: consent banner plus Meta and Google tags. Respects GPC and the opt-out cookie.
- `/privacy/opt-out` page with the API at `POST /api/privacy/opt-out`. Footer link on every page.
- CSP ad hosts are added only when `ADS_ENABLED=true` at build time.

**Phase 2 (partial)**
- EPA 608 fields: optional in `forms/dealer.ts`, on the dealer form, and in the insert.
- `dealer-review.ts`: new fields, `recordLicenseVerification`, `recordEpa608Sighting`, `cslbLookupHref`.
- `admin/dealers/actions.ts`: `recordLicenseCheckAction` and `recordEpa608Action`.
- `src/lib/trade-tier.ts`.

**Original Claude migration status (historical; superseded by Database status above)**
- 030: license and EPA 608 verification, installer opt-in columns, the `referrals` table, `introduce_installer`, and `approve_dealer_application` now requiring a verified license. Its live definition was read first and matched 026.
- 031: `finder_sessions`.
- 032: `marketing_consents`, `planning_series`, `category_stock_alerts`, and the post-purchase columns on `sales_orders`.
- 033: pg_cron calling `/api/lifecycle/dispatch` hourly. After applying it, someone must set `private.app_config.site_base_url` and `cron_secret`.
- 034: `audience_exports` log.

The live project (`cswrezdcwdqnhwplmddr`) has 026–029 applied but **not 024 or 025**, so the QuickBooks live-inventory sync tables may not exist in production. Apply 030–034 to a Supabase branch and run `npm run test:security` before production (see DR-EXT-04). **Do not apply to production without the owner's go-ahead.**

## Original Claude remaining-work checklist (historical; see continuation above)

1. **Admin dealers UI** (`src/app/admin/dealers/page.tsx`). In `ApplicationCard`:
   - Show license verified-at and class.
   - For CA licenses, add a CSLB lookup link (`cslbLookupHref`). Check that URL with `npm run test:links` or in a browser.
   - Add a form for `recordLicenseCheckAction`: `classification` input, `confirmed=yes` checkbox, hidden `applicationId`.
   - Show the EPA 608 type, number and sighted-at, plus a form for `recordEpa608Action`.
   - Disable the approve form with an explanation when `licenseApplicable && !licenseVerifiedAt`. The database also refuses this case.
2. **Installer opt-in (plan 2.3)** in the dealer portal (`src/app/portal/dealer/page.tsx`, `src/components/portal-dashboard.tsx`).
   - Add a card with an `accepts_homeowner_referrals` toggle, `referral_zips` (5-digit list), and a pause control.
   - Use a server action that writes with the service role, scoped to `profile.accountId`.
   - Show it only when `accounts.license_verified_at` is set; the DB check constraint enforces that too.
3. **Referral queue (plan 2.4 and Phase 7)**: `src/app/admin/referrals/page.tsx`, linked from `/admin`.
   - List open `homeowner_requests`, each with the opted-in installers whose `referral_zips` include its ZIP.
   - Add an "Introduce" action calling RPC `introduce_installer(p_request_id, p_account_id, p_actor)`.
   - List referrals with an outcome form (`record_referral_outcome`).
   - Show attribution, computed at report time: `sales_orders` by `account_id` after `introduced_at`. This differs from the plan text ("orders carry referral id"); update the plan doc to match.
4. **Audience export (plan 6.1–6.2)**:
   - Write `src/lib/backend/audiences.ts`:
     - Segment counts come from `listAdShareableConsents()`, joined to each email's latest `finder_sessions.segment`. `customer` = emails on paid `sales_orders`.
     - Refuse unless `adsConfig().enabled`.
     - Minimums: 250 for target audiences, 100 for exclusions.
     - Output is SHA-256 hashes of normalized emails.
     - Log every export to `audience_exports`.
   - Build `src/app/admin/audiences/page.tsx` (counts, gate blockers via `ADS_GATE_LABEL`) and a CSV export route handler under `/admin` that calls `requireStaff()`.
5. **Funnel card (plan 3.6)** on `/admin` (`src/app/admin/page.tsx` uses `getEventSummary()`):
   - Events, in order: `finder_started` → `finder_completed` → `finder_results_viewed` → `finder_shortlist_emailed` → `finder_marketing_optin` → `finder_installer_requested`.
   - Show start→completion and completion→opt-in rates.
6. **Draft for counsel**: write `docs/PRIVACY-AD-SHARING-DRAFT.md`. It holds proposed replacement text for the "We do not sell…" section, describing Meta and Google sharing, and the questions in plan 5.1 (CCPA threshold, Customer Match disclosure). `privacy.tsx` already references this file.
7. **Tests.** Add `tests/finder.test.ts` and append it to the `npm test` script in `package.json`. Cover:
   - `caResidentialStatus` / `meetsMinimum`: a missing rating is never compliant, below-minimum fails, AC bands.
   - `matchedSystems` / `homeownerEligibleSystems`: exactly 1 eligible today; the R-410A hold blocks.
   - `brandPolicy`: an unlisted brand is restrictive.
   - `estimateCapacityBtu` band edges.
   - `questionsFor` branching and `prunedAnswers`.
   - `segmentFor` / `tagsFor`.
   - `recommendForHomeowner` returns 0 options for a ductless room, and 1 for a ducted whole home with `size: home_mid`.
   - `recommendForContractor` never includes a price field.
   - `shortlistBody` escapes HTML.
   - `adsConfig` gates.
   - `prefillFromAnswers`.
   - `planningEmail` has no `$` amounts.
   - `categoryAlertMatches`.
   - `browserOptedOut`.
8. **E2E.**
   - Add `/finder` and `/privacy/opt-out` to `PUBLIC_ROUTES` in `tests/e2e/remediation-gates.spec.ts`, and to `scripts/design-screens.ts`.
   - Add a Playwright flow for each finder path, including skipped questions and the homeowner empty-results case (ductless room → "None of the systems…").
   - Add a test that the footer opt-out link is visible at 390px.
9. **Verify.** Run `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`. Then preview `/finder` in a browser at mobile and desktop widths, and check axe and console output.
10. **Plan doc.** Update `docs/FINDER-AND-AUDIENCE-PLAN.md` with:
    - the decisions above;
    - report-time attribution;
    - the deleted `/api/sizing-match`;
    - post-purchase flows: day 7 warranty (transactional), day 45 maintenance (needs consent);
    - the fact that live 024/025 aren't applied.

## Things to watch

- `src/lib/backend/consent.ts` imports `PRIVACY` from a `.tsx` file. That's fine in Next and in tsx tests, which already import the legal registry.
- `lifecycle.ts` imports `@/lib/finder/recommend` and `questions`, but `finder.ts` imports `lifecycle.ts`. Keep `lifecycle.ts` from importing `backend/finder.ts`, or you'll create a cycle.
- `adsConfig()` runs in the root layout at build time. Don't make the root layout read `cookies()` or `headers()`; it must stay static. GPC is honored client-side in `ad-tags.tsx` and server-side on the email-capture API (`sendShortlist`).
- THEME.md: font weights 400/500 on new public UI; green only for actions and availability. The finder uses ink for selected state and for progress.
- Copy rules: no dollar figures for permits, HERS or installs; no warranty claims beyond `brand-policy.ts`; no DIY framing.
