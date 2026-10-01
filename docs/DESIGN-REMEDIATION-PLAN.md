# Design Remediation Plan

## Scope and execution rule

This plan maps every item in the supplied UI critique to the implementation in this repository. The repository is the source of truth where the critique and the current product disagree. Each numbered item is an independent implementation unit and must pass its validation gate before work starts on the next item.

Baseline on 2026-09-30:

- `npm test`: 93 tests pass.
- `npm run lint`: passes.
- `npm run test:e2e`: 14 pass and 2 fail. Both failures are stale expectations in `tests/e2e/landing.spec.ts`: the delivery card now has a dynamic arrival label, and the audience selector is now a radio group rather than the links the test expects.
- The current design-token layer in `src/styles/tokens.css` has color aliases and a global focus ring, but no complete contract for spacing, control sizes, validation, loading, empty, or commerce states. Each fix below should introduce only the tokens needed by that component; reusable state tokens should then become the shared contract for later items.

## 01 — Home audience selector

**Current implementation**

`src/components/home/price-audience.tsx` stores `homeowner` or `contractor` in page-local React state and renders the options as a radio group. The component's own comment states that the selection does not change prices. It does not authenticate a contractor, request approval, update catalog data, or persist across navigation. The adjacent copy nevertheless describes contractor net pricing. This makes the control look like a pricing mode while behaving as an inert content toggle. The stale landing-page test still expects two navigation links, which confirms that the interaction contract has drifted.

**Fix**

Replace the pseudo-pricing switch with two explicit paths:

- “Shop retail” navigates to `/products`.
- “Contractor sign in” navigates to `/portal/login?next=/products`; a separate “Apply for an account” link can point to `/dealers`.

Do not store an audience selection as a global pricing override. Authorized pricing must come from the authenticated server-side profile and account, as detailed in F06. If the homepage needs to explain both audiences, use a two-card comparison or segmented navigation whose labels describe destinations, not price state. Add stable accessible names so dynamic secondary text does not become the link's only name. Update `tests/e2e/landing.spec.ts` to assert the new destination and copy.

**Why it works**

The change removes a state that has no business effect and makes each control's consequence explicit. Contractor pricing then has one authoritative source—authorization—so an unauthenticated visitor cannot accidentally opt into a visual state that checkout later contradicts.

**Validation**

- Unit-test that both actions render the correct href and that no audience state changes displayed prices.
- In Playwright, follow “Shop retail” and “Contractor sign in”; expect `/products` and the login flow with a safe `/products` return path.
- Test signed-out, homeowner, pending-dealer, and approved-dealer sessions. Only the approved dealer may receive account pricing, regardless of which homepage action was used.
- At 320 px and 200% zoom, labels must wrap without clipping and remain at least 44 by 44 CSS pixels.
- Screen-reader output must describe each destination without relying on surrounding paragraph text.

Gate: the two stale landing assertions are replaced, the full end-to-end suite is green, and there is no client audience state capable of changing price presentation.

## 02 — Catalog layout and states

**Current implementation**

`src/components/sku-catalog-client.tsx` receives the full SKU collection in the client, renders a fixed-width filter column beside a three-column desktop grid, uses a two-column mobile grid, and reveals products in increments of 24. `src/components/product-card.tsx` constrains names with `line-clamp-2` and a fixed minimum title height. `src/components/catalog-filters.tsx` truncates long option labels and suppresses groups with fewer than two options. A no-results view exists, but loading and fatal-error handling fall back to the generic app-level files `src/app/loading.tsx` and `src/app/error.tsx`; there is no catalog-specific partial-result state.

**Fix**

Refactor the layout contract without changing filter behavior yet:

- Use a responsive grid such as `minmax(min(100%, 15rem), 1fr)` with one product column at narrow widths, two only when the cards retain a tested minimum width, and three or four when space permits.
- Let product names wrap to a defined maximum number of lines and align card actions through grid rows rather than a fixed title height.
- Permit filter labels to wrap; keep counts in a non-shrinking column. Give custom selects fluid widths rather than a fixed utility width.
- Add route-level catalog loading, recoverable error, empty, and partial-data components with shared state tokens and clear retry behavior.
- Move pagination behind a catalog query boundary before catalog size becomes operationally large. The server contract should return items, total count, applied facets, and a cursor/page key; the UI may retain “Show more” initially.

**Why it works**

Intrinsic sizing protects the grid from translated labels and long product names. Explicit data states stop network and partial-catalog failures from collapsing into a generic whole-site experience. A paged query contract prevents the existing full-client dataset from becoming the next scaling bottleneck.

**Validation**

- Add component fixtures for one-word, 80-character, and CJK product/filter labels; expect no overlap, clipping, or action misalignment.
- Test 320, 768, 1024, and 1440 px widths plus 200% zoom; expect no horizontal page scroll.
- Test 0, 1, 24, 25, and at least 1,000 results. Counts and “Show more”/pagination behavior must remain correct.
- Simulate loading, timeout, complete error, and a response with some rejected records. Each state must be distinguishable and offer the appropriate retry.
- Run axe against the catalog and verify that card heading order, controls, and status messages are programmatically associated.

Gate: all content stress fixtures and data-state tests pass before filter-state behavior is changed in item 03.

## 03 — Filtered catalog state

**Current implementation**

The selected filters are URL-addressable and updates use `router.push(..., { scroll: false })`, which is a useful base. Most controls derive directly from `useSearchParams`, but the text query is initialized once with `useState(params.get("q"))` and does not reliably follow browser Back/Forward. Desktop and mobile controls write the URL immediately. In the mobile sheet, “Show results” only closes the sheet, so there is no real draft-versus-applied model; closing the sheet retains every change. Facet groups can disappear when the available set drops below two choices, and chip labels can fall back to raw values.

**Fix**

Create one typed filter codec with `parseCatalogFilters(searchParams)`, `normalizeCatalogFilters(filters, facets)`, and `serializeCatalogFilters(filters)`. Encode facet cardinality in that schema—brand remains multi-select, while the current non-brand facets remain single-select unless product requirements explicitly change them. Make the URL the sole applied state. Synchronize the search input whenever the parsed URL query changes.

For mobile, copy applied filters into a draft when the sheet opens. Changes update only the draft and a locally computed or server-returned preview count. “Apply” serializes the draft in one history entry; “Cancel,” Escape, and backdrop close discard it; “Clear” resets only the draft until Apply. Keep selected facet groups visible even if the current result set has only one remaining value. Give every removal chip an accessible name in the form “Remove Brand: Mitsubishi.”

**Why it works**

A single parser/serializer eliminates divergent filter semantics across chips, sidebar, mobile sheet, and browser history. Separating applied and draft state makes closing behavior predictable and prevents half-applied mobile searches. Keeping selected facets visible ensures users can always understand and undo the state that produced the result set.

**Validation**

- Unit-test round trips for empty, single-select, multi-brand, malformed, duplicate, and unknown query parameters.
- In Playwright, apply several filters, remove one chip, press Back and Forward, and reload. The URL, controls, chips, query text, and result count must agree at every step.
- On mobile, make changes and cancel via button, Escape, and backdrop; the URL/results must remain unchanged. Repeat with Apply; all draft changes must commit together.
- Select a value that leaves one option in its group; the group and selected value must remain visible and removable.
- Verify focus returns to the filter trigger and the product-list heading receives a polite result-count update without moving scroll unexpectedly.

Gate: URL round trips, history restoration, and mobile cancel/apply tests pass before downstream catalog commerce states are touched.

## 04 — Product price and availability

**Current implementation**

Price and stock are represented by loosely related fields such as `retailPrice`, `purchaseEligible`, and availability values. `src/app/products/sku/[sku]/page.tsx` renders pricing, stock, and the primary action in separate branches. `src/components/add-to-quote.tsx` changes its label across states but always adds an item to the same quote/cart context. A priced but non-purchasable item can retain a positive unit price. `src/components/quote-drawer.tsx` currently treats every positive-priced line as checkout-ready, ignoring `purchaseEligible`, so an item labeled “Check availability” can expose “Go to checkout” before the server eventually rejects it.

**Fix**

Introduce a server-derived discriminated union such as `CommerceState`:

- `purchasable`: authorized amount, currency, stock state, and permitted fulfillment methods.
- `quoteRequired`: optional indicative amount and reason.
- `availabilityRequired`: reason and inquiry action.
- `unavailable`: reason and permitted notification/action.
- `pricingUnavailable`: retry/support behavior.

Have one resolver build this state from catalog, account authorization, pricing, inventory, and fulfillment data. Render price, status, action, and assistive copy from the same state in the PDP, card, sticky buy bar, and drawer. Extend stored line items with an intent/state marker and migrate old local-storage records. Only `purchasable` lines may enter checkout; the other variants must create a quote, availability inquiry, or notification request as appropriate. Keep server validation authoritative.

**Why it works**

The union makes invalid combinations unrepresentable: a component can no longer independently decide that a positive number implies checkout eligibility. It also gives retail, wholesale, failure, quote, and stock states one reusable rendering and analytics contract.

**Validation**

- Add a resolver matrix covering priced/in-stock, priced/out-of-stock, priced/non-purchasable, quote-only, missing price, pricing failure, retail, and authorized trade states.
- For each state, snapshot or component-test the exact price label, inventory message, primary action, and destination.
- Load a legacy cart containing a positive-price non-purchasable line; expect migration to a quote/availability line and no checkout CTA.
- Tamper with client state to mark an unavailable line purchasable; expect the checkout API to reject it with a typed line error.
- Verify state changes are announced once and color is never the only differentiator.

Gate: no component infers purchase eligibility from price alone, and the full commerce-state matrix passes.

## 05 — Product media

**Current implementation**

`src/components/product-gallery.tsx` already provides thumbnail tabs, Arrow/Home/End keyboard handling, an Escape-capable focus-trapped modal, and focus return. Thumbnails are hidden on mobile, while the main image opens the same enlarged modal for every asset. The implementation has no explicit failed-image state, swipe gesture, live slide position, or distinction between preview and genuinely zoomable high-resolution media. `src/app/products/sku/[sku]/page.tsx` handles an empty image list separately, so zero-, one-, and many-image behavior is split across layers.

**Fix**

Define a normalized media item with stable `id`, source, intrinsic dimensions/aspect ratio, alt text, optional caption, asset type, and optional high-resolution source. Let one gallery own zero/one/many behavior. Reconcile the active item by stable ID when media changes. Add a bounded image fallback and retry state. Suppress thumbnail, arrow, slide-count, and zoom controls when they have no effect. On mobile, add horizontal swipe with a movement threshold and visible dots/count while preserving vertical page scrolling. Expose a polite “Image 2 of 4” status. Only show “View larger” or zoom when the source supports it.

**Why it works**

Stable media identity survives reordering and lazy-load failures. Conditional controls reduce false affordances, and the fallback prevents the gallery's fixed visual region from becoming a blank hole. Mobile gestures and position feedback restore the navigation that hiding thumbnails currently removes.

**Validation**

- Test 0, 1, and many images; landscape, portrait, and extreme aspect ratios; missing dimensions; a 404 image; and a low-resolution asset.
- Test thumbnail clicks and Arrow/Home/End. The active tab, image, caption, and live count must stay synchronized.
- Test touch swipes below and above threshold and a vertical gesture. Only intentional horizontal gestures may change images.
- Open and close the large view with pointer, Enter/Space, Escape, and backdrop. Focus must remain trapped, then return to the invoking control; body scroll position must be unchanged.
- With reduced motion enabled, transitions must be nonessential and non-disorienting.

Gate: all zero/one/many, failure, keyboard, and touch scenarios pass before brand imagery work begins.

## 06 — Brand cards

**Current implementation**

`src/app/brands/page.tsx` derives brand counts and product metadata from the catalog, but brand artwork is a hard-coded `BRAND_LOGOS` map and TCL/Tosot receive brand-specific rendering branches. Cards use a fixed media region and a fixed minimum height, so logos with different whitespace and aspect ratios receive inconsistent visual weight. Unknown brands can fall back to text, but there is no asset-normalization contract or scaling strategy for a much larger brand set.

**Fix**

Replace page-level brand branches with a typed brand registry containing a canonical key, display name, optional asset, intrinsic ratio, safe-area padding, alt strategy, and catalog href. Render every brand through one `BrandMark` and one flexible card layout. Normalize assets into the same optical box using contain sizing and registry-controlled padding; use a styled text monogram/name fallback when artwork is absent or fails. Remove fixed card minimum height and align card sections through intrinsic grid rows. Add search or alphabetical grouping only when a measured threshold, such as more than 12–16 brands, is reached.

**Why it works**

Optical normalization belongs to asset metadata, not one-off JSX branches. A generic card keeps future brands from adding page-specific debt, while threshold-based discovery avoids imposing search on today's smaller set.

**Validation**

- Fixture-test an unknown brand, a 40-character name, missing art, failed art, square art, and very wide/tall marks.
- Render 1, 4, 12, and 30 brands at target breakpoints; cards must remain aligned and all brands discoverable without an endless unstructured wall.
- Verify logo alt behavior does not duplicate the adjacent brand heading.
- Ensure every brand href is generated from a catalog-valid key and reaches a nonempty or intentionally empty landing state.

Gate: the page contains no brand-name conditionals, and all aspect-ratio/fallback fixtures pass.

## 07 — Resources

**Current implementation**

`src/app/resources/page.tsx` assembles separate rebate, tool, guide, and documented-product arrays and renders each section with its own assumptions. There is no unified resource type, query/filter contract, or responsive density rule. Long titles and metadata therefore compete for space, while link behavior—internal article, tool, document, or external destination—is inferred mainly from presentation.

**Fix**

Create a discriminated `ResourceItem` model for `guide`, `tool`, `document`, and `external` resources. Common fields should include ID, title, summary, type, topics, audience, updated date, and destination; document/external variants add file type, size, source, and open behavior. Adapt the current arrays into this model, then render a shared compact card/list component. Add text search and type/topic filters with URL state. Show visible labels such as “PDF, 1.2 MB,” “Interactive tool,” and “Opens in a new tab”; icons remain supplementary. On narrow screens, stack metadata deliberately rather than compressing desktop columns.

**Why it works**

Encoding semantics in data makes filtering, accessibility, analytics, and future ingestion consistent. Users can distinguish what will happen before activating a resource, and one responsive component absorbs title/metadata variation.

**Validation**

- Unit-test adapters for every resource variant and reject missing variant-specific fields.
- Stress-test 100-character titles, multi-line metadata, absent document metadata, and a resource with several topics at 320 px and 200% zoom.
- Verify filters/search round-trip through the URL, return a clear empty state, and preserve Back/Forward behavior.
- Keyboard and screen-reader tests must announce resource type and external/download behavior before activation.
- Simulate a missing document and failed external link; the UI must show an actionable unavailable state rather than a dead card.

Gate: every rendered resource comes through the typed model and interaction/accessibility tests pass.

## 08 — Guide structure

**Current implementation**

The critique describes question-and-answer, expandable, and completion states, but the current route `src/app/guides/[slug]/page.tsx` is a static article. `src/lib/seo/guides.ts` supplies headings, body text, and bullets, and the page has a sticky “Review record” panel. There are no accordions or progress controls to standardize. The real issue is navigation through long static content: sections have no stable IDs or generated table of contents.

**Fix**

Do not add completion, persistence, or accordion behavior to an informational article. Extend guide sections with stable, author-controlled IDs and optional source/reference metadata. Generate an “On this page” table of contents from those IDs: sticky on wide layouts and a compact disclosure at the top on mobile. Use ordinary anchor links that work without JavaScript. Progressive enhancement may mark the currently visible section with `IntersectionObserver`, but it must not imply completion. If editorial content later requires interactive questions, define that as a separate content block type instead of overloading every section.

**Why it works**

This addresses the actual navigation problem without inventing interaction semantics the content does not have. Stable anchors improve scanning, sharing, and search while keeping the article readable and functional with JavaScript disabled.

**Validation**

- Deep-link directly to each section hash; expect the correct heading to be visible below the sticky header and focusable when navigated programmatically.
- Disable JavaScript; all content and table-of-contents links must still work.
- Test Back/Forward across several section anchors and long translated headings.
- Screen-reader heading navigation must expose a coherent H1/H2 structure, and active-section styling must not be the only location cue.
- Verify no “completed,” expanded, or persistent progress state appears unless the content schema explicitly declares an interactive block.

Gate: static guide navigation passes with and without JavaScript; no false progress model is introduced.

## 09 — Model-number decoder

**Current implementation**

`src/components/seo-tool.tsx` normalizes case and strips non-alphanumeric characters before doing local substring matches, with a minimum query length and six-result cap. It already tolerates many spaces, slashes, and dashes, but exact and partial matches are not distinguished, OCR confusions are not explained, and errors do not say whether syntax, catalog coverage, or compatibility is the problem. `src/lib/storefront/cross-reference.ts` has a second normalizer, creating drift risk, and its verified cross-reference table is currently empty.

**Fix**

Move normalization and ranking into one shared model-identifier module. Return structured candidates with `matchType` and score: exact canonical SKU/model first, then exact normalized form, prefix, token-aware contains, and only then conservative edit-distance suggestions. Handle common OCR substitutions such as O/0 or I/1 as visible suggestions, never automatic compatibility claims. Return typed outcomes: invalid syntax/too short, no catalog coverage, ambiguous candidates, exact product match, and verified cross-reference match. Keep compatibility and substitution data separate and only label it verified when sourced in the cross-reference table. Add a “How to find the model number” path for unresolved searches.

**Why it works**

A single deterministic normalization contract avoids different answers across tools. Ranked, typed outcomes let users recover from messy input while protecting against the dangerous leap from textual similarity to equipment compatibility.

**Validation**

- Unit-test case, spaces, hyphens, slashes, suffixes, leading zeros, O/0 and I/1 OCR variants, very short input, and punctuation-only input.
- Test ambiguous prefixes and near-identical SKUs; exact matches must always outrank partials, and suggestions must be labeled as suggestions.
- Verify a fuzzy match never receives “compatible,” “replacement,” or “cross-reference” language without verified data.
- Test zero, one, and more than six candidates and keyboard traversal of the results.
- Compare decoder and cross-reference normalization outputs for the same corpus; they must be identical.

Gate: one normalizer serves all identifier entry points, and the ambiguity/OCR/compatibility suite passes.

## 10 — Delivery eligibility and policy

**Current implementation**

`src/app/delivery/page.tsx` is static explanatory content and contains comments identifying zones, cutoffs, and fees as unconfirmed placeholders. `src/lib/site.ts` duplicates unconfirmed fulfillment copy. Actual checkout eligibility and windows are computed separately in `src/lib/backend/fulfillment.ts`. As a result, marketing, branch, and checkout surfaces can disagree, and users must read policy prose before getting a ZIP/date answer. The landing end-to-end test also assumes a fixed “Next-day delivery” link name while the card now exposes a dynamic arrival phrase.

**Fix**

Establish one versioned fulfillment-policy source containing confirmed zones, branch timezone, cutoff rules, exception dates, fee rules, and fallback behavior. `src/lib/backend/fulfillment.ts` remains the authoritative calculator, while delivery, location, homepage, and checkout consume a safe projection of the same result. Put an explicit ZIP eligibility checker and its answer at the top of `/delivery`; show eligible methods, order-by time, earliest date, fee status, and next action. Keep legally required details and exceptions below. Remove or hide every placeholder claim until operations signs off. Give the homepage delivery link a stable accessible name with dynamic timing as secondary text.

**Why it works**

One calculator prevents copy and checkout from promising different service. Answer-first hierarchy supports the user's primary decision, while the versioned policy and explicit unknown state stop unconfirmed rules from masquerading as live operations.

**Validation**

- Create fixtures for eligible, ineligible, malformed, and unknown ZIPs; before/after cutoff; Friday/weekend; holiday closure; and daylight-saving transitions in the branch timezone.
- Assert identical method/date output from the delivery page projection and checkout resolver for each fixture.
- Simulate the policy store being unavailable; expect an honest “cannot confirm” state and contact/pickup fallback, not a guessed date.
- At 320 px and with a screen reader, the eligibility answer and next action must precede long policy text.
- Update the landing test to target the stable link label and separately assert the dynamic delivery detail.

Gate: operations-confirmed policy fixtures drive all delivery surfaces and the delivery/homepage/checkout consistency tests pass.

## 11 — Newark location

**Current implementation**

`src/app/locations/newark/page.tsx` hard-codes Monday–Friday hours in visible content and JSON-LD. `src/lib/branch-hours.ts` has another weekly-hours representation and status logic but no holiday or temporary-exception model. `src/lib/site.ts` and the mobile navigation repeat branch-hour language, including a fixed “open until 5 PM” message. The embedded map has a title and nearby text address, but live branch status can still contradict closures or special pickup rules.

**Fix**

Create one `Branch` model with address, coordinates, timezone, contacts, regular hours, fulfillment capabilities, and dated exceptions for holidays, temporary closures, and special pickup windows. Replace every hard-coded hours string and JSON-LD branch with projections from this model. Compute `open`, `closingSoon`, `closed`, and `exception` statuses using the branch timezone and display the effective date/reason when an exception applies. Keep the text address, phone, directions URL, and map fallback independent of the embed. Treat live status as unavailable rather than falling back to a false “open” claim when branch data cannot load.

**Why it works**

The branch becomes a domain entity rather than repeated copy. The same dated exception then updates the location page, structured data, header/mobile navigation, and fulfillment logic together, eliminating the most dangerous stale operational message.

**Validation**

- Unit-test before opening, during hours, closing soon, after close, weekend, holiday, temporary closure, and DST boundary times.
- Assert visible hours and `openingHoursSpecification`/exception structured data come from the same fixture.
- Verify the mobile menu and location hero report the same status at a fixed clock time.
- Block the map iframe and JavaScript; the address, phone, and direct directions link must still be usable.
- Test multiple pickup rules and an unavailable branch feed; no surface may say “open” without confirmed data.

Gate: all branch surfaces and structured data agree across the exception matrix.

## 12 — Local landing pages

**Current implementation**

`src/app/[local]/page.tsx` renders entries from the static `src/lib/local-pages.ts` map. The content makes locality-specific claims, while JSON-LD uses the same broad `SITE.serviceArea` for every locality. There is no ZIP eligibility or branch resolver. Some generated product links use category values such as `ductless` and `ducted`, which must be checked against the actual catalog filter vocabulary rather than assumed valid.

**Fix**

Give each local page structured data for locality identity, approved claims, service coverage type, eligible ZIPs or coverage resolver key, serving branch IDs, and claim/source review dates. Reuse the fulfillment resolver from item 10 for a user-entered ZIP; do not infer precise location without consent. Resolve zero, one, or multiple branches explicitly and show the appropriate next step. For out-of-area users, replace local promises with an honest quote/contact path. Generate JSON-LD `areaServed` from the page's approved coverage, not the global default. Validate every catalog href against the catalog taxonomy during build/test.

**Why it works**

Structured, reviewable claims stop SEO page copy from drifting beyond operational coverage. Explicit ZIP and branch resolution handles overlap and outside-area cases before a user invests in an inquiry, while build-time link validation prevents dead filtered catalogs.

**Validation**

- Test a ZIP inside one branch, inside overlapping branches, outside all coverage, malformed, and temporarily unknown.
- Assert the visible coverage statement, selected branch, fulfillment result, and JSON-LD describe the same geography.
- Build-test every `local-pages.ts` product/category href and fail on unknown filter keys or empty unintended destinations.
- Verify the page remains useful without geolocation permission and never auto-selects a precise location the user did not provide.
- Test a new locality entry without page-specific JSX; it must render through the same schema.

Gate: coverage fixtures, JSON-LD consistency, and generated-link validation pass for every local page.

## 13 — Homeowner path

**Current implementation**

The critique assumes homeowners are sent through a contractor/account CTA, but `src/app/homeowners/page.tsx` is already a dedicated, plain-language path with `src/components/homeowner-request-form.tsx`. The remaining problem is operational: required project fields are serialized into a generic contact message and posted through the contact endpoint under `homeowner_one_system`. There is no homeowner-specific request schema, fulfillment/installation boundary, handoff status, or visible tracking after submission.

**Fix**

Keep the dedicated path and make the service boundary explicit before the form: what Summit supplies, whether installation is offered or referred, geographic limits, and what happens next. Create a typed homeowner request API/table with separate fields for ZIP, city, home type, zones, existing ducts, rebate interest, timeline, name, email, optional phone, and consent. Route the request to a configured owner/queue, record lifecycle events such as `received`, `needs_information`, `referred`, and `closed`, and return a request reference with an honest response window. Use homeowner-specific vocabulary rather than reusing trade-license/account fields.

**Why it works**

The existing audience separation is preserved, while structured data makes the request actionable and measurable. Explicit boundaries prevent users from assuming a supply inquiry includes installation, and a lifecycle record makes installer handoffs auditable instead of disappearing into generic contact text.

**Validation**

- Verify no license, tax ID, monthly volume, or other dealer field appears in the homeowner flow.
- Submit complete, incomplete, out-of-area, and duplicate requests; expect field-specific errors, an appropriate routing outcome, and no lost valid values.
- Assert all form values arrive as typed fields rather than a newline-concatenated message.
- Test consent and optional-phone behavior, queue assignment, lifecycle transitions, and the displayed response window.
- Have an operations owner confirm that the supply/installation copy and routing match the real service.

Gate: homeowner requests are structured, correctly routed, and traceable through the agreed lifecycle.

## 14 — Dealer application

**Current implementation**

`src/app/dealers/page.tsx` renders a three-step application and keeps values in a ref while steps unmount. It promises review within one business day. The backend schema permits license, service area, business type, and monthly volume to be absent even where the UI implies they are required. Applications enter `pending_review`, but applicants have no status surface. The current model also lacks explicit handling for different entity/tax structures, resale documentation, secure uploads, and duplicate submissions.

**Fix**

First obtain an operations-approved application contract and SLA. Model states explicitly—such as `draft`, `submitted`, `needs_information`, `under_review`, `approved`, `rejected`, and `withdrawn`—with reason codes and permitted transitions. Align client and server schemas field-for-field, including conditional requirements by business type and jurisdiction. Add entity name/type, tax identity, license applicability, service area, and resale-certificate metadata; add secure direct upload only if operations truly requires documents, with type/size scanning and retention rules. Show the checklist and SLA before step one. Persist a recoverable draft for the session, add an idempotency key, and route existing-email/duplicate-business submissions into recovery instead of creating a second application.

**Why it works**

The workflow stops being a visually required form backed by an optional server schema. Explicit states and transitions give applicants and staff the same understanding of approval, while conditional data and duplicate handling support real businesses without creating identity fragmentation.

**Validation**

- Step forward and backward repeatedly and refresh within the supported draft window; all entered values must survive.
- Test sole proprietor, corporation, tax-exempt/resale, no-license-applicable, and required-license scenarios against the same shared schema.
- Submit the same idempotency key twice and the same email/business through a new session; expect one application and a recovery/status path.
- If uploads are enabled, test allowed/blocked types, size limits, malware rejection, interrupted upload, authorization, and deletion/retention.
- Exercise every allowed and forbidden status transition and verify applicant copy and staff audit events.

Gate: UI/server requirements match exactly, duplicate submission is safe, and the approved state-transition matrix passes.

## 15 — About page trust hierarchy

**Current implementation**

`src/app/about/page.tsx` leads with a large warehouse image and editorial story, then places operational pillars and contact/location proof lower on the page. The image uses the standard Next image path without a page-specific failure treatment. Claims are hand-authored rather than tied to catalog, branch, fulfillment, or document-verification sources.

**Fix**

Move a concise operational proof block into or immediately after the hero: live catalog scope, Newark branch status, supported fulfillment methods, verified-document practice, and a direct contact/location action. Source each dynamic fact from the established catalog/branch/fulfillment models and give evergreen editorial claims an owner and review date. Keep the story secondary. Render hero media through a resilient media component with meaningful alt text when informative and a designed neutral fallback when unavailable. Put localized copy into a structured content schema so longer strings do not require JSX changes.

**Why it works**

First-time buyers receive verifiable evidence before brand narrative, and operational claims update with the systems that make them true. A media fallback prevents trust content from depending on one decorative asset.

**Validation**

- Compare every displayed dynamic proof point with its source fixture; no independently typed count, hours string, or fulfillment claim may remain.
- Fail the hero image and disable images entirely; the value proposition and actions must retain hierarchy and spacing.
- Test long localized headings and proof labels at 320 px, 200% zoom, and a wide desktop.
- Test zero testimonials or optional proof modules; the layout must close gaps rather than leave empty regions.
- Have content/operations owners sign off each evergreen claim and review date.

Gate: operational claims are sourced or explicitly governed, and the image/localization stress tests pass.

## 16 — Contact routing

**Current implementation**

`src/app/contact/page.tsx` offers a topic dropdown, but the request stores only topic, name, email, and a generic message. It does not capture branch, product, order, or urgency as structured context, and URL context such as `?sku=` or `?topic=` is not consumed. Spam/rate-limit and bounded-body protections exist in the API, but there is no idempotency/duplicate strategy. There is also a concrete focus bug: a missing name focuses the email ref and scrolls the document to the bottom. Detailed error handling is addressed in F12.

**Fix**

Create a topic-routing configuration that defines owner queue, supported urgency, response window, and contextual fields for each topic. Extend the request schema with optional validated branch ID, canonical SKU/order reference, urgency, and source URL; prefill only allow-listed URL parameters and show them visibly. Add a client request ID/idempotency key and duplicate window on the server. Return a reference number and topic-specific expectation. Fix the immediate name-focus bug by assigning real refs/IDs to each field; F12 then supplies the complete error model. Never represent emergency service if the company does not provide it—urgent copy must offer the real phone/support path.

**Why it works**

Structured context lets support route and answer requests without parsing prose, while visible prefills keep URL-driven data from becoming a hidden surprise. Idempotency protects retries, and correct focus removes a high-friction accessibility defect without waiting for a form redesign.

**Validation**

- Open valid and tampered `topic`, `sku`, and branch query parameters; only allow-listed canonical values may prefill, and all must be visible/editable.
- Submit each topic and verify queue, SLA copy, structured payload, and reference number.
- Retry the same client request after a network timeout; expect one stored request and the same outcome.
- Test 400, 429, and 500 responses; entered values remain and the correct recovery message appears.
- Submit with a missing name; focus must move to the name control with no forced scroll to the document bottom.

Gate: routing, prefills, idempotent retries, and the focus regression test pass.

## 17 — Quote request

**Current implementation**

`src/app/quote/page.tsx` combines four generic contact fields with cart/quote lines. The API bounds line count and server services canonicalize or reject invalid SKUs, but the page offers little row-level correction, no verified compatibility assessment, no attachment path, and only a broad post-submit outcome. Vague free text can therefore reach staff without the quantities, product evidence, or equipment context needed to quote it.

**Fix**

Define a typed quote draft with requester/contact data, branch/ZIP, project type, requested date, notes, and editable line items containing canonical SKU, quantity, intent, and validation state. Validate and merge lines on the server. Surface compatibility only from verified rules; unknown combinations receive a review warning, not a guessed incompatibility claim. If photos/nameplates are operationally useful, add signed direct uploads with explicit file types, size limits, malware scanning, authorization, retention, and attachment status. Return a quote reference, state (`received`, `needs_information`, `in_review`, `quoted`, etc.), response window, and status/recovery link.

**Why it works**

The form collects information in the shape staff actually uses, and server canonicalization becomes visible rather than a hidden rejection. Verified-only compatibility protects users from false technical advice, while a lifecycle result gives them a concrete next step.

**Validation**

- Test no lines plus a detailed project description, valid lines, invalid SKUs, duplicate SKUs, zero/negative/oversized quantities, and 101 lines.
- Test verified compatible, verified incompatible, and unknown combinations; only sourced rules may issue definitive compatibility language.
- Test mixed purchasable, quote-only, and unavailable lines and confirm each retains its intent/status.
- If attachments are enabled, test file type/size, malware, interrupted upload, unauthorized access, and cleanup after abandonment.
- Retry an identical submit after timeout; expect one quote, one reference, preserved values, and a clear lifecycle state.

Gate: every accepted quote is operationally actionable or explicitly marked `needs_information`, with all line/attachment/idempotency tests passing.

## 18 — Account identity and wholesale access

**Current implementation**

`src/app/account/page.tsx` visually separates retail account creation from wholesale application. Authentication uses one Supabase user and `user_profiles` with a role and optional account ID. Dealer applications are separate records keyed by application data/email, and there is no guaranteed transaction linking an approved application to the existing user/profile. Pending approval is therefore not a first-class signed-in account state. The global navigation is also rendered without session/profile data, which F02 addresses.

**Fix**

Keep one canonical person identity per normalized email. Add an explicit relationship between dealer application, auth user/profile, and business account. On approval, use one idempotent transaction to create or link the business account, membership/profile role, price tier, and audit event. Represent pending, needs-information, approved, suspended, and rejected access separately from authentication. If a real requirement for one user in multiple businesses is confirmed, introduce `account_memberships` and a deliberate account switcher; do not simulate contexts with duplicate users or a client audience toggle.

**Why it works**

Authentication answers who the person is, while membership/application status answers what they may access. Separating those concepts allows an existing retail user to apply for trade access without creating another identity and makes approval transitions safe and auditable.

**Validation**

- Test a new retail user, an existing retail user applying for wholesale, an invite to an existing business, approval, suspension, rejection, and reapplication.
- Normalize case/whitespace and submit the same email through different paths; expect one identity and the appropriate linked application.
- Run approval twice; expect one account/membership and one effective authorization transition.
- Verify each role/status routes to the correct portal state and cannot read another account's prices, orders, or application.
- If multi-account membership is implemented, test explicit switching, cache invalidation, and audit attribution; otherwise verify no switcher appears.

Gate: the identity/application/account relationship is enforced by schema and transaction tests before registration changes begin.

## 19 — Account creation

**Current implementation**

`src/components/retail-signup-form.tsx` relies on native required/min-length constraints and one form-level error. `src/lib/backend/auth-actions.ts` repeats manual checks, returns broad results, and can expose raw Supabase error messages. Password guidance is only “at least 8 characters.” Field errors are not programmatically linked, and a failed submit does not have a typed contract for preserving valid fields and focusing the actual problem.

**Fix**

Create one shared signup/password schema, preferably with Zod already aligned to the server toolchain, and infer the client field model from it. Return a safe discriminated `AuthResult` with `fieldErrors`, `formError`, and success state; never pass provider messages directly to the browser. Show password rules before submit and update their status as the user types. Add stable IDs, `aria-invalid`, `aria-describedby`, a summary for multi-field/server errors, and focus the first invalid field. Preserve non-secret values; decide explicitly whether the password remains in memory after a recoverable validation failure. Treat an existing email with account-safe language and offer sign-in/recovery.

**Why it works**

One schema removes client/server disagreement and catches correctable errors before a network round trip. Typed safe errors protect account privacy and let assistive technology connect each message to the field that caused it.

**Validation**

- Unit-test empty/long names, malformed email, mixed-case email, every password rule, duplicate email, and provider outage.
- Confirm client and server accept/reject the same fixture corpus.
- Submit multiple invalid fields; each must expose one associated message, and focus must move to the first invalid control without losing valid values.
- Inspect responses and rendered HTML to ensure no raw provider code/message or account-existence leak appears.
- Test keyboard-only and screen-reader operation at 320 px and 200% zoom.

Gate: shared-schema parity, safe-error, preservation, and accessibility tests pass.

## 20 — Check-email verification

**Current implementation**

`src/app/account/check-email/page.tsx` is a static confirmation message with no resend, address correction, or expired-link recovery. More fundamentally, local Supabase configuration has `enable_confirmations = false`, and no callback/verification route was found. The signup action still sends users without a session to this page. The current UX therefore describes a lifecycle that may not exist in the configured environment.

**Fix**

Make an explicit product/security decision before coding. The recommended production path is to enable email confirmation and implement an `/auth/callback` handler that exchanges/verifies the provider token and routes through a safe `next` value. Store the pending email in a short-lived signed/HttpOnly mechanism or server session—not in a public query string. Add resend with IP and normalized-email throttles, a visible cooldown, a uniform response for all addresses, a change-email/restart path, and an expired-token recovery state. If confirmation is intentionally disabled in production, remove the check-email redirect/page from signup instead of maintaining a fictional state.

**Why it works**

The UI becomes a projection of the real auth policy. The recommended callback/resend flow gives users a recoverable path while uniform responses and server-held pending context avoid account enumeration and email leakage.

**Validation**

- In an environment matching production config, test signup responses that include a session and those awaiting confirmation; each must route to a valid state.
- Test valid, expired, malformed, reused, and wrong-browser/device links and a callback provider error.
- Test resend before and after cooldown, repeated addresses, unknown addresses, and IP limits; body/status copy must not reveal account existence.
- Refresh the check-email page and use Back/Forward; pending context and recovery actions must remain coherent without email in the URL.
- If confirmation is disabled, assert signup never routes to `/account/check-email` and the dead page is removed or redirects safely.

Gate: the deployed auth configuration and user-visible verification flow agree, with callback and enumeration tests passing.

## 21 — Portal login and authorization states

**Current implementation**

`src/components/login-form.tsx` intentionally uses a generic invalid-email/password message, which is correct for credential privacy. After authentication, `src/app/portal/page.tsx` routes by profile role. `getSessionProfile` can return null when the auth user exists but the profile is missing or not yet linked, sending a validly authenticated person back toward login without explaining the authorization/account-state problem. MFA is not represented, and continuation across checkout/quote depends on the same session but is not explicitly tested.

**Fix**

Preserve generic credential failure. After successful authentication, resolve a typed portal-access state: `ready(role)`, `pendingApplication`, `needsInformation`, `profileMissing`, `disabled`, or `unauthorized`. Route those states to dedicated signed-in explanations and recovery/support actions rather than presenting another login failure. Validate `next` through `src/lib/safe-redirect.ts` and preserve it only when the destination is allowed for the resulting role. Evaluate MFA as a separate business/security requirement; if required for staff or trade accounts, add enrollment/challenge/recovery states rather than a single boolean gate.

**Why it works**

Credential secrecy is maintained while authenticated users receive accurate authorization guidance. A typed post-login resolver also prevents redirect loops and gives MFA or pending approval a place in the state model without conflating them with a wrong password.

**Validation**

- Wrong password and unknown email must return the same visible response and comparable response envelope.
- Test valid sessions with missing profile, pending application, needs information, homeowner, approved dealer, staff, and disabled states; each must reach its specific destination without loops.
- Test safe, unsafe external, malformed, and role-forbidden `next` values.
- Start login from quote and checkout, complete it, and confirm the session and safe return context survive.
- If MFA is enabled, test challenge, backup recovery, cancellation, and role-specific enforcement.

Gate: the full authentication-versus-authorization state matrix routes deterministically with no generic-login loop.

## 22 — Forgot-password request

**Current implementation**

`src/components/password-reset-forms.tsx` and `src/lib/backend/auth-actions.ts` already return the same generic success message whether an email is recognized, and provider reset links are expected to be single-use/expiring. However, the action comments imply rate limiting without an app-level rate limiter around this path. Provider calls may also produce measurable timing differences. Users can resubmit the form, but there is no explicit cooldown or audited resend state.

**Fix**

Put reset requests behind a bounded server action/route using the existing rate-limit infrastructure with both IP and normalized-email-hash buckets. Keep a constant public response shape/status and introduce a reasonable minimum response envelope or jitter so obvious account/non-account timing does not leak identity. Add a visible resend cooldown and let the same form correct a mistyped address. Log security events with hashes/IDs rather than raw email. Keep token expiry and one-time consumption in the auth provider, but document and test the configured values.

**Why it works**

The existing enumeration-safe copy becomes enumeration-resistant at the transport and timing layers as well. Explicit cooldown/retry behavior gives legitimate users a self-service path without allowing unbounded mail abuse.

**Validation**

- Compare known, unknown, malformed-but-client-bypassed, and provider-failure requests; public status/body must be indistinguishable and timing must remain within the agreed tolerance.
- Test IP and email-hash rate limits independently and verify `Retry-After`/cooldown behavior without exposing which threshold was hit.
- Request several links; verify configured single-use and supersession behavior, then confirm the latest valid flow can complete without support.
- Ensure logs and analytics contain no raw reset token or full email address.
- Test correction of a mistyped address and keyboard/screen-reader confirmation.

Gate: enumeration, rate-limit, cooldown, and link-lifecycle tests pass before reset-form work proceeds.

## 23 — Reset-password completion

**Current implementation**

The reset form checks only minimum length and equality. When no recovery user/session is available, it explains that the link may have expired but renders “request a new one” as text rather than a working route. Password policy is duplicated rather than shared with signup, and the form can be shown before the recovery session is definitively validated. Success provides a login link but no explicitly chosen session policy.

**Fix**

Reuse the password schema and rules from item 19. In the server route/loader, resolve recovery-session state before rendering the form: valid, expired, malformed, already used, or provider unavailable. Non-valid states render a direct link to `/portal/forgot-password` and no active password fields. Return typed, non-sensitive errors from submission. Decide and document whether successful reset signs the user in or revokes sessions and requires login; implement one clear outcome, with a safe next action and security notification if supported.

**Why it works**

Users cannot waste effort on a form whose token is already invalid, and one password policy prevents registration/reset inconsistency. Explicit post-reset session behavior removes ambiguity around old credentials and active sessions.

**Validation**

- Test valid, expired, malformed, reused, and missing recovery sessions before form render.
- Test every shared password rule, mismatch, provider rejection, and successful reset; valid values and errors must be associated predictably.
- After success, verify the old password fails, the new password works, and other sessions follow the chosen revocation policy.
- Activate the recovery link from the invalid-state page; it must reach a usable forgot-password form.
- Verify tokens never appear in logs, analytics, or rendered error copy.

Gate: token-state, shared-policy, and post-reset session tests pass.

## 24 — Checkout authority and recovery

**Current implementation**

`src/components/checkout-client.tsx` builds the form around a local-storage quote/cart, a separately persisted ZIP, and in-memory contact/address data. The server in `src/lib/backend/checkout.ts` revalidates SKU, price, inventory, and fulfillment at submission. The page's client `PriceMap` is built from storefront data where `dealerPrice` is deliberately null, while the server can apply protected trade pricing; the review UI may therefore show retail amounts before the authoritative total changes. If a selected fulfillment method becomes unavailable, the client can silently fall back to pickup. A 409 generally becomes a top-level error rather than a line/method reconciliation flow, although entered form values remain in memory.

**Fix**

Add an authenticated/guest checkout-preflight endpoint that accepts canonical line intents, ZIP, account context, and proposed method, then returns a signed or opaque, expiring checkout snapshot. The snapshot contains authoritative unit prices/tier/provenance, stock status, allowed fulfillment methods/windows, fees, tax inputs/results as applicable, line errors, and version/expiry. Render the entire summary from this snapshot. Store non-sensitive form draft data in session storage with a schema/version; never persist payment credentials. Do not silently change methods—show that the previous choice is unavailable and require a new choice. Submit with the snapshot token and idempotency key. On stale/409, refresh the snapshot, show per-line and total differences, preserve all valid fields, and require acknowledgment before retry.

**Why it works**

The browser and server review the same authoritative commercial state before payment/order creation. Expiry and reconciliation make mid-checkout changes explicit instead of surprising users, while an idempotency key protects network retries and session draft storage prevents avoidable re-entry.

**Validation**

- Test anonymous retail, signed-in homeowner, approved trade, pending trade, and expired-session contexts; displayed and submitted tier/price must match authorization.
- Change price, stock, ZIP eligibility, window capacity, and cutoff after preflight. Each must produce a specific diff and preserve contact/address data.
- Invalidate the selected method; expect no silent pickup fallback and no enabled submit until the user chooses an available method.
- Retry after timeout with the same idempotency key; expect one order/payment attempt. Test a new key after a corrected stale snapshot.
- Assert line sums, fees, tax, and final total displayed in the browser equal the server snapshot and created order exactly.
- Verify cart contents remain intact after every failed submission and clear only after confirmed success.

Gate: all pricing/stock/fulfillment race tests reconcile visibly and no client-derived amount is treated as final.

## 25 — Order confirmation

**Current implementation**

`src/app/api/checkout/status/route.ts` returns a narrow status focused on payment/order total, and `src/app/checkout/confirmation/page.tsx` treats paid/confirmed as a generally complete outcome. It does not expose line-level fulfillment, partial/backorder status, selected method/address, or a canonical receipt action. Email delivery is an operational side effect, but its failure/retry state is not separated from order success in the UI.

**Fix**

Expand the safe confirmation DTO to distinguish `paymentStatus`, `orderStatus`, and `fulfillmentStatus`, plus safe line summaries, quantities, backorder/partial flags, fulfillment method/window, masked address/contact, total breakdown, and next action. Render combination-specific messages rather than one success banner. Add a canonical printable receipt or authenticated/token-protected receipt endpoint with the same source data. Track confirmation-email status separately and provide staff retry; a failed email must never imply a failed order. Continue to use unguessable, scoped confirmation tokens and avoid exposing internal IDs unnecessarily.

**Why it works**

Separate state machines accurately represent orders that are paid but not fully fulfillable. A canonical receipt and independent email state give users durable proof without conflating notification delivery with transaction outcome.

**Validation**

- Cover pending/paid/failed payment against processing/confirmed/cancelled order and ready/partial/backordered/completed fulfillment combinations.
- Verify each line's quantity and status plus all totals against the stored order snapshot.
- Fail email delivery; the page must still confirm a successful order, while authorized staff can retry and audit the notification.
- Test refresh, delayed status polling, expired/invalid token, token replay, and access from another browser.
- Print/download the receipt and compare order number, line items, total, and fulfillment details with the page.

Gate: every supported state combination has accurate copy/action and the receipt/email/token tests pass.

## 26 — Review route naming and scope

**Current implementation**

The critique assumes `/review` is a checkout review-before-submit page. In the current repository, `src/app/review/page.tsx` and `src/components/review-form.tsx` are a customer product-review submission flow with rating, name, body, consent, canonical product context, and moderation. Checkout review is contained inside `src/components/checkout-client.tsx` and is already addressed in item 24. Building edit-in-place address and price sections on `/review` would modify the wrong product feature.

**Fix**

Treat this critique item as a taxonomy/test-documentation correction, not a new checkout route. Rename labels, screenshot inventory, and test descriptions from ambiguous “Review” to “Write a product review.” Keep checkout's review/reconciliation inside the checkout flow and implement item 24 there. For the actual product-review page, retain server canonicalization of the SKU/product title, pending-moderation confirmation, consent, and safe error handling. If the URL can be changed without SEO/support cost, consider a later explicit `/reviews/write`; otherwise keep `/review` and make the page title unambiguous.

**Why it works**

The plan does not manufacture a duplicate review step from a stale screenshot interpretation. Clear naming prevents future design and QA work from testing the product-review route against checkout requirements while preserving the existing moderated review feature.

**Validation**

- Assert `/review` exposes rating, reviewer name, body, and consent—not address, fulfillment, quantities, or order pricing.
- Tamper with submitted product title/SKU context; the server must resolve canonical data and reject invalid products.
- Submit a valid review and verify pending moderation rather than immediate public publication.
- Rename screenshot/test identifiers and confirm no remaining artifact refers to this route as “review before checkout.”
- Re-run item 24 tests to prove address/quantity/price reconciliation is covered in the actual checkout component.

Gate: route semantics are unambiguous in UI, tests, and design inventory, with no duplicate checkout review page added.

## 27 — Returns policy and initiation

**Current implementation**

`src/app/returns/page.tsx` is a long `PolicyPage` with a short-version introduction and static sections. It has no order/product eligibility evaluator or direct RMA start. Backend/portal data already includes RMAs, but the policy page is not connected to an eligible order line, so users must interpret opened, installed, special-order, refrigerant, and timing rules themselves.

**Fix**

Represent operational return rules as versioned data keyed by purchase date/window, category/hazard class, condition, installation state, special-order flag, damage reason, and account/order status. Keep legal wording governed separately. Add a summary eligibility checker that asks only the unknown facts, clearly labels the result as preliminary, cites the relevant policy section, and never overrides staff review. From an authenticated order line, provide “Start return” with order/SKU/quantity prefilled and create an RMA in the existing lifecycle; anonymous users receive an order/contact verification path. Add stable section IDs/table of contents through the policy-shell work in item 29.

**Why it works**

Users receive a reasoned answer from the same rules staff applies, without hiding exceptions or pretending an estimate is approval. Starting from an order reduces transcription errors and connects policy understanding directly to the existing RMA process.

**Validation**

- Test within/outside window, unopened/opened, installed, damaged-on-arrival, special order, refrigerant/hazardous, and non-returnable fixtures.
- For every outcome, assert the reason and linked policy version/section match the rule that fired.
- Start from an authenticated eligible line; order, SKU, quantity limits, account, and policy version must prefill and remain server-validated.
- Attempt another account's line, excessive quantity, duplicate RMA, and anonymous access; expect safe rejection/recovery.
- Compare rule output with operations-approved examples before release.

Gate: rule fixtures and authenticated RMA initiation pass against an approved policy version.

## 28 — Shipping page hierarchy

**Current implementation**

The critique refers to shipping accordions, but `src/app/shipping/page.tsx` currently uses static `PolicyPage` sections. It overlaps substantially with `/delivery` and is not driven by the fulfillment calculator. There is no accordion keyboard defect to fix; the actual debt is duplicated prose, weak answer hierarchy, and unversioned cutoff/service-area claims.

**Fix**

Do not add accordions merely to match the critique. Define `/shipping` as the canonical legal/operational detail page and `/delivery` as the answer-first eligibility experience, or merge them if content ownership supports that decision. At the top, project the shared fulfillment resolver into a compact ZIP/method/cutoff answer card. Below it, provide stable section anchors and a table of contents for service areas, freight/oversized equipment, pickup, exceptions, and claims. Calculate dates/cutoffs in the branch timezone with holiday exceptions; leave legal static detail as governed content.

**Why it works**

This fixes the real discoverability and consistency issue without adding stateful accordions to content that benefits from browser search and heading navigation. Shared calculations ensure cutoff claims agree with checkout.

**Validation**

- Assert shipping and delivery output the same eligible method/date for the item-10 fixture matrix.
- Test before/after cutoff, Friday, holiday, DST, eligible/ineligible ZIP, oversized-only, and no-live-data states.
- Navigate all section anchors with keyboard and screen-reader headings; content must remain available without JavaScript.
- Search within the page for critical terms to ensure details are not hidden behind collapsed controls.
- Content inventory must show which route owns each piece of copy, with no contradictory duplicate.

Gate: shared calculations and content-ownership checks pass; no unnecessary accordion state is introduced.

## 29 — Privacy document

**Current implementation**

`src/app/privacy/page.tsx` renders hand-authored JSX through `src/components/policy-page.tsx`. The shell provides a readable centered column and visible last-updated label, but sections have no stable IDs, table of contents, persistent location aid, formal version, effective date, or archive. Because the content is ordinary page typography, future global marketing styles can also alter line length or contrast unless the legal shell owns those constraints.

**Fix**

Create a legal-document schema with document ID, version, effective date, updated date, owner, and sections with immutable IDs. Render privacy through a dedicated legal typography layer with max prose width, protected text/link/heading tokens, and predictable spacing. Generate a sticky desktop and compact mobile table of contents from section IDs; preserve native anchor behavior and optionally indicate the current section. Publish prior versions at stable archive URLs and define a review/publish workflow. Keep the current version canonical.

**Why it works**

Versioned structured content makes legal changes auditable and deep-linkable. The dedicated shell protects readability and accessibility from unrelated marketing changes while native anchors solve navigation without making the document JavaScript-dependent.

**Validation**

- Deep-link to every section with JavaScript on and off; the target heading must be visible and have a unique stable ID.
- Test 320 px, 200% and 400% zoom, forced colors, and dark/high-contrast preferences if supported; no horizontal scroll or lost link distinction.
- Run automated contrast/heading checks and manually verify line length and screen-reader table-of-contents navigation.
- Publish a test revision; current and archived URLs must show the correct version/effective date and no broken old anchors.
- Confirm global marketing typography/token changes do not alter the legal shell beyond its contract.

Gate: deep-link, archive, zoom, and protected-typography tests pass for privacy.

## 30 — Terms document

**Current implementation**

`src/app/terms/page.tsx` uses the same policy shell and visible update date as privacy, but there is no effective-date/version history or change summary. Operational clauses and defined terms are presented as ordinary sections rather than a semantic definitions system, and acceptance—if legally required at account creation or checkout—is not tied to a specific version.

**Fix**

Reuse the legal-document infrastructure from item 29 while keeping terms-specific content independent. Add a prominent effective date, version, prior-version link, and concise change summary. Represent defined terms as semantic definition entries (`dl`, `dt`, `dd`) with stable IDs; cross-link later uses only where it materially aids understanding. If counsel requires affirmative acceptance, record document ID/version, user/order, timestamp, and context at the relevant server transaction—never only in client state.

**Why it works**

Shared legal infrastructure avoids duplicate layout debt, while terms-specific semantics make definitions and revisions understandable. Versioned acceptance provides an auditable record of exactly what was agreed to.

**Validation**

- Test every definition anchor and cross-link for uniqueness, destination, keyboard focus, and readable back navigation.
- Publish a test revision and verify effective date, change summary, archive, canonical version, and preservation of old links.
- If acceptance is required, create account/checkout fixtures and assert the stored version matches the rendered version; retries must not create conflicting records.
- Run the same zoom, contrast, heading, and no-JavaScript tests as privacy.
- Verify there are no orphan definition references or accidental acceptance checkboxes where counsel has not required one.

Gate: terms versioning/definitions pass, and any acceptance requirement is server-auditable.

## 31 — Not-found recovery

**Current implementation**

`src/app/not-found.tsx` offers generic navigation and catalog-derived category links. It does not inspect or log the missing path, extract likely SKU/category intent, or query suggestions. In the Next server not-found boundary, the original client path is not automatically available to the component. Existing cart/ZIP/account context generally persists elsewhere, but the recovery page does not explicitly avoid or preserve those contexts.

**Fix**

Keep a useful server-rendered fallback, then add a small client `NotFoundRecovery` enhancement that reads `window.location.pathname` and search parameters. Sanitize and classify only path fragments needed for recovery; extract SKU-like tokens or category slugs and query the existing search API for exact/near candidates. Send a privacy-safe 404 event through `src/app/api/events/route.ts` with route pattern/referrer class, not arbitrary PII query values. Show contextual suggestions only above a confidence threshold and always retain general search/catalog actions. Do not clear quote/cart, branch ZIP, or auth state.

**Why it works**

The server fallback remains reliable, while client path access enables targeted recovery that Next's not-found component otherwise lacks. Sanitized analytics turn recurring dead URLs into actionable fixes without capturing sensitive user-entered data.

**Validation**

- Visit a mistyped SKU, mistyped category, deleted product, random route, and path containing email-like or secret query data.
- Expect high-confidence SKU/category suggestions only when justified; random routes retain generic recovery.
- Inspect the event payload and logs to ensure full query strings, emails, tokens, and free text are excluded.
- Add items and ZIP context, authenticate, then visit a 404 and recover; all contexts must remain intact.
- Confirm the response remains a real 404 and the server-rendered page is useful with JavaScript disabled.

Gate: suggestion accuracy, privacy logging, context preservation, and HTTP-status tests pass.

## F01 — All Products menu

**Current implementation**

The desktop catalog menu in `src/components/site-nav.tsx` is data-driven from `CATALOG_CATEGORIES`, but its panel has a fixed width and two-column layout. It applies menu roles to ordinary destination links without implementing the full menu arrow-key interaction model. Escape and outside dismissal exist through the dismissable behavior, but adding many categories will create an oversized panel on smaller laptops, and the data contract does not explicitly distinguish valid, disabled, or missing landing destinations.

**Fix**

Use the disclosure-navigation pattern: a button with `aria-expanded`/`aria-controls` opens a labeled navigation region containing ordinary links, so Tab/Shift+Tab remain the expected keyboard model. Only use `role="menu"` if the complete ARIA menu behavior is intentionally implemented. Make panel width viewport-bound, use responsive auto-fit columns, cap height below the viewport, and allow internal scrolling without hiding focus. Add grouping/search only after a category-count threshold. Extend category data with an explicit destination/availability contract and omit or visibly disable entries without a valid landing state.

**Why it works**

Semantic disclosure navigation matches a website mega-menu and avoids promising application-menu keyboard behavior. Intrinsic sizing and an explicit category contract let the menu grow without overflowing or linking to accidental empty pages.

**Validation**

- Render 0, 1, the current count, and 30 categories with long/localized labels at 1024 px, short viewport height, and 200% zoom.
- Test Tab, Shift+Tab, Enter/Space, Escape, outside click, and route activation. Focus must be visible and return to the trigger on dismissal.
- Verify all rendered hrefs are nonempty and resolve to an intended landing/filtered state; disabled items must not be focusable links.
- Run axe and manually confirm that screen readers announce a disclosure/navigation region, not an incomplete ARIA menu.

Gate: large-category layout and disclosure keyboard tests pass with no invalid destinations.

## F02 — Account menu

**Current implementation**

`src/app/layout.tsx` renders `SiteNav` without session/profile input, so `src/components/site-nav.tsx` always presents the anonymous account menu even to signed-in users. The dropdown does not model signed-out, homeowner, pending dealer, approved dealer, and staff states. It has basic dismissal behavior but no complete open-focus/trap/return contract. Current account and price-tier context cannot be shown because they are not provided.

**Fix**

Resolve a minimal, safe account summary at the layout boundary or through a small session-aware navigation island that does not leak protected data into public caches. Define explicit variants: `signedOut`, `homeowner`, `tradePending`, `tradeApproved`, `staff`, and `disabled`, each with allowed actions, destination, account label, and price-tier label where appropriate. Use a disclosure menu for a short list of navigation/actions; move focus into it on open only if required by the chosen pattern, support Escape/outside close, and always restore focus. Implement sign-out as a server action with a pending state and deterministic redirect. Add a switcher only if item 18 confirms multi-account membership.

**Why it works**

The menu becomes a projection of server authorization instead of a static anonymous shell. Explicit variants prevent impossible combinations and expose the context that determines portal destination and pricing without client-side guesswork.

**Validation**

- Component/integration-test every account variant and ensure only permitted links/actions render.
- Authenticate as each role/status and hard-refresh a public page; the correct menu must appear without exposing another session through caching or a misleading anonymous flash.
- Test keyboard opening, traversal, Escape/outside dismissal, focus return, and sign-out pending/failure/success.
- After sign-out, protected routes and trade prices must be inaccessible and browser Back must not reveal cached private content.
- If no multi-account model exists, verify there is no fake account switch control.

Gate: session/cache isolation and all explicit menu-state tests pass.

## F03 — Search suggestions

**Current implementation**

The search field in `src/components/site-nav.tsx` debounces requests, aborts previous fetches, uses a request sequence to ignore stale responses, and supports Arrow/Enter selection with listbox semantics. It does not implement the Escape behavior claimed in comments, and its state model is mostly a flat result list. Loading can coexist visually with old results, result taxonomy is not explicit, and empty/error/ambiguous outcomes are not differentiated for assistive technology.

**Fix**

Formalize the autocomplete as `idle`, `loading`, `success`, `empty`, and `error` states while preserving abort and request-sequence protection. Add Escape to close/clear active selection without submitting and return the input to a stable state. Group or label results by exact SKU/model, product, category, and suggested correction; give each option one stable accessible name and ID. Add `aria-busy`, `aria-controls`, `aria-activedescendant`, and a restrained live status for result count/loading/error. Clear obsolete results when a materially new request begins or label them as stale only if intentionally retained.

**Why it works**

The existing concurrency safeguards remain, while typed UI states prevent old results from masquerading as a new response. Taxonomy and complete keyboard behavior let users distinguish similar identifiers and understand what Enter will activate.

**Validation**

- Force responses to arrive out of order and abort mid-request; only the newest query may populate options.
- Test exact SKU, partial product name, category, misspelling, zero results, server error, and many similar SKUs.
- Keyboard-test Arrow Up/Down, Home/End if supported, Enter, Escape, Tab, blur, and pointer selection; active descendant must always reference an existing option.
- Screen-reader output must announce loading/result count/empty/error once without reading every keystroke excessively.
- At 320 px and 200% zoom, the panel must remain within the viewport and not obscure the active option.

Gate: concurrency, taxonomy, Escape, and assistive-status tests pass.

## F04 — Quick Order

**Current implementation**

The quick-order parser in `src/components/homepage-conversion-tools.tsx` splits rows on whitespace, silently changes invalid quantities to 1, truncates input to 50 rows, resolves each line through separate search requests, and can repeatedly add duplicate SKUs. It accepts the first search result rather than requiring an exact canonical match. Quantity is added through repeated single-item mutations, so large values can create many renders/drawer openings. Rows are not a durable correction model.

**Fix**

Extract a pure parser that returns ordered row objects with original text, normalized candidate SKU, raw quantity, parsed quantity, and row-level errors. Require a documented delimiter (for example SKU followed by quantity), never coerce invalid/missing quantities silently, and report the row limit rather than slicing invisibly. Normalize and merge exact duplicate SKUs only after validation. Add a batch resolver endpoint that performs exact canonical matching for all rows and returns found/unknown/ambiguous/availability states in input order. Present a review table where users can correct/remove rows. Commit accepted rows through one `addMany` quote/cart operation with a single drawer/update event and documented all-or-nothing or explicit partial semantics.

**Why it works**

Parsing, catalog resolution, and cart mutation become separate testable stages. Users retain valid work while correcting bad rows, exact matching prevents the wrong product from being added, and a batch/atomic update removes the current network and render amplification.

**Validation**

- Unit-test blank lines, extra whitespace, missing/zero/negative/decimal/non-numeric/oversized quantity, duplicate SKU, SKU punctuation, and input beyond the row cap.
- Batch-test exact, unknown, ambiguous, unavailable, and duplicate canonical results; the first fuzzy result must never be auto-selected.
- Submit mixed valid/invalid rows, correct one, and verify other rows retain their values/status.
- Load 100 supported rows in the parser/review fixture and measure one batch request and one cart mutation; enforce the chosen practical row limit explicitly.
- Verify quantities add arithmetically, not through N calls, and the drawer opens at most once.

Gate: parser corpus, exact batch resolution, row correction, and atomic performance tests pass.

## F05 — CSV upload

**Current implementation**

The CSV path reads the entire file as text, enforces a 2 MB cap, splits lines/columns with simple string operations, guesses whether the first row is a header, and then sends values into the quick-order parser. It does not correctly support quoted fields, BOMs, tabs, embedded commas, encoding problems, explicit header mapping, preview, or transactional commitment. A malformed file can therefore create partial, hard-to-explain additions.

**Fix**

Use a maintained CSV parser or a deliberately constrained parser with explicit support for UTF-8/BOM, CRLF/LF, quoted fields, escaped quotes, and comma/tab delimiters. Publish a downloadable UTF-8 template with required `sku` and `quantity` headers. Parse into the same row model introduced in F04, show a preview and row/error table, and allow correction/removal before import. Reject unsupported encoding, missing/duplicate headers, malformed quoting, and files over the declared row/size limits with specific messages. Commit through the same batch resolver and atomic `addMany`; no cart mutation occurs before confirmation.

**Why it works**

CSV import becomes another input adapter to one validated quick-order pipeline instead of a separate weaker implementation. Standards-aware parsing prevents column corruption, and preview plus atomic commit makes the result predictable and recoverable.

**Validation**

- Fixture-test UTF-8 BOM, CRLF/LF, comma/tab delimiters, quoted SKUs, escaped quotes, extra columns, blank rows, reordered headers, duplicate headers, and malformed quotes.
- Test missing `sku`/`quantity`, duplicate SKUs, invalid quantity, unknown/ambiguous SKU, unsupported encoding, 2 MB boundary, and row-limit boundary.
- Download the template, populate it, upload it, and verify a clean round trip.
- Confirm no line is added before review/confirmation and that one failed commit leaves the cart unchanged.
- Compare CSV and pasted quick-order rows; identical logical input must produce identical normalized rows/errors.

Gate: the CSV corpus, template round trip, and transactional import tests pass.

## F06 — Contractor pricing presentation

**Current implementation**

Public storefront catalog data intentionally omits dealer prices (`dealerPrice` is null), while `src/lib/backend/pricing.ts` can resolve protected account pricing during checkout. The homepage's audience selector nevertheless talks about net pricing, and the checkout client can initially build its display map from retail-only storefront data. There is no shared presentation object carrying authorization, provenance, freshness, or failure state across cards, PDP, drawer, and checkout.

**Fix**

Expose account pricing only through a session-scoped server projection for an authorized account. Define `PricePresentation` with amount/currency, tier label, source/account, `asOf`/expiry, tax qualifier, and state (`finalForSnapshot`, `indicative`, `unavailable`, `authorizationRequired`). Use it in every commerce surface together with the item-04 state resolver. Revalidate after sign-in, sign-out, account switch, and snapshot expiry. Show retail-versus-contractor comparison only when both values are authorized and the business/legal rules approve it. On pricing failure, say the account price cannot be confirmed and route to retry/quote; do not relabel retail as trade. Protect private responses from static/shared caching.

**Why it works**

Price visibility follows server authorization and carries enough metadata to explain its status. One presentation contract prevents open components from retaining stale account prices and stops checkout from contradicting the catalog without warning.

**Validation**

- Test anonymous, homeowner, pending dealer, approved dealer, staff/impersonation if applicable, expired session, and suspended account.
- Inspect anonymous HTML, RSC payloads, APIs, browser cache, and shared CDN behavior; no protected amount/account identifier may appear.
- Change account authorization/price and revalidate all open surfaces; card, PDP, drawer, and checkout must update or show an explicit stale state.
- Simulate missing and expired pricing; retail must not be presented as the contractor amount.
- Compare the displayed checkout snapshot to the created order for every tier; amounts and provenance must match exactly.

Gate: authorization/cache isolation and cross-surface price-consistency tests pass.

## F07 — Cart/quote drawer

**Current implementation**

`src/components/quote-drawer.tsx` already traps focus, closes with Escape, and restores focus. Its compact panel truncates long product names, omits meaningful fulfillment/revalidation detail, and currently treats positive price as checkout readiness. Stock and price are not refreshed when the drawer opens, and clearing the entire list has no confirmation. A complex or maximum-size list is forced into the same narrow drawer.

**Fix**

Consume the commerce/line state from item 04 and run a debounced preflight revalidation when the drawer opens and immediately before checkout. Render full wrapping names, SKU, quantity, unit/subtotal where authorized, and a concise per-line state/action; separate quote/availability lines from checkout-eligible lines. Keep order-level fulfillment out of every row unless a line truly has a distinct constraint. Show inline reconciliation errors and route larger/complex carts to a full-page review while the drawer remains a summary. Confirm “Clear all” when multiple lines exist and offer an undo if feasible. Keep the existing focus behavior but move it into the shared dialog primitive also used in F09/F11.

**Why it works**

The drawer stops acting as a false checkout validator and becomes a concise status summary. Revalidation catches stale commerce state early, while a full-page escape valve prevents density from overwhelming a 400 px panel.

**Validation**

- Test 1, 20, and the maximum supported lines with long/localized names and 200% zoom; no essential identifier/action may be truncated beyond recovery.
- Include purchasable, quote-only, unavailable, price-changed, and stock-changed lines; checkout eligibility and row actions must be correct.
- Open after server state changes and verify one controlled revalidation with visible pending/result states.
- Keyboard-test trap, Tab order, Escape, outside behavior, trigger focus return, and removal focus placement.
- Test clear-all cancel/confirm/undo and confirm no accidental single keypress destroys the list.

Gate: mixed-state/large-cart and full dialog accessibility tests pass.

## F08 — Gallery active-image synchronization

**Current implementation**

The existing gallery marks the active thumbnail with `aria-selected`, manages roving tab index, and handles Arrow/Home/End. The active image is index-based, so reordering, insertion, or failure can shift selection to a different asset. Caption and alt-text responsibilities are not formalized, and mobile swipe is absent.

**Fix**

Use the stable media IDs introduced in item 05 as the selection key. When the collection changes, retain the selected ID if present; otherwise choose the nearest surviving item and announce the change only when user-relevant. Keep the active thumbnail selected, focusable, and scrolled into view. Treat alt text as a description of the image's visual/product information and caption as visible editorial context; do not duplicate them automatically. Use item 05's swipe behavior and live index.

**Why it works**

Identity-based selection survives asynchronous media updates and prevents the UI from silently showing a different image at the same index. Separating alt and caption improves both visual and assistive comprehension.

**Validation**

- Select the second image, then reorder, prepend, remove, and fail other images; selection must follow its ID or fall back deterministically.
- Verify the active thumbnail's `aria-selected`, tab index, visible styling, and scroll position after every update.
- Test Arrow/Home/End, pointer, and swipe; all mechanisms must update one shared active ID.
- Review fixtures where caption is absent, alt is absent/decorative by policy, and both differ; screen readers must not receive redundant text.

Gate: dynamic reorder/failure and shared active-state tests pass.

## F09 — Gallery large view/zoom

**Current implementation**

The gallery modal displays an `object-contain` image within viewport bounds and already provides focus trapping, Escape, focus return, backdrop close, and body scroll locking. Despite being described as zoom, it has no scale/pan controls, orientation or next/previous navigation, low-resolution fallback decision, or explicit scroll-restoration test. On mobile, an enlarged-but-static image can still be difficult to inspect.

**Fix**

Choose the interaction honestly. If product assets do not justify true inspection, rename the action “View larger” and keep a fit-to-screen lightbox. If zoom is required, implement bounded zoom/pan with fit/reset, accessible buttons of at least 44 px, keyboard equivalents, touch pinch/pan that does not strand controls, and next/previous media navigation. Preserve active media ID and page scroll on close. Respect safe-area insets and reduced motion. Suppress the control for low-resolution/non-image assets or clearly state that no larger image is available. Build this on a shared, tested dialog primitive.

**Why it works**

The label matches the capability, and true zoom—if chosen—has a complete orientation and exit model rather than just making a low-resolution image bigger. Shared dialog behavior removes duplicated focus/scroll defects across overlays.

**Validation**

- Test portrait/landscape assets at 320 px, mobile landscape, short desktop viewport, and high DPI.
- For true zoom, test button, keyboard, wheel if supported, pinch, pan bounds, reset/fit, next/previous, and control reachability at maximum scale.
- For view-larger, verify no “zoom” promise remains and the full asset fits without hidden controls.
- Test Escape, backdrop policy, close button, focus trap/return, page scroll restoration, safe areas, and reduced motion.
- Test low-resolution and non-image assets; unavailable controls must not render as actionable.

Gate: the chosen capability is consistently named and its mobile/keyboard/focus/scroll matrix passes.

## F10 — Mobile catalog filters

**Current implementation**

The mobile filter sheet is the same underlying filter system as item 03, but its current interaction deserves a component-specific fix: every selection immediately changes the URL and results, “Show results” merely closes the sheet, “Clear” immediately changes applied state, and closing retains changes. The sheet traps focus, yet users cannot know whether they are editing a draft or live results.

**Fix**

Implement the item-03 draft model inside the mobile sheet. Opening clones the current applied URL filters. Controls modify draft state, while a preview count is derived locally when reliable or requested through a debounced count endpoint. “Apply” commits one URL update and closes; “Cancel,” Escape, and backdrop discard the draft; “Clear all” clears only the draft until Apply; individual removal does not reset unrelated filters. Show a dirty-state summary and disable Apply only when no meaningful change or while a required count is unresolved. Preserve catalog scroll position and restore trigger focus.

**Why it works**

Every dismissal path now has the same predictable semantics, and the CTA actually performs the action its label promises. A draft count gives feedback without mutating the page behind the modal.

**Validation**

- For each dismissal path—Cancel, Escape, backdrop, close icon—change several filters and expect applied URL/results to remain unchanged.
- Apply multi-select and single-select changes; expect exactly one history entry and unchanged unrelated filters.
- Clear one filter and Clear all, both followed by Cancel and Apply; verify draft/applied separation.
- Test zero, delayed, failed, and stale preview counts and ensure the displayed count is never attributed to the wrong draft.
- Confirm focus, body scroll lock, catalog scroll restoration, and Back behavior after Apply.

Gate: all draft/apply/cancel/count/history tests pass.

## F11 — Mobile navigation

**Current implementation**

The full-screen mobile navigation in `src/components/site-nav.tsx` locks body scroll but lacks a complete focus trap, initial-focus rule, Escape listener, opener reference, and guaranteed focus return. Product categories and account/branch actions form a long mostly flat list. The footer repeats a hard-coded Newark “open until 5 PM” claim, which can be wrong during closures or after hours.

**Fix**

Build the drawer on the shared dialog primitive: label it, move focus predictably, trap/inert the background, support Escape and explicit close, restore the trigger, and preserve page scroll. Prioritize top tasks from actual navigation analytics: search/shop, quote/cart, account, and branch contact. Put product families in an expandable hierarchy or searchable category panel with a clear back model rather than one unbounded list. Consume the live branch projection from item 11, including unknown/closed/exception states. Keep close/account actions reachable above safe-area insets and on short viewports.

**Why it works**

The drawer becomes a real modal navigation surface rather than a visually full-screen div. Task hierarchy reduces scanning cost, while shared branch data removes misleading operational copy.

**Validation**

- Keyboard and screen-reader test open, initial focus, traversal, nested category navigation, back, Escape, close, and trigger focus return.
- Test 320 px, mobile landscape, short viewport, 200% zoom, long labels, and 30 categories; all controls remain reachable by scrolling inside the drawer.
- Verify the background is not focusable/scrollable while open and page scroll returns exactly after close.
- Freeze time across open/closed/holiday/unknown branch states; drawer and location page must agree.
- Test direct navigation to a deep category and Back behavior without trapping users in a fake internal history stack.

Gate: modal accessibility, deep-category, small-viewport, and branch-status tests pass.

## F12 — Contact form validation and errors

**Current implementation**

`src/app/contact/page.tsx` holds a single `fieldError`. Only the name visibly receives a field-level message, while topic, email, and message can be marked invalid without specific associated text. A missing name incorrectly focuses `emailRef` and scrolls the document bottom. Server and client errors share a broad alert, and `src/components/form.tsx` has no reusable error/description contract. Values generally remain after failure, which should be preserved.

**Fix**

Add a reusable form-field API with stable control ID, label, hint, error, required state, `aria-invalid`, and composed `aria-describedby`. Represent contact errors as a map keyed by field plus a distinct form/server error. Validate all fields on submit using the same server-compatible schema and show one concise summary when several fail. Focus either the summary or, preferably for this short form, the first invalid field in DOM order; never scroll to the page bottom. Announce the submission result once through a status/alert region. Map 400 field errors, 429 cooldown, and 500/retry failures to different recovery copy while preserving every valid value and any future attachment metadata.

**Why it works**

Errors become stable metadata attached to controls instead of layout side effects. A field map supports simultaneous correction, shared schema prevents conflicting messages, and separate server states tell users whether to edit, wait, or retry.

**Validation**

- Submit each field invalid alone and all fields invalid together; every control must have one correct associated message and the first invalid control must receive focus.
- Test malformed email, missing topic/name/message, maximum lengths, and server-returned field errors against the shared schema.
- Simulate 400, 429, network failure, and 500. Valid field values must remain, the announcement must occur once, and the recovery action must match the failure.
- On a narrow viewport, verify error appearance does not cause a large unexpected jump and focus never lands off-screen or at document bottom.
- Run axe and a screen-reader pass to ensure summary links/field descriptions are not duplicated.

Gate: the complete client/server/error/accessibility regression suite passes, including the original missing-name focus bug.

## Final release gate

After F12, run the complete verification stack from a clean checkout:

1. `npm run lint`
2. `npm test`
3. `npm run test:e2e`
4. Production build and any repository type-check command
5. Axe plus manual keyboard/screen-reader checks on all changed routes
6. Responsive/content-stress matrix at 320, 768, 1024, and 1440 px and at 200% zoom
7. Operations review of fulfillment, branch hours, dealer SLA, returns, and service-area claims
8. Security/privacy review of auth, pricing, checkout snapshots, file uploads, tokens, and event logging

Release only when no gate above is waived silently. A deferred edge case must be recorded as an explicit issue with owner, risk, and target milestone rather than removed from the acceptance criteria.
