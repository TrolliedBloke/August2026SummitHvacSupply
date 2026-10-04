# UX fix plan: decision log and state matrix

Companion to `DESIGN-UX-FIX-PLAN-2026-10.md` (WS-0). Started 2026-10-04.
When this log and an older plan disagree, this log wins for the item it names;
route-level acceptance criteria stay in `DESIGN-REMEDIATION-PLAN.md`.

## Progress

| Workstream | State | Where |
|---|---|---|
| WS-0 Baseline and decisions | Done | This file; metrics below |
| WS-1 Commerce state system | Already in place | `src/lib/commerce/state.ts` (D-01) |
| WS-2 Product media trust | Done | D-02 to D-05, D-10; `npm run catalog:media` |
| WS-3 Catalog decision flow | Done | D-11; `catalog-tasks.ts`, `compatibility.ts`, `rankBySearch` |
| WS-4 Product-detail decision surface | Done | D-12; product page |
| WS-5 Finder and request flows | Done | D-13; `WhatHappensNext`, finder recap |
| WS-6 Resources and tools | Done | D-14 |
| WS-7 Shell, tokens, assistance | Done | Shell variants and chat policy (earlier session); D-08, D-09 |
| WS-8 Screenshot and release QA | Done | D-06, D-15; `tests/e2e/ux-fix.spec.ts`, `npm run qa:*` |

## Decisions

### D-01: WS-1 extends the existing CommerceState; no new contract

The plan asks for a server-derived `CommercePresentation` with five kinds. That
already exists as `resolveCommerceState` and `presentCommerceState`, with the
same five kinds (`purchasable`, `quoteRequired`, `availabilityRequired`,
`unavailable`, `pricingUnavailable`). The card, product page, purchase panel,
sticky buy bar, add-to-quote control, quote drawer (through the session
projection) and checkout snapshot all render from it. The server re-resolves
every line at checkout, so client or local-storage state cannot promote a line.

Building a second contract would be the "competing component system" the plan
forbids. Remaining WS-1 gaps, carried into Phase 2:

- The card shows `statusLabel` and `statusDetail`, but the product page splits
  price, `AccountPrice` and `CommerceStatusLine` into three blocks. A single
  `CommerceStateBlock` belongs in WS-4's `ProductDecisionPanel`.
- The audit's proposed labels (`Ready to request`, `Price confirmed`) are not
  adopted. The current labels name the next action and are already covered by
  tests. Revisit only with usability evidence.

### D-02: Exact-model media means no other model uses the file

The import marks an image `verified` when a manufacturer image was found for the
product line. The storefront read that as "verified against this model". 37 of
the 56 verified records share their file with a different model number (for
example, one Carrier FJ5 photo for the 36, 48 and 60 kBTU air handlers), and the
product page said "Manufacturer media verified against model X" on all of them.

`src/lib/media-verification.ts` now classifies every record once:

| State | Rule | Card | Product page |
|---|---|---|---|
| `verifiedExact` | Manufacturer media used by this model number only | Image | Image; "Manufacturer image matched to model X." |
| `verifiedFamily` | Shared with another model, flagged family, or no model number | Image + "Representative" label | Image + label; explains it is not specific to model X |
| `reference` | Unverified supplier or reference photos only | Image + "Reference photo" label | Image + label; "not verified against model X" |
| `missing` | Nothing usable, including wrong-component files (D-03) | Neutral frame, "No verified image" | Frame, "No verified photo of model X yet" |
| `loading` / `failed` | Runtime only, per image | `data-media-state` | Retry, then a fallback |

The existing manufacturer-backed sharing groups in
`data/catalog/exact-media.json` are still valid as provenance. They now show as
family images, because a manufacturer photo of a cabinet that "varies by
capacity" is not a photo of this capacity. `imageExactModel` and the About-page
count now mean exact. Category tiles accept family images, because a tile names
a product line, not a model.

### D-03: Wrong-component images are withheld, not labelled

Six records showed a photo of a different component: an indoor wall head on four
outdoor units (TCL09KODU, TCL12KODU, TCL18KODU-R-410A, TCL18KMZODU-R-410A) and a
condenser on two air handlers (TCL48KAHU, TCL60KAHU). A "Representative" label
would still mislead, so these records show the `missing` state until a correct
photo is mapped. Detection uses file names, which are the only provenance the
import kept. It is a guard, not a proof, and the report lists every hit for
review.

Consequence: these six no longer pass the SEO gate's "manufacturer product
image" requirement, so they drop out of indexable pages until fixed. A wrong
image on an indexed page is the worse outcome.

**Owner:** catalog/content. The source was owner-supplied media dated
2026-08-13 (`owner-supplied-tcl-tpro-wall-head`, `owner-supplied-tcl-48k-condenser`,
`owner-supplied-tcl-60k-condenser`).

### D-04: Add `reference` as a fourth catalog media state

The plan lists `verifiedExact`, `verifiedFamily` and `missing`. Five records
(the TOSOT cassettes and one line set) have only unverified reference photos.
The product page showed them while the card showed nothing, so the two surfaces
disagreed. They now share one `reference` state with a visible label on both.

### D-05: State is conveyed in words

Every non-exact image carries a text label on the frame, and the product page
states the evidence in a sentence. Nothing depends on color or hover. Frames
expose `data-media-state` for tests and capture.

### D-06: Captures record what the DOM shows

`scripts/capture-ui.mjs` scrolls the page once so lazy images start loading. It
then waits until no frame reports `loading`, and writes the visible heading,
shell variant, media states, commerce states and skeleton count next to every
file. A capture is `ready: false` while any frame is loading or a skeleton is
visible. The run prints those files, so the review can filter on DOM evidence
instead of file names.

### D-08: Chrome green is a named exception; weights are 400/500

`THEME.md` reserves green for "yes". The commerce shell's utility strip and
the footer were deep green: the footer from hard-coded hex values and a
gradient, which THEME.md also forbids. Both now use one `--chrome` token,
documented as the only green surface. It is never used for an action or a
status. The search button keeps `--green-deep` as its hover.

Headings used 600 in 171 places against THEME.md's 400/500 rule. Tailwind's
`--font-weight-semibold` and `--font-weight-bold` now resolve to
`--weight-strong` (500) in `tokens.css`, so every call site follows the
contract without being edited. To revert, delete those two lines.

### D-09: Deprecated aliases are ratcheted, not deleted

Fourteen compatibility aliases now resolve to the same value as another
token, for example `--line-strong` equals `--line` and `--copper` equals ink.
Their names promise a distinction the design no longer makes. Deleting them
would touch about 200 call sites. Instead, `tokens.css` marks each one
deprecated and names its replacement, and `tests/tokens.test.ts` fails if
their use grows past 202. Lower the budget as call sites migrate.

### D-10: Media can be reviewed by eye, and review only lowers confidence

A contact-sheet review of every displayed photo found what file names can't
show:

- **Wrong subject, withheld:**
  - TCL24KODU: an outdoor unit whose photo is an indoor wall head.
  - DCT414: an instruction-manual diagram standing in for the thermometer.
- **Labelled exact, but showing a whole system or kit:** six photos, now shown as family images.

Verdicts live in `data/catalog/media-review.json` with a reason and a date.
`classifyMedia` applies them after the automatic rules, and a review can
never raise a record above what the rules allow.

### D-11: The catalog starts from the job, then the facets

- A `task` (`model`, `system`, `component`, `parts`) is part of the same URL codec as the facets.
- It narrows the categories in play and the facets shown, in the order that matters for that job.
- It is a mode, not a chip: clearing filters keeps it, and switching task drops a category the new task cannot reach.

"Most relevant" with a query now ranks by match strength. Before this, an
exact SKU hit could sit below a description match. Every result says why it
matched, worded from the same tiers that ranked it.

Compatibility notes appear only when the results invite a mistake: mixed
refrigerants, or indoor and outdoor halves side by side. They never claim
that two products are compatible.

### D-12: The product page is a decision panel plus evidence

- **Decision panel:** identity, commerce state, compatibility confidence, fulfillment, the action and the trade-account link. It sits in its own column, sticky from `lg` (scrolls inside itself if taller than the screen).
- **Evidence:** Overview, Compatibility, Specifications, Documents and Warranty, built from configuration with deep links.
- **Missing evidence:** a sentence, not a blank region.

Compatibility confidence has four levels, strongest evidence first: an
AHRI-matched pair, a pairing or bundle listed on Summit's own sheet, "not
established", and "check fit" for parts. Related items are now "Nearby
catalog items". The unused `StickyBuyBar` is now the phone action bar.

### D-13: Request flows lead with the form

- **"What happens next":** one shared panel replaces hero images and preamble paragraphs. Its wording avoids promising response times or fees that operations has not approved.
- **Quote:** the optional ZIP and needed-by date sit behind a disclosure that opens itself when they hold a value or an error.
- **Contact:** the homeowner callout shrank to one line.
- **Dealers:** the hero image went. The testimonials and the checklist moved beside the form on desktop and collapse on phones. A "buying one part? no account needed" path was added.
- **Finder:** shows a per-path result contract, a recap with Change links, and labels the homeowner result "Starting recommendation".

### D-14: Resources name their action; tools hand back to a task

Every resource card shows a typed action before the click: Read guide, Open
tool, Download PDF, or Open (source). Previously, external and document
cards had no visible action. Every tool page ends with a next step back into
the catalog, the finder, a quote or the counter (`TOOL_NEXT_STEP`).

### D-15: Release checks assert visible state

`tests/e2e/ux-fix.spec.ts` covers media, catalog, product page, finder, forms,
tools, weights and the chat policy through DOM markers. Streamed content
briefly exists twice, as the hidden holder plus the swapped-in copy, so the
spec waits for `load` and asserts a count of one.

The capture's `settle()` awaited `img.decode()` on lazy images that never
start loading, which is why the earlier full capture hung on its first route.
It now scrolls the page first, caps the decode wait, and logs each route.

- `npm run qa:review` builds a contact sheet from the manifest's DOM state.
- `npm run qa:first-action` measures how far down the page the first action sits.

## Baseline metrics (2026-10-04)

| Metric | Value | Source |
|---|---|---|
| Published records | 100 | catalog |
| Exact-model media | 9 (was claimed: 56) | `npm run catalog:media` |
| Labelled family media | 39 | same |
| Unverified reference | 5 | same |
| No image | 47, including 8 withheld wrong-subject photos | same |
| Commerce kinds rendered from one resolver | 5 of 5 | D-01 |
| Unit and integration tests | 201 passing | `npm test` |
| End-to-end tests | 44 passing (new spec 15 × 4 repeats stable) | `npx playwright test` |
| Computed font weights on page | 400, 500 (was 400, 500, 600) | e2e "system" |

First meaningful control, CSS px from the top (`npm run qa:first-action`, dev
server). The first viewport is 844 on phones and 900 on desktop:

| Route | Phone | Desktop | Shell |
|---|---:|---:|---|
| /quote | 523 | 503 | service |
| /contact | 455 | 451 | service |
| /dealers | 703 (was 1139) | 609 (was 955) | service |
| /finder | 421 | 425 | service |
| /portal/login | 376 | 388 | focused |
| /products | 587 | 613 | commerce |
| 404 | 375 | 469 | commerce |

Header height: 65 px (phone) and 125 px (desktop) on service routes; 77 px
on focused desktop routes; 129 px and 207 px on commerce routes.

## Open items

- **Catalog/content:** replace the eight withheld photos and source exact-model photography in the order listed in `MEDIA-COVERAGE.md`. Remove a `media-review.json` entry once its photo is fixed.
- **404 shell:** the 404 page renders in the commerce shell, because the shell is chosen from the pathname and a 404 has no special path. A `focused` 404 needs the variant passed from `not-found.tsx`.
- **Token migration:** move the 202 deprecated-alias call sites to their replacements and lower the budget in `tests/tokens.test.ts`.
- **Release gates:** manual keyboard and screen-reader acceptance, plus the operational, content and counsel approvals in `DESIGN-REMEDIATION-STATUS.md`. None are waived.
- **Still unmeasured:** catalog filter apply, cancel and abandonment rates; finder step abandonment. These need production analytics. The `catalog_task` event now records task choice.
