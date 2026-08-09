# Catalog research and launch-readiness plan

**Scope:** turn the 100-SKU inventory catalog into a model-level, source-backed
product catalog, and close the launch checklist.

**Written:** 2026-08-09. Supersedes the "must fix before launch" list in the
audit response of the same date.

---

## 1. What research can and cannot resolve

Three constraints are load-bearing. Everything downstream is sequenced around
them, so they are stated first rather than discovered in week two.

### 1.1 — 26 of 100 SKUs have no model number to research

| Group | Count | Model number present |
|---|---:|---|
| Carrier | 11 | 11 |
| Tosot | 29 | 29 |
| TCL | 37 | 34 |
| Unbranded accessories | 23 | **0** |

The 23 unbranded rows are base pads, duct covers, elbows, corner/coupling/end
covers, flex hose, T-joints, line sets, a disconnect, wire and conduit. The
sheet gives them no manufacturer and no model. Three more are unresearchable as
written: `TCL24KMZIDU` (sheet says "THEY DONT MAKE IT"), and `TCLCASPAN01` /
`TCLCASPAN02`, whose model cells hold the label text "Cassette Panel 01/02"
because of a column shift.

**A model-level research pass cannot produce specifications, warranty,
submittals, AHRI records or exact-model imagery for these 26.** No amount of
searching fixes a missing manufacturer. They need either a supplier/part number
from Summit, or they stay as generic accessories with a category, a dimension
parsed from the name, and Quote Only pricing. That is a legitimate outcome for
a bag of line-hide covers; it is not a research failure.

### 1.2 — On-hand inventory does not exist anywhere

`Current Stock` is `#N/A` on 92 rows and blank on the other 8. `#N/A` is a
broken spreadsheet lookup, not a zero. I traced every other candidate source:

- `data/catalog/inventory-source.csv` — the only inventory input; no quantities
- `supabase/migrations/*` — `inventory_lots` exists but is seeded with demo data
- `src/lib/backend/mock-data.ts` — demo fixtures, explicitly non-production
- No inventory API, no ERP connection, no other CSV in the repository

**There is no data pipeline to fix.** The quantity was never captured. Research
cannot invent it. This is the single largest launch blocker and it is resolved
by Summit exporting real counts, not by this project.

### 1.3 — Research cannot set Summit's selling price

77 SKUs have no `Sell Price`. Manufacturer MSRP and distributor list prices are
other companies' numbers; publishing them as Summit's price would be wrong in
both directions. Where `Unit Cost` exists (42 rows) a price follows from a
margin rule, and that rule is a business decision.

**Default outcome: everything without a confirmed price ships as Quote Only.**
That satisfies "never a blank price" and "never a fabricated price"
simultaneously.

### 1.4 — One requirement in the brief contradicts another

> Remove "Availability confirmation required" … present availability
> professionally based on the actual data … never fabricate stock.

With zero quantities, any availability state is either fabricated or a variant
of "we will confirm". The resolution is **wording, not data**: drop the copy
that narrates the database ("the inventory source does not contain a verified
on-hand quantity") and replace it with a normal trade phrasing that a supply
house would actually use, e.g. *"Stock confirmed at order — Newark will-call or
Bay Area delivery"*, plus a live counter phone number. When §1.2 is resolved,
the same component renders real counts with no further UI work.

---

## 2. Human decision gate — start day 1, runs in parallel

None of these can be researched. All of them block a "COMPLETE" status on a
launch item, and they are the long pole, so they are opened before any
engineering starts.

| # | Decision needed | Blocks | Owner |
|---|---|---|---|
| H1 | Export real on-hand counts for all 100 SKUs from wherever they are actually tracked (counter system, QuickBooks, a physical count) | Availability, purchase flow | Summit ops |
| H2 | Pricing rule: markup % on `Unit Cost`, or explicit Quote Only per SKU | 77 unpriced SKUs | Summit owner |
| H3 | For each of the 9 duplicate-SKU collisions, which refrigerant variant is physically on the shelf — or are both stocked? | Catalog identity | Warehouse |
| H4 | Manufacturer/supplier + part number for the 23 unbranded accessories | 23 SKUs of research | Purchasing |
| H5 | Returns window, restocking %, freight-damage terms — confirmed policy, with counsel sign-off | Returns page, buy box | Summit owner + counsel |
| H6 | Wholesale pricing model: tiers, discount %, who qualifies. No contractor pricing exists in the sheet at all (`dealerPrice` is 0 for all 100) | Entire wholesale flow | Summit owner |
| H7 | `TCL24KMZIDU` — sheet says "THEY DONT MAKE IT". Delist, or supply the real model? | 1 SKU | Purchasing |

**H1, H2, H3 and H6 each independently prevent transactional launch.** H5
prevents publishing return terms. Until H1 and H6 land, the site is a
quote-request catalog, which is a fine thing to launch and is roughly where it
already is.

---

## 3. Realistic yield forecast

Documentation depth varies enormously by brand. Promising "100/100 verified"
would be dishonest, so here is the expectation before starting:

| Brand | SKUs | Expected outcome | Why |
|---|---:|---|---|
| Carrier | 11 | High — submittals, install manuals, warranty, AHRI all published | Carrier maintains full public technical libraries |
| TCL | 37 | Moderate — product pages and some manuals; AHRI patchy | TCL's US HVAC documentation is newer and thinner |
| Tosot | 29 | Moderate to low — GREE-derived docs, scattered hosting | Manuals exist (one is already cited in `research-overrides.json`) but are not systematically published |
| Unbranded | 23 | Near zero without H4 | No manufacturer to search |

**Forecast: ~40–55 VERIFIED, ~20–30 PARTIALLY VERIFIED, ~25–35 UNVERIFIED.**
The UNVERIFIED band is dominated by the 23 unbranded accessories and is the
correct result for them, not a shortfall.

AHRI applies to matched systems, not loose components. Of the 100 SKUs, roughly
20–25 could carry an AHRI certificate (Carrier condenser/coil/air-handler
combinations, TCL and Tosot central and mini-split matched pairs). Indoor heads
sold alone, cassettes, panels, line sets and accessories have none. Expect
"Not Applicable", not "Not Found", for most of the catalog.

---

## 4. Build the pipeline before researching anything

The repository already anticipated this work. `data/catalog/research-overrides.json`
holds per-SKU overrides with an evidence array (`fieldName`, `value`,
`sourceUrl`, `sourceType`, `retrievedAt`, `status`, `notes`), the importer
applies them, and `research-ledger.generated.json` reports what is still
missing. **Research output goes into that file.** Do not invent a parallel
system.

### Phase 1 — schema and pipeline (≈1 day, engineering)

1. Extend `research-overrides.schema.json` to the full field set: identity,
   electrical (MCA/MOCP/phase/frequency), performance (SEER2/EER2/HSPF2/COP),
   physical (dimensions/weight/sound), fuel type, connections, warranty object,
   documents array, AHRI object, images array with `imageConfidence`.
2. Every populated field carries `{ value, source, sourceType, retrievedAt,
   confidence }`. `sourceType` ∈ manufacturer | ahri | official_document |
   distributor | other. A field without a source does not render as fact.
3. Extend `CatalogRecord` and `StorefrontSku` to carry the new fields, keeping
   the cost-free boundary established in `15c37e5`.
4. Per-SKU `researchStatus` ∈ VERIFIED | PARTIALLY_VERIFIED | UNVERIFIED |
   CONFLICT. `CONFLICT` never silently picks a winner; it records both values
   and surfaces in the admin catalog view.
5. Only populate fields that apply to the product type. A furnace has AFUE and
   no SEER2; a line set has neither. Drive this from a per-type field manifest
   so the UI cannot render an empty "SEER2" row on a base pad.
6. Generate the 100-row research matrix as a build artifact
   (`data/catalog/research-matrix.generated.md`) so coverage is reportable at
   any moment, not only at the end.

### Phase 2 — pilot on Carrier (11 SKUs, ≈half a day)

Carrier has the best documentation, so it validates the schema end to end
before 89 more SKUs are poured through it. Pilot must produce, for all 11:
model confirmation, submittal PDF, install manual, warranty document, AHRI
lookup result, exact-model image, and full electrical/physical specs.

If the schema survives Carrier unchanged, it will survive the rest. If it does
not, fixing it here costs 11 records instead of 100.

---

## 5. Research execution — all 100 SKUs

Batched by manufacturer and family, because documentation lives in the same
place for each family and one located library serves many SKUs.

| Batch | SKUs | Contents |
|---|---:|---|
| B1 | 11 | Carrier — 3 condensers (26SCA5), 3 coils (CVAMA), 3 air handlers (FJ5), 2 furnaces (58SC0B) |
| B2 | 19 | TCL mini-split indoor/outdoor pairs (TSC-*, H*SEH*, H*SBH*) |
| B3 | 8 | TCL multi-zone outdoor (H*FMH*, TUM-*) |
| B4 | 10 | TCL central — air handlers (H*AHH*) and heat pumps (H*TDH*) |
| B5 | 14 | Tosot mini-split (TWH*) |
| B6 | 8 | Tosot multi-zone (TM*MO) and central (TU*) |
| B7 | 12 | Cassettes and panels — TCL H*CSHU*, Tosot TM*BKDI, TF05/TF06 |
| B8 | 5 | Controls + oddities — XK-120D2-50, TCL24KMZIDU, TCLCASPAN01/02 |
| B9 | 23 | Unbranded accessories — **gated on H4** |

Per SKU, the research loop is fixed so coverage is uniform:

1. Manufacturer product page for the exact model
2. Manufacturer technical library — submittal, spec sheet, engineering data
3. Installation manual (usually where MCA/MOCP/dimensions/weight actually live)
4. Warranty document, and confirm it names this model or its family
5. AHRI directory search by model; record reference number or mark N/A
6. ENERGY STAR / CEC databases where the product type qualifies
7. Reputable distributor documentation only to fill remaining gaps
8. Exact-model image; mark `family_level` when only a family image exists

Rules that are non-negotiable during execution:

- Never carry a spec from a sibling model. `H36SEH19XAE` and `H36SEH19XAC` are
  different units; the sheet already pairs them by capacity, which is exactly
  the trap.
- A document is attached only after confirming it covers the model. A
  same-manufacturer PDF is not evidence.
- An outdoor unit's standalone rating is not the matched-system rating. Where a
  matched combination is required, record the certified combination or record
  nothing.
- Conflicts get both values and a `CONFLICT` status. No silent resolution.
- Discontinued models are researched as themselves and marked discontinued,
  with a successor recorded only if the manufacturer documents one.

**Effort: this is the bulk of the project.** At roughly 6–10 source fetches per
SKU, batches B1–B8 are ~600 fetches over 77 SKUs. Spread across sessions,
budget several working days. Speed is explicitly subordinate to accuracy here.

---

## 6. Website implementation

### Phase 6a — product detail page

Restructure around what a contractor asks, in order: what is this exactly, is
it the right configuration, what does it cost, is it available, what are the
specs, what is the warranty, where is the submittal, is it a matched system.

- Specifications table driven by the per-type field manifest
- **Documents section** with real links — submittal, install manual, spec
  sheet, warranty, AHRI certificate. This is the single highest-value addition
  for the wholesale audience and today it renders 0 documents for 100 products.
- Warranty block showing actual terms, registration requirement, and source
- AHRI block with reference number and certified combination, or an explicit
  "not applicable to a component sold individually"
- Image gallery honest about `family_level` vs exact-model
- Provenance line: every fact traceable to source, visible on hover or in an
  expandable "sources" disclosure

### Phase 6b — catalog, cards, search, filters

- Cards carry model number, capacity, refrigerant, and a real availability state
- Filters gain fuel type, refrigerant, SEER2 band, phase, and document
  availability ("has submittal") — the last is a genuine contractor filter
- Search indexes the newly populated fields, extending the tokenized matcher
  already in `searchStorefrontSkus`

### Phase 6c — availability copy (§1.4)

Replace database-narrating copy with trade phrasing. One component, two states,
switched by whether a real quantity exists. Ships before H1 lands and starts
showing real counts the moment it does.

### Phase 7 — wholesale / retail split (≈2–3 days, gated on H6)

- Account type on `user_profiles` (retail | contractor), applied at registration
- Contractor application review flow — `/dealers` already collects applications
- Wholesale pricing visible only after authentication **and** approval; enforced
  server-side in the checkout/pricing path, never by hiding it in the client
- Retail purchase flow end to end, gated on H1 (cannot sell unknown stock) and
  H2 (cannot sell unpriced goods)
- Verify no wholesale price reaches an anonymous bundle — same class of leak as
  the `unitCost` issue already fixed; add the equivalent regression test

### Phase 8 — performance (≈half a day)

- `public/site/avatar-*.png` are 2.3–2.5 MB each and `warehouse-fulfillment.png`
  is 2.1 MB. Convert to WebP at sensible dimensions; expect >90% reduction
- Catalog JSON shipped to the client is 115 KB and will grow substantially once
  research lands. Split the record: a small browse projection (sku, title,
  brand, capacity, price, availability, image) for client components, full
  detail server-only. This must happen **before** research inflates the file,
  or the client bundle grows several-fold
- Route-level code splitting for the admin and portal trees

### Phase 9 — testing and final audit (≈1 day)

- Fix the Playwright config for a production-like server, run the suite, fix
  real failures
- Manual passes: homepage, catalog, search, filters, PDP, documents, retail
  registration, login, wholesale application, pricing visibility by role,
  quote-only products, availability states, mobile at 390×844
- Regression tests: cost never in a client bundle; wholesale price never in an
  anonymous response; no product renders a spec field that does not apply
- Produce the final launch-item table with COMPLETE / COMPLETE WITH CAVEAT /
  REQUIRES HUMAN DECISION / BLOCKED

---

## 7. Sequencing

```
H1-H7 (human)   ████████████████████████░░░░░░░░  open day 1, longest pole
Phase 1 schema  ██
Phase 2 pilot     █
Phases 3-5 res.    ████████████████████            the bulk of the work
Phase 6 UI              ░░░░████████               starts once schema is proven
Phase 7 wholesale            ░░░░░░░░████          gated on H6
Phase 8 perf                  ██                   do before research inflates JSON
Phase 9 test/audit                    ████
```

Research (5) and UI (6) overlap deliberately: the schema is fixed after the
pilot, so pages can be built against it while records are still filling.

---

## 8. Definition of done

Per SKU:

- [ ] Manufacturer and exact model confirmed against a manufacturer source, or
      explicitly marked UNVERIFIED with the reason
- [ ] Every populated field carries a source URL and source type
- [ ] Product type correct, and only applicable fields populated
- [ ] Warranty recorded with its source document, or flagged uncertain
- [ ] Documents attached only after confirming model coverage
- [ ] AHRI reference recorded, or marked Not Applicable / Not Found
- [ ] Image present with `exact` or `family_level` confidence and a source
- [ ] Price set, or explicitly Quote Only
- [ ] Availability from real data, or the professional pending state
- [ ] `researchStatus` assigned

Catalog-wide:

- [ ] 100 rows in the research matrix, no gaps
- [ ] 0 `=AI()` formulas and 0 blank names in the source sheet
- [ ] 9 collisions resolved against physical stock, not renamed to satisfy a
      unique constraint
- [ ] No customer-facing copy describing internal data limitations
- [ ] Returns/warranty policy either confirmed by the business or not asserted
- [ ] Build, typecheck, lint, unit tests and Playwright all green

---

## 9. Honest bottom line

Phases 1, 2, 8 and 9 are straightforward engineering and will complete.

Phases 3–5 will complete for the 77 branded SKUs at the yield forecast in §3 —
good for Carrier, mixed for TCL and Tosot. They cannot complete for the 23
unbranded accessories without H4.

Phases 6 and 7 will complete structurally, but the site cannot transact until
H1 (stock), H2 (price) and H6 (wholesale model) are answered. Those are
business inputs, not engineering tasks, and no amount of research substitutes
for them.

The achievable end state without any human input is **a fully researched,
source-backed, quote-first catalog** that a contractor can trust for model
identity, specifications, documentation and warranty. The step from there to a
transactional store is H1, H2 and H6.

---

## Appendix A — Source libraries located during research

Recording these because locating a manufacturer's document library is the
expensive part of each batch; the per-SKU lookups are fast once it is known.

### Carrier (batch B1, complete)

Technical documents live at `shareddocs.com/hvac/docs/1009/Public/...` and
marketing material at `.../1010/Public/...`. That path difference is a reliable
way to tell a product-data sheet from a brochure before opening it, which
matters because several distributors list Carrier's Comfort Series brochure as
an installation manual. It is not one.

| Family | Catalog | Document |
|---|---|---|
| 26SCA5 condensers | 26SCA5-02PD | https://www.shareddocs.com/hvac/docs/1009/Public/08/26SCA5-02PD.pdf |
| 26SCA5 install | 26SCA5-1SI | https://www.shareddocs.com/hvac/docs/1009/Public/0E/26SCA5-1SI.pdf |
| 26SCA5 wiring | 26SCA5-1W | https://www.shareddocs.com/hvac/docs/1009/Public/0F/26SCA5-1W.pdf |
| FJ5 fan coils | FJ5-01PD | https://www.shareddocs.com/hvac/docs/1009/Public/00/FJ5-01PD.pdf |
| FJ5 install | IM-FJ5-01 | https://www.shareddocs.com/hvac/docs/1009/Public/00/IM-FJ5-01.pdf |
| CVAMA coils | CVAMA-01PD | https://www.shareddocs.com/hvac/docs/1009/Public/0A/CVAMA-01PD.pdf |
| CVAMA spec sheet | SS-CVAMA-01 | https://www.shareddocs.com/hvac/docs/1009/Public/04/SS-CVAMA-01.pdf |
| CVAMA install | IM-CVAMA-01 | https://www.shareddocs.com/hvac/docs/1009/Public/08/IM-CVAMA-01.pdf |
| 58SC0B furnaces | 58SC0B-01PD | https://www.shareddocs.com/hvac/docs/1009/Public/0B/58SC0B-01PD.pdf |

Carrier residential warranty is uniform across these families: 5-year parts,
10-year parts with registration inside 90 days, non-transferable except where
local law requires. Furnaces add a 20-year heat exchanger term.

### TCL (batches B2-B4, next)

TCL publishes per-model submittals under a predictable path:

```
https://www.tcl.com/usca/content/dam/tcl/product/hvac/documents/submittals/advantage-series/
    Submittal Sheet - AHU - 36K 230V.pdf
```

Series spec sheet covering the Advantage line:
`https://www.tcl.com/usca/content/dam/tcl/product/hvac/documents/advantage/Advantage%20HVAC%20Spec%20Sheet%202025.pdf`

**TCL publishes AHRI certified-combination numbers in its submittals.** The
H36AHH18XAE air handler paired with the H36TDH18XAC outdoor unit is AHRI
reference 215869484. This is the first genuine AHRI reference found in the
catalog, and it means the TCL central batch (B4) can carry real certified
combination data rather than `requires_matched_combination`. Look up each pair
rather than assuming the combination.

`hvacsales@tcl.com` is the published contact for submittals that are not on the
public site.

### Tooling note

PDF text extraction requires `poppler` (`brew install poppler`, installed
during this work). Carrier and TCL both publish subset-font PDFs that return
binary noise from naive extraction; `pdftotext -layout` reads them correctly and
preserves the column alignment the spec tables depend on.
