import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyLiveInventory, applyLiveInventoryAll, type LiveInventory } from "../src/lib/storefront/live-inventory";
import { getStorefrontSku, getStorefrontSkus } from "../src/lib/storefront/catalog";
import { hasOffer } from "../src/lib/seo/catalog";
import { availabilityCopy } from "../src/lib/catalog/availability";

/**
 * Guard rails for the inventory overlay and the stock counter.
 *
 * Counts reach catalog_products from the CSV import (npm run catalog:sync) and
 * are overlaid onto the build-time catalog at request time. The rule these
 * protect is that knowing a quantity must never turn a quote-only catalog into
 * a purchasable one -- it is a fact about the shelf, not a decision to sell.
 *
 * The matcher suites that lived here were retired with the QuickBooks sync in
 * migration 026. They tested resolving an external system's SKUs against the
 * catalog; there is no external system now. When one arrives, migration 024 and
 * these tests are the shape to rebuild from, in git history.
 */

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
    // A catalog row nothing has counted must not read as an empty
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
