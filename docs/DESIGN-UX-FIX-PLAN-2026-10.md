# Summit HVAC Supply — UX and design-fix plan

Based on `DESIGN-UX-AUDIT-2026-10.md` and the existing `DESIGN-REMEDIATION-PLAN.md`.

Status: Phases 0–5 implemented; release gates open (see `DESIGN-UX-DECISION-LOG-2026-10.md`)  
Owner: product/design engineering  
Target: a trustworthy, low-friction HVAC counter experience across desktop and mobile

## 1. Outcome

Make Summit feel like a precise local counter employee online:

- Customers can tell what a product is, whether its media is trustworthy, what its commercial state is, and what action is possible.
- Contractors can find and compare exact records quickly.
- Homeowners can get from uncertainty to a qualified handoff without unnecessary account or form friction.
- Staff receive requests with enough context to verify model, compatibility, price, stock, and fulfillment.
- Every important state is represented consistently in the UI, data model, analytics, tests, and screenshot audit.

## 2. Scope and sequencing

This plan is an experience-quality pass, not a rewrite. Preserve the existing catalog, operational safeguards, accessibility work, route coverage, and backend authority. Extend the current remediation work where it already solves the underlying problem; do not create a second competing component system.

### Priority order

1. Commerce truth and product-media trust.
2. Catalog and product-detail decision flow.
3. Finder, forms, and resource-flow clarity.
4. Shell, token, and assistance cleanup.
5. Visual QA, measurement, and release acceptance.

The first two phases are release-critical. The remaining phases should not delay a safe fix to misleading price, stock, eligibility, or media states.

## 3. Workstreams

### WS-0 — Baseline and state inventory

**Purpose:** Establish a reliable starting point before changing the UI.

**Tasks**

- Freeze the 161-state manifest as the baseline and annotate each state with route, viewport, interaction, expected visible marker, and readiness condition.
- Build a route-by-state matrix for product pricing, availability, image state, filter state, finder step, form validation, auth, resource type, menu, chat, and error recovery.
- Identify conflicts between the audit, `THEME.md`, `DESIGN-REMEDIATION-PLAN.md`, and current implementation. Resolve them in one decision log.
- Record the current metrics: time to first primary action, header height, catalog card density, image coverage, commerce-state coverage, and mobile filter completion.

**Exit criteria**

- Every audited issue maps to a route, component, data source, test, and owner.
- Screenshot naming and visible state are verified for all interaction captures.
- No implementation begins against an ambiguous operational promise.

### WS-1 — Commerce state system [P0]

**Purpose:** Remove ambiguity from price, stock, quote, pickup, delivery, and checkout eligibility.

**Design decision**

Use one semantic state model across cards, product detail, quote drawer, related products, account pricing, and checkout recovery:

- `purchasable` — price and permitted fulfillment are confirmed.
- `quoteRequired` — staff must price or verify the request.
- `availabilityRequired` — the customer can request stock/timing confirmation.
- `unavailable` — the record cannot currently be fulfilled; offer recovery or notification.
- `pricingUnavailable` — price lookup failed; preserve the product identity and offer retry/contact.

Do not add states that the operations team cannot support. Keep the existing call-to-confirm protections until operations approval is complete.

**Implementation tasks**

- Create a server-derived `CommercePresentation`/`CommerceState` contract with state, price display, stock display, fulfillment confidence, primary action, secondary action, and recovery copy.
- Replace independent price/action branches in product cards, PDP purchase panel, quote drawer, sticky buy bar, related cards, and checkout recovery.
- Prevent non-purchasable lines from showing checkout actions, including legacy local-storage/cart records.
- Use text and icons in addition to color; reserve green for confirmed/primary meaning.
- Add a compact state summary that answers “what can I do now?” in one scan.

**Validation**

- Resolver matrix covers retail, trade, price confirmed, quote-only, availability required, unavailable, missing price, and failure states.
- The same state renders consistently in list, detail, quote, and recovery surfaces.
- Client tampering cannot make a non-purchasable line checkout-eligible.
- All state changes have accessible text and one clear next action.

### WS-2 — Product media trust [P0]

**Purpose:** Make imagery useful and honest for exact-model HVAC selection.

**Implementation tasks**

- Normalize catalog media into `verifiedExact`, `verifiedFamily`, `missing`, `loading`, and `failed` states.
- Add asset provenance, intrinsic dimensions, alt text, and optional high-resolution source to the media model.
- Create a stable image frame for cards and PDPs; never leave an accidental blank hole.
- Label representative/family imagery clearly on detail pages.
- Keep gallery behavior unified for zero, one, and many images; preserve the existing keyboard/focus work.
- Add retries/fallbacks and suppress controls that have no effect.

**Content/data tasks**

- Audit the product catalog for incorrect family reuse and missing exact-model media.
- Prioritize imagery for the highest-traffic and highest-risk products: outdoor units, matched systems, air handlers, and products with similar model names.
- Mark unresolved records as intentionally missing rather than implying exact visual verification.

**Validation**

- No loaded-state screenshot contains a skeleton or blank media frame.
- Every placeholder communicates why media is unavailable.
- Exact versus representative imagery is understandable without color or hover.
- Mobile swipe, keyboard gallery, failure, and zoom behavior pass.

### WS-3 — Catalog decision flow [P1]

**Purpose:** Make the catalog an efficient comparison tool rather than a dense record grid.

**Design changes**

- Add a task entry above filters: `I know the model`, `I need a complete system`, `I need a component`, `I need parts`.
- Keep exact-model search dominant and show why each result matched.
- Add applied-filter summary, clear-all, result count, and compatibility warnings.
- Use progressive facets based on the task; keep selected facets visible even when the remaining set becomes small.
- On mobile, separate draft filter state from applied URL state with real Apply/Cancel behavior.
- Add a mobile list mode with stable image, title/SKU, commercial state, and one action; reduce repeated low-value labels.

**Implementation tasks**

- Use one typed filter parser/normalizer/serializer for sidebar, chips, mobile sheet, URL, and browser history.
- Preserve the existing URL-addressable filter foundation and extend it rather than adding a parallel state model.
- Add compatibility grouping for indoor/outdoor units, refrigerant, capacity, and matched systems.
- Keep product-card layout aligned through shared rows, but reduce visual weight for secondary metadata.

**Validation**

- URL, chips, controls, result count, and query text agree after reload, Back, and Forward.
- Mobile Cancel leaves URL/results unchanged; Apply commits all draft changes in one history entry.
- Zero-result and one-result states provide recovery.
- 320px, 390px, 768px, and 1440px layouts remain readable and operable.

### WS-4 — Product-detail decision surface [P1]

**Purpose:** Turn the product page into a verified decision sheet.

**Design changes**

- Above the fold: exact title, SKU/model, component role, media status, commerce state, compatibility summary, fulfillment choices, and primary action.
- Add a sticky desktop summary and a mobile bottom action bar.
- Group evidence into Overview, Compatibility, Specifications, Documents, and Warranty while preserving deep links.
- Make related items explicitly “nearby catalog items,” not implied compatible matches.
- Keep source links adjacent to the claims they support.

**Implementation tasks**

- Create `ProductDecisionPanel` and data-driven `ProductEvidenceSection` configuration.
- Reuse `CommerceStateBlock` and the media model from WS-1/WS-2.
- Add an explicit “compatibility not established” state when related products are only similar.
- Keep the existing semantic definition-list/specification implementation and accessibility behavior.

**Validation**

- A user can identify exact model, commercial state, compatibility confidence, and next action without scrolling.
- Sticky action never obscures content, keyboard focus, or mobile safe areas.
- Missing evidence is explicit and does not produce empty visual gaps.

### WS-5 — Finder and request-flow clarity [P1]

**Purpose:** Reduce uncertainty and form abandonment.

**Finder**

- Add a real `Step n of m` indicator, back action, answer recap, and result contract.
- Keep audience selection as the first branch, but make the outcome and handoff explicit.
- Distinguish “starting recommendation” from installer-confirmed sizing or permit decisions.
- Ensure finder state names are generated from the actual selected step/answer.

**Quote/contact/homeowner**

- Move the first meaningful input into the first viewport.
- Collapse reassurance into a compact “What happens next” panel.
- Progressive-disclose optional project detail.
- Preserve phone/human fallback without competing with the form’s primary CTA.
- Standardize validation, error summary, focus, success, and response expectation.

**Dealer/account**

- Keep retail/wholesale choice clear.
- Make required documents, review timing, and no-account escape hatch scannable.
- Use focused auth/form shells where the full commerce rail is unnecessary.

**Validation**

- Every flow has visible progress or a clear single-step contract.
- Submit success states tell the user what happens next and when to call.
- Error recovery preserves entered data and focus.
- No route is visually labeled as a later step while showing the initial state.

### WS-6 — Resource and tool IA [P1]

**Purpose:** Make guides, tools, documents, and external sources predictable.

**Implementation tasks**

- Introduce a discriminated `ResourceItem` model: `guide`, `tool`, `document`, `external`.
- Add common fields for type, audience, topic, updated date, and destination; add file/source behavior where relevant.
- Render type-specific labels and actions such as `Open tool`, `Read guide`, `Download PDF`, or `Open external source`.
- Add URL-backed search/type/topic filtering and a useful empty state.
- Add generated table of contents/anchor IDs to long guides; do not invent completion semantics for static articles.
- End tools with a clear route back to catalog, quote, or counter.

**Validation**

- Long titles, missing metadata, failed documents, external links, 320px, 200% zoom, keyboard, and screen-reader cases pass.
- Every resource tells the user what will happen before activation.

### WS-7 — Shell, token, and assistance cleanup [P2]

**Purpose:** Reduce visual noise after task-critical states are correct.

**Shell variants**

- `commerce`: full search, category rail, account/cart, local branch context.
- `service`: compact search, task navigation, local contact strip.
- `focused`: auth/forms/tools/errors with reduced chrome and one recovery path.

**Token cleanup**

- Establish one canonical token file for semantic surfaces, text, actions, type weights, radii, spacing, density, and shell heights.
- Resolve the 400/500 versus 600-weight drift.
- Decide whether deep-green utility/footer surfaces are intentional named exceptions or should be reduced to match `THEME.md`.
- Remove or deprecate compatibility aliases in a controlled migration.

**Assistance policy**

- Inline contact first, contextual chat second, floating chat only when no visible contact action exists.
- Suppress/reposition floating controls on forms, auth, and checkout recovery.
- Keep focus, labels, safe-area positioning, and human fallback correct.

**Validation**

- Content-to-first-action distance improves on finder, auth, forms, tools, and 404.
- No floating widget overlaps inputs, sticky actions, or focus rings.
- Visual snapshots show consistent type, spacing, and shell geometry.

### WS-8 — Screenshot and release QA [P0/P1]

**Purpose:** Make visual evidence dependable and prevent regressions.

**Implementation tasks**

- Add `data-screenshot-ready` markers with route-specific readiness conditions.
- Wait for fonts, image decode, catalog readiness, and relevant network idle before capture.
- Store machine-readable state metadata beside each screenshot.
- Assert expected heading, visible step, open menu, selected filter, image state, and primary action before writing a file.
- Generate contact sheets/review index from manifest metadata.
- Add visual regression groups for commerce states, media states, mobile catalog, PDP sticky action, finder steps, forms, resources, menus, and recovery.

**Validation**

- Manifest state labels match visible state markers.
- No capture is accepted when a skeleton, stale route, or wrong interaction state is present.
- Full responsive matrix and accessibility suite are rerun after the workstreams.

## 4. Delivery phases

### Phase 0 — 2–3 days: baseline and decisions

Deliver WS-0. Produce the state matrix, operational decision log, current metrics, and screenshot readiness contract.

### Phase 1 — 1–2 weeks: trust foundations

Deliver WS-1, WS-2, and the minimum of WS-8 needed to verify them. Do not redesign every page yet. This phase fixes misleading commerce/media states first.

### Phase 2 — 1–2 weeks: catalog and PDP

Deliver WS-3 and WS-4. Reuse the new commerce and media components. Validate desktop and mobile catalog journeys with contractor and homeowner scenarios.

### Phase 3 — 1–2 weeks: journeys and content

Deliver WS-5 and WS-6. Prioritize finder, quote, contact, dealer, auth, resource library, and guide navigation.

### Phase 4 — 3–5 days: system polish

Deliver WS-7 after measuring which shell and token changes materially improve task completion. Avoid a broad visual rewrite without evidence.

### Phase 5 — 2–3 days: release candidate

Complete WS-8, rerun existing tests, perform manual keyboard/screen-reader acceptance, and resolve remaining operational/content/counsel blockers from `DESIGN-REMEDIATION-STATUS.md`.

## 5. Ownership and dependencies

| Area | Primary owner | Dependency |
|---|---|---|
| Commerce states | Design engineering + commerce/backend | Operations policy approval for exact promises |
| Product media | Catalog/content + design engineering | Image verification and source records |
| Catalog/PDP | Design engineering | Commerce/media contracts |
| Finder/forms | Product/design engineering | Response-time and handoff copy approval |
| Resources/guides | Content + design engineering | Content taxonomy and source metadata |
| Shell/tokens | Design systems/design engineering | Approved theme decision |
| Screenshot QA | QA/design engineering | Stable state markers and test data |
| Release acceptance | Product owner + accessibility QA | Manual assistive-technology pass |

Do not hard-code fulfillment promises, response windows, rebate claims, return outcomes, or service-area commitments until the corresponding external approvals in the existing release status are complete.

## 6. Success measures

Track before and after by route, device, and user type:

- Time from page load to first meaningful action.
- Exact-model search success and zero-result recovery.
- Catalog filter apply, cancel, back/forward, and abandonment rates.
- Product-detail primary-action completion.
- Quote/availability request completion and missing-context rate.
- Finder completion, result-to-handoff rate, and step abandonment.
- Form validation retries and successful submission rate.
- Product-image coverage by exact/representative/missing/failed state.
- Percentage of screenshots that pass state-integrity assertions.
- Accessibility defects found in manual acceptance after automated checks.

## 7. Definition of done

The plan is complete when:

- Commerce state is typed, server-authoritative, and consistent across all buyer surfaces.
- Product media is explicit, stable, and provenance-aware.
- Catalog and PDP support fast comparison and preserve compatibility uncertainty.
- Finder, forms, tools, resources, auth, and error states expose a clear next action.
- Shell variants reduce unnecessary chrome without breaking navigation or accessibility.
- Tokens have one canonical source and visual snapshots show no unapproved drift.
- Screenshot manifests verify visible state instead of trusting filenames.
- Existing automated verification passes, manual assistive-technology acceptance is recorded, and all open external release blockers are resolved or explicitly owned.

## 8. Existing-plan alignment

This plan does not replace the detailed route-level remediation work. It reorganizes it around the five systemic audit risks. Continue using the existing plan for route-specific acceptance criteria, especially:

- catalog layout, filters, price/availability, media, resources, and brand cards;
- finder, homeowner, dealer, contact, quote, account, and checkout flows;
- menu, search, quick order, CSV, quote drawer, gallery, mobile filters, and validation states;
- operational, content, counsel, security, and manual accessibility release gates.

When a detailed remediation item conflicts with this plan, the shared semantic state/data contract wins; route-specific visual work should consume it rather than recreate it.
