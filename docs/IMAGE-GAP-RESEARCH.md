# Image gap research — the 44 SKUs with no image

**Date:** 2026-08-25 · Feeds PLAN.md 1.4 (and, as it turns out, 1.1)

Every record in `catalog.generated.json` with no `image` was pulled, grouped, and researched against manufacturer and distributor sources. Findings below, with the evidence behind each.

Nothing here has been written to `research-overrides.json`. Identity decisions belong to a human — which the first finding explains rather forcefully.

---

## Finding 1 — DCT414 was corrected to the wrong product. Recommend reverting.

**This is the most important thing in this document.**

An earlier session renamed `DCT414` from "Air Conditioner Duct Model 414" to **"DEWALT 12V MAX Cordless IR Thermometer"**, attached DEWALT product imagery, and linked DEWALT's instruction manual. That correction is almost certainly wrong.

**What the source sheet actually shows.** The three DCT rows sit consecutively, inside an unbroken run of mini-split line-hide accessories:

| Row | SKU | Name in the source sheet |
|---|---|---|
| 70 | BSP36363 | 36x36x3 Base Pad |
| 71 | BSP38183 | 38x18x3 Base Pad |
| **72** | **DCT414** | **"Air Conditioner Duct Model 414"** ← before the rewrite |
| **73** | **DCT415** | **"Air Conditioner Duct Model 415"** |
| **74** | **DCT4102** | **"Air Conditioner Duct Model 4102"** |
| 75 | NATAK78350 | NaturalAir Insulated Copper Coil AK-783-50 |
| 76 | LHCKITWHT | Mini Split Line Hide Cover Kit |
| 77 | LHCCHWHT | White Line Hide Channel Piece |
| 78–84 | ELBOW90 … CAPCOVER | 90° elbow, corner cover, coupling cover, end cover, flex hose, T-joint, cap cover |
| 85 | STRAIGHTDUCTCOVER | 3 in Straight Duct 6.5 FT Cover |

**Four independent reasons the DEWALT reading fails:**

1. **`DCT` means *duct*, not DEWALT.** Its two immediate neighbours kept their original names and both say "Air Conditioner Duct". Row 85 independently uses "Straight Duct … Cover" for the same product class.
2. **DEWALT has no DCT415 and no DCT4102.** The DCT4xx family is DCT410/411/412 (inspection cameras) and DCT414 (IR thermometer). If the prefix meant DEWALT, all three would resolve. Exactly one does — that is a collision, not a pattern.
3. **"414" decodes cleanly as a size.** 4″ × 14 ft is a standard line-set cover kit — DuctlessAire sells it as **DA4-14KIT**, stocked at Home Depot. "Model 415" and "Model 4102" read as siblings in the same size series.
4. **The kit contents match the neighbouring SKUs exactly.** The DA4-14KIT ships with wall cap, coupler, end cap and a 90–120° elbow — which is precisely the individual-piece run at rows 78–84. Summit is stocking the kit *and* the pieces.

A DEWALT thermometer does not sit between two condenser base pads and an insulated copper coil on a supply house's inventory sheet.

**Why this is worse than the original vagueness.** Before, the page was uninformative. Now it publishes a confident, specific, wrong identity with a manufacturer's manual attached. A contractor ordering "the DEWALT" gets a length of PVC line-hide.

**Recommended:** revert the `DCT414` override to `researchStatus: "conflict"` and put it back in the queue with the three siblings. Then have the counter confirm the actual line-hide series and sizes for 414 / 415 / 4102 in one pass.

> The importer's own comment warns that a probable OEM mapping is "never a substitute for verification." This is what happens when it is used as one.

---

## The 44, by bucket

| Bucket | Count | What research can settle | What it cannot |
|---|---|---|---|
| Unbranded accessories | 22 | What the item *is* — all are commodity parts | Which brand Summit actually stocks |
| Tosot | 14 | 4 confirmed, 6 disproved, 4 open | The 6 need supplier confirmation |
| TCL | 8 | 1 confirmed, 4 corroborated, 3 open | Panel part numbers |

---

## Tosot (14)

### Confirmed against the manufacturer — 4 SKUs

All four cassettes exist and are published by Tosot with submittal sheets and product photography. **These are currently flagged `MODEL_NOT_FOUND`, and that flag is wrong.**

| SKU | Model | Evidence |
|---|---|---|
| TOSCAS09K | TM09R32BKDI | [tosotclima.com R32 8-way cassette](https://tosotclima.com/product/r32-ceiling-cassette-indoor-units/) → `assets.tosotclima.com/portal/submittal/TM09R32BKDI.pdf` |
| TOSCAS12K | TM12R32BKDI | same page, `…/TM12R32BKDI.pdf` |
| TOSCAS18K | TM18R32BKDI | same page, `…/TM18R32BKDI.pdf` |
| TOSCAS24K | TM24R32BKDI | same page, `…/TM24R32BKDI.pdf` |

Manufacturer imagery is available at `assets.tosotclima.com/portal/img/product/IDU-8-way-Cassette.webp`. Confirm licensing before use.

### Model numbers that do not exist as written — 6 SKUs

Tosot's published ducted line uses a different suffix convention. The catalog's numbers are *close* to real ones — close enough to pass a glance on a purchase order, wrong enough to ship the wrong equipment. The `MODEL_NOT_FOUND` flags here are **correct**.

| SKU | Catalog model | Nearest real Tosot model |
|---|---|---|
| TOS36KAHU | TU36-32AH2GDU | `TUD36-24AH2ADU` |
| TOS36KHPU | TU36-32GDU | `TU36-R32WEDU` / `TU36-24WADU` |
| TOS48KAHU | TUD48-R32GDU | `TU48-R32WEDU` |
| TOS48KHPU | TU48-32GDU | `TU48-R32WEDU` |
| TOS60KAHU | TUD60-R32GDU | `TUD60-24AH2ADU` |
| TOS60KHPU | TU60-32GDU | `TU60-48WADU` |

The differences cluster in the refrigerant code (`-32` vs `-R32` vs `-24`) and the trailing letters (`GDU` vs `ADU` / `WADU` / `WEDU`). That pattern reads like transcription drift from an invoice, not a distinct product line. **Do not guess the mapping** — ask the supplier which unit was actually purchased. Sources: [UNIX Ultra 18 SEER ducted system](https://tosotclima.com/product/unix-ultra-18-seer-ducted-system/), [TU48-R32WEDU submittal](https://www.tosotclima.com/static/portal/submittal/TU48-R32WEDU.pdf).

### Open — 4 SKUs

| SKU | Model | Note |
|---|---|---|
| TOS42KMZODU-R-410A | TM42HX4O | Multi-zone outdoor. R-410A; check against the HMO/ULTRA outdoor series. |
| TOS42KMZODU-R-454B | TM42R32MO | Model says **R32**, SKU says **R-454B**. Contradiction — and it already carries `INVENTORY_CONFLICT`. Resolve the refrigerant before anything else. |
| TOSPAN01 | TF05 | Cassette panel. Panel part numbers are rarely published; ask the distributor. |
| TOSPAN02 | TF06 | As above. |

The 454B/R32 contradiction on `TOS42KMZODU-R-454B` is worth pulling forward — refrigerant is not a cosmetic field, and the two are not interchangeable.

---

## TCL (8)

### Confirmed — 1 SKU

| SKU | Model | Finding |
|---|---|---|
| TCL24KHPU | H24TDH17XAC | Real. **Variable-speed top-discharge heat pump condensing unit, R-454B, 24,000 BTU/h**, 24-15/16 × 29-1/8 × 29-1/8 in. Sold by [AF Supply](https://www.afsupply.com/tcl-h24tdh17xac-24k-advantage-inverter-heat-pump-outdoor-unit.html); installation manual on [ManualsLib](https://www.manualslib.com/manual/3685944/Tcl-H24tdh17xac.html). Siblings H36TDH18XAC and H48TDH18XAC exist, confirming the series. |

### Corroborated but not directly sourced — 4 SKUs

TCL's convention appears to be `TH…XW` for a **system** and `H…XAC` / `H…XAE` for its **condenser** / **evaporator** components. That makes these four read as real component numbers rather than invented ones.

| SKU | Model | Corroboration |
|---|---|---|
| TCL36KIDU | H36SEH19XAE | Home Depot sells [**TH36SEH19XW**](https://www.homedepot.com/p/TCL-Low-Ambient-1-Zone-36-000-BTU-19-SEER2-Ductless-Mini-Split-Heat-Pump-Air-Conditioner-System-with-16-ft-Lines-230V-TH36SEH19XW/337660013) — 1-zone, 36,000 BTU, 19 SEER2. `SEH19` and the capacity match exactly. |
| TCL36KODU | H36SEH19XAC | Condenser half of the same system. |
| TCL18KIDU-R-454B | H18SEH17XAE | Same convention at 18K/17 SEER2; the system number was not located. |
| TCL18KODU-18SEH17XAC | H18SEH17XAC | As above. Note the SKU embeds the model, which is why it collided during import. |

`TCL36KIDU` is the **only priced SKU in this whole document** ($1,700) — it should be first in the queue.

### Open — 3 SKUs

`TCLCASPAN01`, `TCLCASPAN02` (cassette panels, no model number, flagged `PURCHASING_RECORD_VERIFICATION`) and `TCLWIREDCONT` (`XK-120D2-50` wired controller — the number looks like a genuine GREE/TCL controller part but was not confirmed).

---

## Unbranded accessories (22)

These need a different kind of research. There is no manufacturer to identify — they are commodity parts, and what matters is the **specification**, not the brand. All 22 carry `MANUFACTURER_IDENTITY_UNCERTAIN`, which for this group is arguably the wrong flag: the identity is not uncertain, the *supplier* is.

**Line sets (4)** — fully self-describing, no research needed:

| SKU | Reads as |
|---|---|
| LS143850FT | 1/4″ + 3/8″ × 50 ft |
| LS145850FT | 1/4″ + 5/8″ × 50 ft |
| LS387450FT | 3/8″ + 3/4″ × 50 ft |
| LS387850FT | 3/8″ + 7/8″ × 50 ft |

The existing LS143850FT reference imagery is the right pattern — clearly labelled as reference, with a fitment note.

**Line-hide system (13)** — `DCT414/415/4102`, `LHCKITWHT`, `LHCCHWHT`, `ELBOW90`, `CORNERCOV`, `COUPLINGCOV`, `ENDCOV`, `FLEXHOSE`, `TJOINT`, `CAPCOVER`, `STRAIGHTDUCTCOVER`. One product family from one supplier. **Research these as a set, not individually** — identify the line and every part number follows. The DuctlessAire 4″ range is the closest published match found ([Hide-A-Line](https://ductlessaire.com/collections/hide-a-line)); Rectorseal Slimduct and DiversiTech SpeediChannel are the other likely candidates.

**Remaining (5)** — `BSP36363` and `BSP38183` (condenser base pads, dimensions in the name), `NATAK78350` (the name gives brand *NaturalAir* and part *AK-783-50*, so this one is not really unbranded), `DISC-30A-FUSE` (30A fused disconnect), `WIRE-15FT` (15 ft whip), `COND-LT-1/2-100FT` (1/2″ non-metallic liquid-tight conduit, 100 ft).

For all 22, a generic representative photo plus accurate specs is honest and sufficient. These are not products anyone chooses by brand.

---

## Recommended order

1. **Revert DCT414** and re-queue it with 415 and 4102. Wrong-and-confident is worse than vague.
2. **Clear the four Tosot cassettes** — manufacturer evidence is in hand; this is the cheapest set of four indexable pages available.
3. **TCL36KIDU / TCL36KODU** — the only priced pair here, and corroborated by Home Depot's system listing.
4. **Resolve the TOS42KMZODU refrigerant contradiction** — R32 vs R-454B is a safety-relevant field.
5. **Identify the line-hide supplier once** — settles 13 SKUs in a single question.
6. **Ask the supplier for the six real Tosot ducted model numbers.** Do not infer them.

## What was not done

No override, flag, or catalog record was modified. Every item above needs either a human decision or a supplier answer, and the DCT414 episode is the argument for keeping it that way.
