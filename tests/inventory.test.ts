import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchInventory, normalizeSku, type CatalogRow, type QboItem } from "../supabase/functions/quickbooks-inventory-sync/matching";
import { applyLiveInventory, applyLiveInventoryAll, type LiveInventory } from "../src/lib/storefront/live-inventory";
import { getStorefrontSku, getStorefrontSkus } from "../src/lib/storefront/catalog";
import { hasOffer } from "../src/lib/seo/catalog";
import { availabilityCopy } from "../src/lib/catalog/availability";

/**
 * Guard rails for the QuickBooks inventory sync.
 *
 * Two distinct risks are covered. The matcher decides WHICH product a warehouse
 * count belongs to, and getting that wrong publishes a real number against the
 * wrong equipment. The overlay decides WHAT the storefront does with a count,
 * and the rule there is that knowing a quantity must never turn a quote-only
 * catalog into a purchasable one.
 */

const rows: CatalogRow[] = [
  { id: "p-single", catalog_sku: "TCL24KAHU", source_sku: "TCL24KAHU" },
  // The importer split one sheet row into two refrigerant variants. Both keep
  // the shared source identifier; only their catalog SKUs are unique.
  { id: "p-410a", catalog_sku: "TCL36KMZODU-R-410A", source_sku: "TCL36KMZODU" },
  { id: "p-454b", catalog_sku: "TCL36KMZODU-R-454B", source_sku: "TCL36KMZODU" },
];

function item(over: Partial<QboItem> & { Sku?: string }): QboItem {
  return { Id: "1", Type: "Inventory", TrackQtyOnHand: true, QtyOnHand: 0, ...over };
}

describe("QuickBooks matching", () => {
  it("normalizes case and surrounding whitespace", () => {
    assert.equal(normalizeSku("  tcl24kahu "), "TCL24KAHU");
    assert.equal(normalizeSku(null), "");
  });

  it("matches on catalog SKU and reports a positive count as in stock", () => {
    const report = matchInventory([item({ Sku: "tcl24kahu", QtyOnHand: 6 })], rows);
    assert.deepEqual(report.updates, [{ id: "p-single", qty: 6, status: "in_stock" }]);
    assert.equal(report.matched, 1);
  });

  it("reports a counted zero as out of stock", () => {
    const report = matchInventory([item({ Sku: "TCL24KAHU", QtyOnHand: 0 })], rows);
    assert.deepEqual(report.updates, [{ id: "p-single", qty: 0, status: "out_of_stock" }]);
  });

  it("leaves an untracked item unknown rather than writing zero", () => {
    // The distinction the whole catalog rests on: "we do not count this" is not
    // "we have none of these".
    const report = matchInventory([item({ Sku: "TCL24KAHU", TrackQtyOnHand: false })], rows);
    assert.deepEqual(report.updates, []);
    assert.deepEqual(report.untracked, ["TCL24KAHU"]);
    assert.equal(report.matched, 1);
  });

  it("leaves an item with no quantity field unknown", () => {
    const report = matchInventory([{ Id: "1", Sku: "TCL24KAHU", TrackQtyOnHand: true }], rows);
    assert.deepEqual(report.updates, []);
    assert.deepEqual(report.untracked, ["TCL24KAHU"]);
  });

  it("updates nothing when one QuickBooks SKU resolves to several products", () => {
    // One shelf count cannot be divided between an R-410A and an R-454B unit.
    const report = matchInventory([item({ Sku: "TCL36KMZODU", QtyOnHand: 5 })], rows);
    assert.deepEqual(report.updates, []);
    assert.equal(report.matched, 0);
    assert.deepEqual(report.ambiguous, [{ sku: "TCL36KMZODU", catalogIds: ["p-410a", "p-454b"] }]);
  });

  it("still matches each split variant by its own catalog SKU", () => {
    const report = matchInventory(
      [item({ Sku: "TCL36KMZODU-R-410A", QtyOnHand: 2 }), item({ Sku: "TCL36KMZODU-R-454B", QtyOnHand: 3 })],
      rows
    );
    assert.deepEqual(report.updates, [
      { id: "p-410a", qty: 2, status: "in_stock" },
      { id: "p-454b", qty: 3, status: "in_stock" },
    ]);
    assert.deepEqual(report.ambiguous, []);
  });

  it("clamps a negative (oversold) quantity to zero", () => {
    const report = matchInventory([item({ Sku: "TCL24KAHU", QtyOnHand: -4 })], rows);
    assert.deepEqual(report.updates, [{ id: "p-single", qty: 0, status: "out_of_stock" }]);
  });

  it("reports both directions of non-match without updating anything", () => {
    const report = matchInventory([item({ Sku: "NOT-IN-CATALOG", QtyOnHand: 9 }), item({ Sku: "" })], rows);
    assert.deepEqual(report.updates, []);
    assert.deepEqual(report.unmatchedQbo, ["NOT-IN-CATALOG"]);
    assert.equal(report.skuless, 1);
    // Nothing was matched, so every catalog row is reported as unmentioned.
    assert.equal(report.unmatchedCatalog.length, rows.length);
  });
});

describe("live inventory overlay", () => {
  // A real priced record from the generated catalog.
  const priced = getStorefrontSku("TCL24KAHU");
  assert.ok(priced, "expected TCL24KAHU in the generated catalog");

  it("leaves a record untouched when the warehouse has not counted it", () => {
    const result = applyLiveInventory(priced, {});
    assert.equal(result.availabilityStatus, "unknown");
    assert.equal(result.availabilityVerified, false);
    assert.deepEqual(result, priced);
  });

  it("applies a count and marks availability verified", () => {
    const live: LiveInventory = { [priced.id]: { quantity: 7, status: "in_stock" } };
    const result = applyLiveInventory(priced, live);
    assert.equal(result.available, 7);
    assert.equal(result.availabilityStatus, "in_stock");
    assert.equal(result.availabilityVerified, true);
    assert.equal(result.stockStatus, "ready");
  });

  it("NEVER makes a product purchasable, however much stock arrives", () => {
    // The catalog is deliberately quote-only. Stock is a fact about the shelf;
    // selling self-service is a separate business decision that this pipeline
    // is not permitted to make.
    const live: LiveInventory = { [priced.id]: { quantity: 999, status: "in_stock" } };
    const result = applyLiveInventory(priced, live);
    assert.equal(result.purchaseEligible, priced.purchaseEligible);
    assert.equal(result.purchaseEligible, false);
    assert.equal(result.publicationStatus, priced.publicationStatus);
    assert.equal(result.retailPrice, priced.retailPrice);
  });

  it("publishes no structured-data offer for a fully stocked record", () => {
    // hasOffer gates on purchaseEligible, so live stock must not be able to
    // advertise an Offer for something that still routes to a quote form.
    const live: LiveInventory = { [priced.id]: { quantity: 12, status: "in_stock" } };
    assert.equal(hasOffer(applyLiveInventory(priced, live)), false);
  });

  it("maps an out-of-stock count to the backorder bucket", () => {
    const live: LiveInventory = { [priced.id]: { quantity: 0, status: "out_of_stock" } };
    const result = applyLiveInventory(priced, live);
    assert.equal(result.stockStatus, "backorder");
    assert.equal(result.availabilityVerified, true);
  });

  it("returns the original array when nothing is counted", () => {
    const all = getStorefrontSkus();
    assert.equal(applyLiveInventoryAll(all, {}), all);
  });

  it("overlays only the counted records in a list", () => {
    const all = getStorefrontSkus();
    const live: LiveInventory = { [priced.id]: { quantity: 4, status: "in_stock" } };
    const result = applyLiveInventoryAll(all, live);
    assert.equal(result.filter((sku) => sku.availabilityVerified).length, 1);
    assert.equal(result.find((sku) => sku.id === priced.id)?.available, 4);
  });
});

describe("stock counter display rules", () => {
  const record = getStorefrontSku("TCL24KAHU");
  assert.ok(record, "expected TCL24KAHU in the generated catalog");
  const priced = record;

  /**
   * Mirrors what the counter component derives before it renders. Written as an
   * early return rather than a boolean flag so the compiler can prove the
   * uncounted case never reaches availabilityCopy -- the same narrowing the
   * component itself relies on.
   */
  const counterInput = (live: LiveInventory) => {
    const sku = applyLiveInventory(priced, live);
    const status = sku.availabilityStatus;
    if (!sku.availabilityVerified || status === "unknown") {
      return { counted: false, showsNumber: false, label: "Availability on request", claimsStock: false };
    }
    const copy = availabilityCopy(status);
    return {
      counted: true,
      showsNumber: (status === "in_stock" || status === "low_stock") && sku.available > 0,
      label: copy.label,
      claimsStock: copy.claimsStock,
    };
  };

  it("shows a number only for a positive verified count", () => {
    assert.equal(counterInput({ [priced.id]: { quantity: 9, status: "in_stock" } }).showsNumber, true);
    assert.equal(counterInput({ [priced.id]: { quantity: 0, status: "out_of_stock" } }).showsNumber, false);
  });

  it("never borrows a zero for an uncounted product", () => {
    // The 25 catalog rows QuickBooks says nothing about must not read as empty
    // shelves -- that is the difference between "not counted" and "none left".
    const view = counterInput({});
    assert.equal(view.counted, false);
    assert.equal(view.showsNumber, false);
    assert.equal(view.label, "Availability on request");
    assert.equal(view.claimsStock, false);
  });

  it("only a positive count is allowed to claim stock", () => {
    assert.equal(counterInput({ [priced.id]: { quantity: 3, status: "in_stock" } }).claimsStock, true);
    assert.equal(counterInput({ [priced.id]: { quantity: 0, status: "out_of_stock" } }).claimsStock, false);
    assert.equal(counterInput({}).claimsStock, false);
  });

  it("a counted product still does not become purchasable", () => {
    const sku = applyLiveInventory(priced, { [priced.id]: { quantity: 40, status: "in_stock" } });
    assert.equal(sku.purchaseEligible, false);
    assert.equal(hasOffer(sku), false);
  });
});
