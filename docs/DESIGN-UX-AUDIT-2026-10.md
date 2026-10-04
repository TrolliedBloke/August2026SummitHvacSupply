# Summit HVAC Supply — Staff-level design and UX audit

Audit date: 2026-10-03  
Evidence: 170 unique PNG screenshots, 161 manifest states, desktop and mobile, manifest generated 2026-10-04.  
Scope: public pages, catalog, product detail, quote/contact/dealer/homeowner flows, account portal, policies, resources/tools, menus, dropdowns, chat, finder, filters, and error state.

## Executive verdict

Summit has the right product idea: a local HVAC counter made searchable and self-service. The site is strongest when it behaves like a knowledgeable counter employee: it exposes exact models, explains what is and is not confirmed, gives a phone number, and routes homeowners, contractors, and trade buyers differently.

The quality bar is not yet consistently met for a production commerce experience. The highest-risk gap is not decoration; it is confidence. A buyer must quickly understand whether an item is purchasable, quote-only, available for pickup, or merely awaiting counter confirmation. That meaning is currently distributed across price text, status dots, and repetitive buttons. The second major gap is visual evidence: many catalog states use generic, missing, or delayed product imagery, including the initial home capture and multiple catalog cards. The third is information architecture: the global header/footer, category rail, resource system, account split, quote paths, and fulfillment language are individually reasonable but collectively too expansive for the short tasks customers are trying to complete.

Recommended release order: make commerce/fulfillment states explicit; make every product record visually trustworthy; simplify the catalog and product-detail decision path; then reduce global chrome and unify the form/tool patterns.

## A. Product understanding

### What the product is

Summit is a Bay Area HVAC equipment and parts supplier based in Newark. It serves as:

1. A searchable product catalog for exact HVAC models, SKUs, parts, and accessories.
2. A local fulfillment counter for Newark pickup, delivery, freight, and stock confirmation.
3. A trade-account portal for contractor pricing, saved equipment, order history, and repeat ordering.
4. A guided decision service for homeowners who do not know the right system or installer.
5. A reference center for refrigerants, permits, rebates, AHRI matches, model decoding, sizing, and operating cost.

The strongest positioning is “the counter, extended”: operational clarity and knowledgeable human support matter more than lifestyle merchandising.

### Likely users

- Contractors and mechanical firms: exact model lookup, compatibility, documents, stock, staging, will-call, delivery, repeat orders, and trade pricing.
- Homeowners: understand the system they need, find a qualified installer, buy one unit or request a quote without creating an account.
- Property managers and repeat buyers: equipment planning, multi-unit work, documents, saved lists, and account pricing.
- Internal counter staff: receive requests with enough context to verify model, stock, timing, and fulfillment.

### Primary journeys

**Known model → verify → request/quote/pickup.** Search by model or SKU, inspect exact specifications and documents, confirm compatibility and fulfillment, then request price or availability.

**Unknown system → guided match → installer handoff.** Start at System finder, answer audience and sizing questions, receive a matched starting point, then route to homeowner request or qualified installer.

**Contractor → trade account → repeat order.** Apply for an account, pass staff review, sign in for account pricing and saved equipment, then use quick order/upload workflows.

**Research → evidence → purchase decision.** Find a guide or tool, validate permits/rebates/refrigerant/AHRI information, then return to the catalog or contact the counter.

**Problem → human recovery.** If an item, price, delivery, or model is uncertain, call, message, or submit a focused request with clear expectations.

### Information architecture

The current IA is route-rich and SEO-aware: public/local landing pages, catalog, resources, lead flows, account, policies, and interactions are all represented. The downside is that the customer-facing model is more complex than the core decisions require. The top-level navigation exposes many product families while the footer exposes almost every content surface again. Resources combine guides, tools, documents, external sites, rebates, permits, refrigerants, and sizing in one large library. This is discoverable for search engines but not yet optimized for task completion.

### Visual language

The visual language is restrained and operational: warm white page surface, white cards, dark green actions/chrome, thin borders, neutral sans-serif type, monospace part numbers, line icons, and little decorative imagery. That is directionally correct. It reads more like a competent local counter than a generic lifestyle retailer.

The screenshots also show drift from the stated theme contract: the theme says green should mean “yes” and not be used for decorative fills, while the current shell uses a deep-green utility strip and large deep-green footer. The theme also specifies weights 400/500, while the captured UI and CSS still contain 600-weight headings and section labels. These are small in isolation, but they weaken the intended system-level discipline.

## B. Overall design assessment

### What is working

- The homepage immediately communicates location, local pickup, delivery, contractor versus retail paths, and contactability.
- Search is consistently prominent and supports the real vocabulary customers use: products, models, and SKUs.
- The distinction between listed price, price on request, and stock confirmed at order is honest; the problem is presentation, not the underlying intent.
- Product detail pages contain unusually valuable evidence: exact model, equipment type, capacity, voltage, refrigerant, warranty, manufacturer specifications, documents, AHRI certification, and related items.
- The homeowner/contractor split is clear on the finder and account entry surfaces.
- Quote, contact, and dealer forms explain why the information is requested and set a human-review expectation.
- Mobile navigation is a real two-level interaction rather than a desktop rail squeezed into a viewport. The screenshots show a sensible “Shop by category” drill-in and accordion footer.
- The 404 state is useful: it preserves search, home, categories, phone recovery, and the claim that cart/Z​​IP/sign-in are unchanged.
- Reuse is visible in code and screenshots: one product-card family, shared shell, repeated state patterns, shared forms, and a consistent footer.

### What is not working

- The initial and some catalog captures show blank, generic, or “Image coming soon” product media. In a hardware catalog, the image is a recognition aid and a trust signal, not decoration.
- Commerce meaning is too diffuse. “Check availability,” “Request price,” “Price on request,” “Quote required,” and “Stock confirmed at order” are related but not visually modeled as a single decision system.
- The catalog has high information density but low decision support. Filters are long pill lists; product cards are visually repetitive; compatibility and fulfillment distinctions are not easy to compare across items.
- The desktop shell is tall: utility strip, logo/search/account row, category rail, then page content. Finder, login/account, and other task pages inherit a lot of chrome for little benefit.
- The product detail is authoritative but long and flat. The buyer action, compatibility confidence, documents, and specs compete for attention rather than forming a clear decision sequence.
- The resource library is useful but card-heavy and flat. Guides, interactive tools, documents, and external sites need separate user expectations and stronger grouping.
- Most pages end with the same large footer and floating controls. This is consistent but expensive in vertical space and visually heavy on short tasks.
- Many forms start with a large hero or side panel before the user can act. The copy is trustworthy, but the first field and the expected response path are not always the strongest focal point.
- Some state captures are not self-validating. For example, the file named `10-interactions/desktop/finder-step-3.png` visibly shows the finder’s initial “Who is this for?” state rather than a third step. Unique files do not guarantee that the captured state matches its label.

### Overall quality level

**Good foundation, not yet a high-confidence commerce system.** The product strategy and content model are stronger than the visual decision system. The work feels like a carefully implemented release candidate whose operational constraints are visible, but it still needs a focused quality pass on trust, hierarchy, state modeling, and capture verification before the design can feel premium and effortless.

### Biggest opportunities

1. Turn fulfillment and pricing into a first-class visual language.
2. Treat product imagery and media provenance as catalog data quality.
3. Make the catalog an efficient comparison tool, not just a grid of records.
4. Reduce global chrome for tools, forms, auth, and error recovery.
5. Make the finder and quote flows visibly progress from intent to answer to handoff.

## C. Top 10 issues

### 1. P0 — The buying state is not explicit enough

**Screenshot/page:** `/products`, all 100-product catalog states; product pages such as `TCL24KODU`; homepage product strip; mobile catalog.

**Problem:** The customer sees a mixture of price, “Price on request,” “Quote required,” “Stock confirmed at order,” “Check availability,” and “Request price.” These are not presented as one clear state model. The cards look structurally identical even when the next action and commercial certainty differ.

**Why it matters:** HVAC equipment is high-consideration and often time-sensitive. Unclear status creates false purchase confidence, makes cards difficult to compare, and increases counter-side clarification work. It also makes the site feel less trustworthy even when the underlying business rule is correct.

**Recommended solution:** Define four visible commerce states: `Ready to request`, `Price confirmed`, `Quote required`, and `Unavailable/needs help`. Each state should have a compact label, one sentence of explanation, one primary action, and an optional fulfillment selector. Put the state beside the product title and repeat the same wording in list, detail, quote, and checkout recovery.

**Implementation considerations:** Create a typed `CommercePresentation` object with `state`, `headline`, `supportingCopy`, `primaryAction`, `secondaryAction`, and `fulfillmentConfidence`. Render it through one `CommerceStateBlock` in `ProductCard`, `ProductPurchasePanel`, related cards, and quote summaries. Test every state at desktop, mobile, signed-out, and signed-in tiers. Do not encode meaning only by dot color.

### 2. P0 — Product media is not consistently trustworthy

**Screenshot/page:** homepage initial capture; `/products`; mobile catalog; multiple SKU pages with blank/placeholder media; states marked “Image coming soon.”

**Problem:** The audit includes blank card media, generic white mini-split images repeated across different records, image placeholders, and product pages where the media area is visually under-informative. The later homepage capture shows loaded imagery, but the first capture exposes a fragile loading/verification boundary.

**Why it matters:** A contractor often recognizes equipment faster visually than by title. Incorrect or absent images increase model-selection risk and make the catalog look unfinished.

**Recommended solution:** Use explicit media states: verified exact-model image, verified family image, no image available, and loading. Add a small “Image verified for model …” or “Representative family image” note on detail pages. In listing cards, preserve a stable image frame and use a deliberate neutral placeholder rather than an accidental blank.

**Implementation considerations:** Make `imageStatus` part of the catalog schema and require alt/provenance metadata. Do not silently reuse a family image as if it were exact-model media. Add screenshot assertions that wait for the intended image state and that fail when a route’s manifest says “loaded” but the DOM still shows a skeleton or placeholder.

### 3. P1 — The global shell consumes too much attention and vertical space

**Screenshot/page:** desktop homepage, catalog, finder, forms, account, resources, and error state; mobile home and menu states.

**Problem:** Desktop pages carry a utility strip, logo/search/account row, and a full category rail before content. The footer repeats many of the same destinations in a large dark block. Mobile adds a persistent branch/status section and long footer content after every page.

**Why it matters:** The shell is valuable for catalog work but overpowered on auth, tools, forms, policies, and error recovery. It delays the task, increases scroll cost, and makes small state differences less visible.

**Recommended solution:** Use three shell modes: `commerce` with full search/category rail, `service` with compact search and task navigation, and `focused` for auth/forms/tools with a reduced header and one recovery link. Keep a compact local-contact strip available without repeating the full footer on every short task page.

**Implementation considerations:** Add a `ShellVariant` API to the layout rather than route-specific CSS exceptions. Keep the same logo, focus behavior, and accessible landmarks. Measure content-to-first-action distance as a regression metric.

### 4. P1 — Catalog filtering is exhaustive, not decision-oriented

**Screenshot/page:** `/products`, desktop sidebar and mobile catalog.

**Problem:** Categories, brand, capacity, voltage, unit type, refrigerant, and pricing are exposed as many pills and checkbox rows. The user gets a large taxonomy but not a clear summary of what changed, why the result count changed, or which filters matter most for the current task.

**Why it matters:** Contractors often know one or two constraints—brand, capacity, refrigerant, indoor/outdoor unit—but the current filter stack makes the user scan a long sidebar. On mobile, the filter control is compact but the resulting cards are tiny and repetitive.

**Recommended solution:** Lead with task filters: `I know the model`, `I need a complete system`, `I need a component`, and `I need parts`. Then expose progressive filters relevant to that choice. Show an applied-filter summary, result count, clear-all, and a compatibility warning when mixing indoor/outdoor or refrigerant families.

**Implementation considerations:** Keep the underlying facet model, but add a `FilterPreset` layer and URL-serializable applied state. Use a filter drawer on mobile with a sticky Apply/Close footer. Track filter abandonment and zero-result recovery.

### 5. P1 — Product detail is authoritative but not scannable enough

**Screenshot/page:** SKU detail pages, especially `TCL24KODU`.

**Problem:** The page contains strong evidence, but the content hierarchy is long and mostly flat: product action, warranty, wholesale account, specifications, documents, AHRI, and related items all appear in one extended flow. There is no strong sticky summary that keeps model, price/quote state, compatibility, and fulfillment visible as the user reads.

**Why it matters:** Buyers need to decide whether this exact record is the right component before reading every spec. The page currently rewards thorough reading but not fast verification.

**Recommended solution:** Make the top section a decision panel: exact model, component role, compatibility summary, commercial state, fulfillment choices, and primary request action. Add a sticky desktop buy/quote bar and a mobile bottom action bar. Group evidence into tabs or accordions: `Overview`, `Compatibility`, `Specifications`, `Documents`, `Warranty`.

**Implementation considerations:** Preserve semantic headings and deep links. Build a `ProductEvidenceSection` configuration so every SKU page uses the same ordering even when fields are absent. Keep source links adjacent to the claim they support.

### 6. P1 — Finder, tools, and resources do not show enough progress or outcome

**Screenshot/page:** `/finder`, `finder-step-3`, `/resources`, sizing/rebate/AHRI/model tools.

**Problem:** The finder’s initial surface is clear but visually sparse, and the interaction capture labeled step 3 appears to show the initial step. Resource cards combine several content types under the same visual treatment. Tool pages use similar form shells but do not always make the expected output or handoff obvious before interaction.

**Why it matters:** Guided flows are supposed to reduce uncertainty. If progress, expected time, evidence quality, and result format are unclear, users may abandon before reaching the handoff.

**Recommended solution:** Use a real step indicator with `Step n of m`, a concise answer recap, back/next controls, and a result contract: “You’ll get a starting size, matched systems, and installer handoff.” In resources, separate `Tool`, `Guide`, `Document`, and `External source` cards with distinct metadata and action labels. Show the result or next action above the fold after each tool.

**Implementation considerations:** Make screenshot state IDs generated from the actual interaction state, not a manually typed filename. Add a manifest validator that asserts the visible step, selected answer, and URL/query state. Model resource type as a discriminated union and render type-specific cards.

### 7. P1 — Forms are credible but too front-loaded

**Screenshot/page:** `/quote`, `/contact`, `/dealers`, homeowner flow, account creation/reset.

**Problem:** Forms often place a hero, explanatory copy, image or reassurance panel, and long preamble before the first meaningful input. The copy sets expectations well, but the primary action is separated from the reason the user came to the page.

**Why it matters:** Quote and contact users are already expressing intent. Every extra visual block before the first field increases perceived effort, especially on mobile.

**Recommended solution:** Move the first decision/input into the first viewport. Keep the expectation copy as a compact “What happens next” block beside or below the form. Use progressive disclosure for optional project details and only request information needed for the current branch.

**Implementation considerations:** Create a shared `RequestFormFrame` with `intro`, `step`, `fields`, `assurance`, and `success` slots. Keep field schema and server validation shared, but allow layout variants. Ensure error summary, inline errors, and focus return are identical across all flows.

### 8. P2 — The visual system has measurable token drift

**Screenshot/page:** all pages; especially headings, footer, cards, and green surfaces.

**Problem:** The declared theme calls for black/white/green, 400/500 typography, 6px controls, 12px cards, and restrained surfaces. The CSS and screenshots still use 600-weight headings, a large deep-green utility/footer treatment, many rounded filter pills, shadows in navigation disclosures, and multiple compatibility aliases.

**Why it matters:** Token drift creates one-off judgment calls. It makes the product feel less intentional and raises the cost of maintaining every route.

**Recommended solution:** Establish a small token contract and lint against it: typography weights, type scale, border/radius families, surface roles, action colors, and spacing rhythm. Treat large green surfaces as a named shell/footer exception, not as general brand color.

**Implementation considerations:** Remove compatibility aliases in stages, or map them to a single canonical token file with deprecation comments. Add visual snapshots for typography and shell geometry. Avoid solving systemic drift with local Tailwind overrides.

### 9. P2 — Repeated chrome and floating widgets compete with primary actions

**Screenshot/page:** all long pages; chat-open; account-menu; mobile home/catalog.

**Problem:** The floating chat affordance and black circular widget appear across the audit, including near forms and product actions. Account and chat popovers are useful but add another layer of attention to an already busy header. The footer’s repeated calls to action also compete with page-specific actions.

**Why it matters:** Secondary helpers should reduce uncertainty, not create another competing focal point. On mobile, these controls occupy scarce edge space near form fields and catalog cards.

**Recommended solution:** Define an assistance priority: inline counter contact first, contextual chat second, floating chat only when there is no visible contact action. Suppress or reposition the widget on focused forms, auth, and checkout recovery. Keep one primary CTA per viewport.

**Implementation considerations:** Add route-aware widget policy and safe-area positioning. Ensure chat has a meaningful accessible label, focus management, and a visible human fallback. Instrument open-to-submit and abandonment rather than only open count.

### 10. P2 — Screenshot audit evidence needs stronger state integrity

**Screenshot/page:** all interaction states; notably `finder-step-3.png` and initial/loading captures.

**Problem:** The manifest is broad and duplicate-free, but a screenshot filename can still disagree with the visible UI. The finder interaction labeled step 3 shows the “Who is this for?” entry state. The homepage also has both unloaded-looking and loaded-looking product strips. This makes it difficult to know whether a visual defect is product behavior, capture timing, or the intended state.

**Why it matters:** A design audit is only as trustworthy as its state evidence. Ambiguous captures lead to incorrect remediation and can hide regressions.

**Recommended solution:** Store state metadata next to each image: route, viewport, interaction action, expected visible marker, network-idle condition, and capture timestamp. Add a review index with thumbnails and state labels generated from the DOM, not hand-authored names.

**Implementation considerations:** In Playwright, wait for `document.fonts.ready`, image decode, catalog readiness, and a route-specific `data-screenshot-ready` marker. Assert the expected heading, selected step, open menu, applied filter, and visible primary action before writing the file.

## D. Design system audit

### Typography

The neutral sans-serif and monospace identifiers are appropriate. Headings are clear and often well-sized. The main issue is weight and scale drift: screenshots and CSS use 600-weight headings despite the theme’s 400/500 rule, while metadata can become too small in cards and mobile catalog rows. Use a compact type scale with explicit roles: page title, section title, item title, body, metadata, and identifier. Keep minimum readable metadata at 12–13px and never rely on weight alone for state meaning.

### Colors

Warm white and dark green establish a recognizable local-counter identity. Green action buttons and status accents work. The system needs stricter semantic ownership: primary action, availability/success, utility chrome, and footer surface should not all feel like the same green meaning. Keep warning/error colors restrained but explicit, and pair every status color with text or icon.

### Spacing

The system is generally calm, with generous desktop whitespace. The problem is distribution: finder and auth pages have very large unused regions, while catalog cards compress many low-contrast facts together. Define page-level density modes (`catalog`, `detail`, `form`, `reading`) instead of applying one generous rhythm everywhere.

### Components

Good candidates already visible: site shell, product card, branch status, stock badge, form fields, dialogs, mobile menu, resource card, footer, quote drawer, and chat widget. The missing abstraction is a shared decision/state component that can appear consistently in cards, product detail, related products, quote rows, and checkout recovery.

### Buttons and actions

Buttons are visually consistent and touch-sized. The action vocabulary is too broad and sometimes ambiguous. Prefer verbs that describe the outcome: `Request a price`, `Check pickup`, `Ask about compatibility`, `Add to quote`, `Apply for account`, `Continue`. Put the primary action first and avoid giving every product card the same visual weight if actions differ.

### Forms

Labels, required markers, selects, textareas, and multi-step forms are clear. Standardize field help, optional-field treatment, error placement, and success confirmation. Add a compact progress/expectation block to all multi-step flows. Keep the contact/phone fallback visible without making it a competing CTA.

### Cards

Cards provide containment but are overused for repeated content. Product cards need stable image frames, stronger commercial state, and a compact comparison mode. Resource cards need type-specific layouts. Avoid putting every explanation inside a bordered card; use sections and dividers where grouping is enough.

### Navigation

Desktop navigation is comprehensive and keyboard-aware, and the mobile menu has a good two-level model. The category rail should be task-prioritized, with fewer top-level families and a clear path to all products. Consider a compact sticky search/action bar after the first scroll rather than keeping every navigation tier equally prominent.

### Icons

Line icons are consistent and appropriately restrained. They should support labels, not substitute for them. Verify that the black floating widget and chat control have understandable accessible names and do not cover content or focus targets.

### States

Loading, missing image, quote required, confirmation, error, and 404 states exist. They need stronger shared anatomy and capture assertions. Every state should answer: what happened, what can I do now, and how certain is the information?

### Responsive behavior

The mobile IA is intentionally different and the menu/footer collapse well. The mobile catalog is the weakest responsive experience: small image thumbnails, dense metadata, many repeated buttons, and a very long scroll. Add a mobile result summary, sticky filter/sort control, and a compact list mode with fewer repeated labels. Keep critical fulfillment and price meaning visible without opening a card.

## E. UX / user-flow audit

### Homepage → catalog

The two-door retail/contractor split is a strong entry. The homepage then presents product cards, categories, A2L guidance, system selector, trust points, and contact. Reduce the number of competing follow-up blocks. Use the first product strip for a clear “browse confirmed catalog” task and put educational/compliance content after the user’s first decision.

### Search → product

The search field is appropriately prominent. Search results should show why a result matched—exact SKU, model, family, or keyword—and use the same commercial state block as product detail. For model-number searches, lead with exact matches and suppress loosely related parts until the exact record is resolved.

### Catalog → quote or availability

The current flow is honest but asks users to infer what happens next. A user should select a fulfillment intent—pickup, delivery, or quote—and then provide ZIP/project context only when needed. Preserve the selected product, SKU, quantity, and desired date in the request summary.

### Product detail → compatibility

The page provides strong specs and AHRI evidence. Move the compatibility result closer to the main action. Where a component cannot be safely paired from one record, say so directly and offer `Find a matched system` or `Ask the counter` rather than relying on related products.

### Finder

The audience split is a good first question. Add progress, a back path, and a visible answer recap. The result should explain what is known, what still requires installer verification, and the exact next handoff. The finder must never look complete while still showing the initial question.

### Quote

The request page is credible and appropriately says staff will confirm pricing and lead times. Reduce the preamble, let users add products or describe a project in one obvious path, and show a post-submit confirmation with expected response channel and what to do for time-sensitive work.

### Dealer account

The retail/wholesale choice is clear. The multi-step application is appropriately cautious. Make the required documents and review timing more scannable, save progress only if the product can explain privacy/retention, and preserve a clear “one part, no account needed” escape hatch.

### Resources/tools

The library contains meaningful content and good metadata. Split browsing by intent and set expectations for external tools/documents. Every tool should end in a next step back to the catalog, quote, or counter.

### Account/auth

The account choice page communicates retail versus wholesale well. Auth screens are visually quiet but inherit more shell than necessary. Use a focused auth layout and provide explicit recovery states with one next action.

### Error recovery

The 404 is one of the better states in the set. Apply the same recovery discipline to unavailable prices, missing images, empty search, zero-filter results, failed forms, and checkout/quote errors.

## F. Staff-level recommendations

### Highest leverage

1. **Create the commerce state system first.** Make every price, stock, pickup, delivery, and quote condition render from one semantic model.
2. **Make the catalog dataset visually accountable.** Store image verification/provenance and enforce a stable placeholder policy.
3. **Rebuild the product decision surface.** Put model identity, compatibility, commercial state, and fulfillment action into one above-the-fold panel with a sticky summary.
4. **Introduce shell variants.** Full commerce shell for catalog; compact service shell for forms/tools; focused shell for auth/error/recovery.
5. **Turn the finder into a measurable funnel.** Persist step, answer recap, result quality, installer handoff, and abandonment events.
6. **Consolidate resource types.** Use a typed content model and type-specific card/action patterns.
7. **Standardize request forms.** One frame, one validation contract, one success/recovery pattern, route-specific fields only.
8. **Add visual QA contracts.** Route-specific screenshot readiness, expected state markers, and a generated review index.

### Suggested component architecture

```text
AppShell
├── UtilityContext
├── SearchContext
├── PrimaryNav / MobileNav
├── PageIntro
├── CommerceStateBlock
├── ProductCard / ProductDecisionPanel
├── FulfillmentSelector
├── RequestFormFrame
├── EvidenceSection
├── ResourceCard(type)
├── AssistancePolicy
└── FooterVariant
```

### Suggested tokens

Keep one canonical source for:

- semantic surfaces: page, surface, elevated, band, inverse;
- semantic text: primary, secondary, muted, inverse, success, warning, danger;
- action roles: primary, secondary, quiet, destructive;
- type roles and weights, with 400/500 as the default contract;
- spacing steps and page density modes;
- control/card radii and touch targets;
- shell heights by variant, not by route;
- state icon + text requirements.

### Release validation

Add a visual/interaction gate for:

- exact versus representative versus missing product image;
- all commerce states in card, detail, quote, and mobile list modes;
- finder step and answer recap correctness;
- zero results and failed availability request;
- form errors and success confirmations;
- 200% zoom and keyboard/screen-reader journeys;
- mobile 320–390px catalog and form layouts;
- screenshot manifest labels matching visible state markers.

## G. Proposed end state

The ideal Summit site should feel like a very good counter employee who happens to have a precise online catalog. The top of every page should make the customer’s current job obvious: search a model, choose a system, request a price, verify fulfillment, apply for trade access, or talk to the counter.

The catalog should feel like a dependable parts wall: every image is either exact, clearly representative, or intentionally absent; every SKU has a stable identity; filters explain themselves; and every card communicates what can happen next. The product page should feel like a verified spec sheet plus a clear service desk, not a long document with a button near the top.

Homeowners should get a short, reassuring guided path that ends in a matched starting point and installer handoff. Contractors should get fast exact-model retrieval, compatibility evidence, trade-account value, and repeat-order tools. Resources should answer real questions and return users to a decision. Forms should ask only what staff need, explain the handoff, and confirm what happens next.

Visually, the product should remain restrained, warm, and operational. Keep the strong green/neutral identity, the search-first posture, exact-model evidence, local contact details, and honest uncertainty. Remove visual ambiguity, redundant chrome, accidental placeholders, and one-off state treatments. If the system is implemented around semantic commerce states, typed resources, shell variants, and shared request/evidence components, the website will become substantially easier to trust, use, test, and extend.

## Audit evidence index

Representative evidence reviewed from the full manifest:

- Homepage and loaded/account-menu states: `01-public/desktop/home.png`, `10-interactions/desktop/account-menu.png`.
- Catalog and mobile catalog: `02-catalog/desktop/home-products.png`, `02-catalog/mobile/home-products.png`.
- Product detail and related records: `02-catalog/desktop/home-products-sku-tcl24kodu.png` plus the complete SKU set 046–145.
- Finder and interaction state: `04-lead-flows/desktop/home-finder.png`, `10-interactions/desktop/finder-step-3.png`.
- Forms: `04-lead-flows/desktop/home-quote.png`, `home-contact.png`, `home-dealers.png`, and all mobile counterparts.
- Resources/tools: `03-resources/desktop/home-resources.png` and tool routes 041–045.
- Account/auth: routes 017–021 and mobile route 157.
- Navigation/chat/mobile menu: interaction states 146–148 and 159–160.
- Recovery: `09-other/desktop/not-found-error-state.png`.

The report is based on the screenshots as the source of truth for visual behavior, with repository theme and component files used only to connect findings to implementation patterns.
