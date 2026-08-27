# Summit HVAC Supply — Remediation Plan

**Date:** 2026-08-02 · Supersedes the backlog in `AUDIT-2026-08-02.md`, which has been corrected after a second verification pass.

## Status — 2026-08-24 implementation pass

Audited every item against the tree before touching anything. Most of the plan had already shipped.

| Item | Status |
|---|---|
| 0.1 RLS on the five 007 tables | **Done** — `supabase/migrations/008_storefront_growth_rls.sql`. Went further than planned: default DENY with no anon policies at all, since every path is service-role. |
| 0.2 Admin gate fails closed | **Done** — `admin/layout.tsx` gates on `requireStaff()` behind `allowUnauthenticatedAdmin()`; `proxy.ts` checks `role !== 'staff'`. |
| 1.1–1.3 Returns / privacy / terms / shipping | **Done** — all four pages exist. Policy wording is human-authored and out of scope for an agent pass. |
| 1.4 Surface it at the decision point | **Done** — `buy-box-assurance.tsx` carries the returns line and links `/returns`; footer carries all four policy links. |
| 2.1 Narrow the middleware matcher | **Done** — `proxy.ts` matches only `/admin`, `/portal`, `/checkout`. |
| 2.2 Server-render the checkout shell | **Done** — headings and copy render server-side, with a `<noscript>` carrying the will-call number. |
| 2.3 Start earning reviews | **Done this pass.** See below. |
| 3.1 Chat widget keyboard operability | **Done** — Escape, focus trap, and focus restore all present. |
| 3.2 `priority` → `preload` | **Done this pass** — one real call site remained, `locations/newark/page.tsx`. The `sku-card`/`product-card` hits were pass-through props, as the audit note predicted. |
| 3.3 Soft-404 question | **Resolved — no defect.** It was dev-server streaming, exactly as suspected. Against `next start`: `/fake-xyz123`, `/products/sku/notarealsku`, and `/guides/nope` all return **404**; `/` returns 200. No code changed. |

### 2.3 as built

Day-14 post-delivery review request, plus the page it has to land on — an email asking for a review is worthless without somewhere to write one, and `submitReview()` existed with no caller.

- `supabase/migrations/022_review_requests.sql` — adds `fulfilled_at` and `review_request_sent_at`. Neither existed, so "14 days after delivery" was not expressible. `advance_fulfillment` now stamps `fulfilled_at` on the first transition to `delivered`/`picked_up`, and `coalesce` keeps the original handover time if staff re-save.
- `dispatchReviewRequests()` in `lib/backend/lifecycle.ts`, wired into the existing hourly cron at `/api/lifecycle/dispatch`. Rows predating the migration have a null `fulfilled_at` and are skipped **on purpose** — back-filling would mail the entire order history on the first run.
- `/review` page + `/api/reviews` (rate limited, 5 per 5 min). Product title is resolved from the catalog, never from the URL.

Honouring "do not seed `AggregateRating`": nothing here publishes. Submissions land as `pending` for a human, and `reviews.ts` still suppresses aggregate schema until real reviews exist.

### Not done

**Phase 1 policy wording.** The pages exist; whether their terms are the ones Summit will honour is a question for a human with authority over policy, per the plan's own warning. Unreviewed.

---

## What the re-verification changed

Four of the original findings did not survive a closer look. Recording this because the plan is smaller than the audit implied, and because it shows which claims were grep artefacts rather than defects.

| Original claim | Verdict after re-check |
|---|---|
| Focus-visible + reduced-motion "near-absent" | **Retracted.** Both correctly implemented globally at `globals.css:89-103`. Grep counts were low *because* one `:where()` rule covers everything. |
| `priority` used 12 times | **Corrected to 7.** Three hits were components' own pass-through prop declarations. |
| "No FAQ, warranty unaddressed" | **Corrected.** FAQ exists at `/resources` and already covers warranty and delivery/pickup. |
| RLS fix is risky | **Corrected — it is zero-risk.** All five tables are server-only via service role, which bypasses RLS. |

Two findings got *stronger*:

- **Returns content does not exist anywhere.** `30-day|restocking|refund|return window|freight damage` → zero matches across the codebase. Not "hard to find" — absent.
- **The RLS fix is safe to ship immediately.** No client code touches those tables, so enabling RLS cannot break a working path.

---

## Phase 0 — Ship before the next deploy (security, ~2 hours)

These two are live defects. Neither is a feature; both are wrong defaults.

**0.1 — Enable RLS on the five migration-007 tables.** New migration `008_storefront_growth_rls.sql`. `saved_lists`, `cart_snapshots`, `chat_transcripts` scope to `auth.uid()`; `back_in_stock_subscriptions` anon-insert with no anon select (emails must not be readable); `site_events` anon-insert, staff-read via the existing `current_profile_role()` helper. Follow the policy style already in `001` and `003`.
*Verification:* with the anon key only, confirm `select * from saved_lists` returns zero rows; confirm saved-lists, chat, notify-me, cart-snapshot and events flows still work in-app.

**0.2 — Make the admin gate fail closed.** `admin/layout.tsx:13` and `middleware.ts:17` both skip auth when Supabase env vars are absent. Invert: deny by default, and put the local-demo escape hatch behind an explicit `ALLOW_UNAUTHENTICATED_ADMIN=true`. Add the `role === 'staff'` check to the middleware gate, which currently passes any logged-in user.
*Verification:* staff user reaches `/admin`; a homeowner account is redirected; anonymous is redirected; unset the env vars and confirm `/admin` now denies instead of rendering.

Both are already queued as one-click background tasks.

---

## Phase 1 — Trust content (highest revenue impact, ~1 week, mostly writing)

This is the single biggest lever on conversion and it is barely an engineering task.

**1.1 — Write the returns policy.** The one genuinely absent piece. Must answer, in freight-specific terms: the LTL damage inspection window, who pays return freight on a 200lb condenser, restocking fee, what happens to a unit that arrives damaged, and whether an installed unit can be returned at all. Vague language here is worse than none — a homeowner reading hedged terms assumes the worst case.

**1.2 — Privacy policy and terms of service.** Legal exposure, not UX. California business, Stripe merchant. Confirm CCPA threshold applicability with counsel rather than assuming.

**1.3 — Shipping page.** Will-call windows, Bay Area delivery radius, freight lead times. Much of this already exists as prose in the `/resources` FAQ and on checkout — consolidate it into an addressable page rather than writing from scratch.

**1.4 — Surface it where the decision happens.** A returns/warranty line near the buy button on the PDP, not only in the footer. Currently "Return" appears zero times on a product page asking for $2,400. Add the six pages to the footer, which today has six links and none of them policy.

**Dependency:** 1.4 needs 1.1 written first. 1.1-1.3 can run in parallel and need a human with authority over actual policy — do not let an agent invent return terms.

---

## Phase 2 — Conversion and performance (~3-4 days engineering)

**2.1 — Narrow the middleware matcher** to `/admin/:path*`, `/portal/:path*`, `/checkout/:path*`. Today it runs `supabase.auth.getUser()` — a network round-trip — on every homepage and PDP request, paying remote-auth latency in TTFB on exactly the pages where speed converts. XS effort, measurable LCP win.

**2.2 — Server-render the checkout shell.** `/checkout` currently returns nav and footer only; the entire 511-line form mounts client-side. With JS failed it is a blank page at the highest-anxiety step, and an empty cart is indistinguishable from a broken one. Server-render headings, step scaffolding, and a `<noscript>` with the will-call number.

**2.3 — Start earning reviews.** Zero social proof on PDPs against Amazon and SupplyHouse. The `lifecycle` module already exists — add a day-14 post-delivery review request. Keep `reviews.ts` suppressing `AggregateRating` until real reviews exist; that restraint is correct and should not be traded for short-term schema gains. Honest interim substitutes: units shipped, years in business, named local contractor references.

---

## Phase 3 — Cleanup (~half a day)

**3.1 — Chat widget keyboard operability.** `chat-widget.tsx:118` declares `role="dialog"` with no Escape handler and no focus trap. Port the pattern from `quote-drawer.tsx`, which already does it correctly (Escape at :26, focus cycling at :38-41, focus restore at :49). XS.

**3.2 — `priority` → `preload`** at the 7 real call sites. Cosmetic now, but it sits on the LCP image path and will break on a future Next upgrade.

**3.3 — Settle the soft-404 question.** Unknown URLs and invalid SKUs return HTTP 200 in dev. `notFound()` *is* called, so this may be dev-server streaming behaviour. Run `next build && next start`, curl `/fake-xyz123`, and only act if it reproduces. Two minutes to resolve; do not fix speculatively.

---

## Sequencing

```
Phase 0  ██                          security — before next deploy
Phase 1  ░░████████████              content — start immediately, human-authored, longest pole
Phase 2      ░░░░████████            engineering — parallel with Phase 1
Phase 3              ░░░░██          cleanup — whenever
```

Phase 1 is the long pole and needs a human, so start it on day one even though Phase 0 ships first. Phases 1 and 2 have no shared files and can run concurrently.

## What not to do

- **Do not add fabricated reviews or seed `AggregateRating`.** The current suppression is deliberate and correct under FTC endorsement rules. It costs conversion today and is still the right call.
- **Do not "fix" focus-visible or reduced-motion.** They are correctly implemented. Changing `globals.css:89-103` would regress working accessibility.
- **Do not redesign anything.** The token discipline (one hardcoded hex across 65 files), image handling (zero raw `<img>`), and structured data are genuine assets. The problems here are absent content and two inverted defaults, not visual design.
