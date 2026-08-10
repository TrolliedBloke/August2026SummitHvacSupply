import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availabilityCopy,
  deriveAvailabilityState,
  isInventoryVerified,
  isPurchasable,
} from "../src/lib/catalog/availability";
import { estimateTax, isWithinTaxJurisdiction } from "../src/lib/backend/pricing";
import { cartSnapshotSchema } from "../src/lib/backend/schemas";
import { rateLimit } from "../src/lib/backend/rate-limit";
import { getStorefrontSkus } from "../src/lib/storefront/catalog";
import { buildProductSchema, getSkuSeoState, hasOffer } from "../src/lib/seo/catalog";

/**
 * Regression tests for the launch-blocking defects. Each one fails if the
 * specific unsafe behaviour returns, so these are the guard rails rather than
 * general coverage.
 */

describe("availability: unknown inventory is never purchasable", () => {
  const base = {
    retailPrice: 450,
    publicationStatus: "published" as const,
    minimumStock: 2,
  };

  it("treats a null quantity as unverified", () => {
    assert.equal(
      isInventoryVerified({ inventoryQuantity: null, inventoryStatus: "in_stock" }),
      false
    );
  });

  it("treats an unknown status as unverified even with a quantity", () => {
    assert.equal(
      isInventoryVerified({ inventoryQuantity: 12, inventoryStatus: "unknown" }),
      false
    );
  });

  it("routes unknown inventory to inventory_unknown, not in_stock", () => {
    const state = deriveAvailabilityState({
      ...base,
      inventoryQuantity: null,
      inventoryStatus: "unknown",
    });
    assert.equal(state, "inventory_unknown");
    assert.equal(isPurchasable({ ...base, inventoryQuantity: null, inventoryStatus: "unknown" }), false);
  });

  it("never claims stock in copy for an unverified state", () => {
    for (const state of ["inventory_unknown", "quote_only", "unavailable", "lead_time", "out_of_stock"] as const) {
      assert.equal(availabilityCopy(state).claimsStock, false, `${state} must not claim stock`);
    }
    assert.equal(availabilityCopy("in_stock").claimsStock, true);
  });

  it("only sells from a verified, positive count", () => {
    assert.equal(isPurchasable({ ...base, inventoryQuantity: 5, inventoryStatus: "in_stock" }), true);
    assert.equal(isPurchasable({ ...base, inventoryQuantity: 0, inventoryStatus: "out_of_stock" }), false);
    // lead_time is a promise about the future, not stock on hand.
    assert.equal(isPurchasable({ ...base, inventoryQuantity: 3, inventoryStatus: "lead_time" }), false);
  });

  it("keeps an unpriced record quote-only regardless of stock", () => {
    assert.equal(
      deriveAvailabilityState({ ...base, retailPrice: null, inventoryQuantity: 9, inventoryStatus: "in_stock" }),
      "quote_only"
    );
  });
});

describe("live catalog honours the eligibility rule", () => {
  it("has no product that is purchasable without verified inventory", () => {
    const offenders = getStorefrontSkus().filter(
      (sku) => sku.purchaseEligible && !sku.availabilityVerified
    );
    assert.deepEqual(
      offenders.map((sku) => sku.sku),
      [],
      "purchase-eligible products must have verified inventory"
    );
  });

  it("never exposes a zero trade price as if it were real", () => {
    const zeroPriced = getStorefrontSkus().filter((sku) => sku.dealerPrice === 0);
    assert.deepEqual(zeroPriced.map((sku) => sku.sku), [], "dealerPrice must be null, never 0");
  });
});

describe("tax is refused outside its jurisdiction", () => {
  it("accepts in-state ZIPs", () => {
    assert.equal(isWithinTaxJurisdiction("94560"), true);
    assert.equal(typeof estimateTax(1000, "94560"), "number");
  });

  it("returns null rather than 0 for an out-of-state destination", () => {
    assert.equal(isWithinTaxJurisdiction("10001"), false);
    assert.equal(estimateTax(1000, "10001"), null);
    assert.equal(estimateTax(1000, undefined), null);
  });

  it("does not silently zero-rate an unknown ZIP", () => {
    // The failure mode being guarded: a null coerced to 0 would present an
    // out-of-jurisdiction order as legitimately tax-free.
    assert.notEqual(estimateTax(1000, "99999"), 0);
  });
});

describe("cart snapshot input is bounded and typed", () => {
  it("rejects a non-email sender", () => {
    assert.equal(cartSnapshotSchema.safeParse({ email: "nope", items: [{ skuId: "a", qty: 1 }] }).success, false);
  });

  it("rejects an empty or oversized cart", () => {
    assert.equal(cartSnapshotSchema.safeParse({ email: "a@b.co", items: [] }).success, false);
    const huge = Array.from({ length: 51 }, () => ({ skuId: "a", qty: 1 }));
    assert.equal(cartSnapshotSchema.safeParse({ email: "a@b.co", items: huge }).success, false);
  });

  it("rejects absurd quantities", () => {
    assert.equal(
      cartSnapshotSchema.safeParse({ email: "a@b.co", items: [{ skuId: "a", qty: 100000 }] }).success,
      false
    );
    assert.equal(
      cartSnapshotSchema.safeParse({ email: "a@b.co", items: [{ skuId: "a", qty: 0 }] }).success,
      false
    );
  });

  it("accepts a valid payload and ignores client pricing", () => {
    const parsed = cartSnapshotSchema.parse({
      email: "buyer@example.com",
      items: [{ skuId: "inventory-row-2", qty: 2, unitPrice: 0.01, title: "<script>x</script>" }],
    });
    assert.equal(parsed.items[0].qty, 2);
    // The price is parsed but deliberately not trusted downstream; the route
    // forwards only skuId and qty to saveCartSnapshot.
    assert.equal(parsed.items[0].unitPrice, 0.01);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then refuses", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      assert.equal(rateLimit(key, 3, 60).allowed, true, `request ${i + 1} should pass`);
    }
    const blocked = rateLimit(key, 3, 60);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds > 0);
  });

  it("keeps separate keys independent", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    assert.equal(rateLimit(a, 1, 60).allowed, true);
    assert.equal(rateLimit(a, 1, 60).allowed, false);
    assert.equal(rateLimit(b, 1, 60).allowed, true);
  });
});

describe("SEO gate", () => {
  const skus = getStorefrontSkus();

  it("never indexes a record whose identity is in conflict", () => {
    const indexedConflicts = skus.filter(
      (sku) => sku.researchStatus === "conflict" && getSkuSeoState(sku).indexable
    );
    assert.deepEqual(indexedConflicts.map((sku) => sku.sku), []);
  });

  it("emits no structured data for a conflicted record", () => {
    const conflicted = skus.find((sku) => sku.researchStatus === "conflict");
    if (conflicted) assert.equal(buildProductSchema(conflicted, "https://example.com"), null);
  });

  it("does not require AHRI from products that cannot have one", () => {
    // A line set or accessory has no AHRI certificate to produce; requiring one
    // is what made the sitemap structurally empty.
    const accessories = skus.filter((sku) => sku.category === "line-sets" || sku.category === "installation-supplies");
    for (const sku of accessories) {
      assert.ok(
        !getSkuSeoState(sku).missing.includes("AHRI reference number"),
        `${sku.sku} must not be blocked on AHRI`
      );
    }
  });

  it("only advertises an offer for something actually purchasable", () => {
    for (const sku of skus.filter(hasOffer)) {
      assert.equal(sku.purchaseEligible, true);
      assert.ok((sku.retailPrice ?? 0) > 0);
    }
  });

  it("produces a schema with no offers block when not purchasable", () => {
    const indexable = skus.find((sku) => getSkuSeoState(sku).indexable);
    if (indexable && !hasOffer(indexable)) {
      const schema = buildProductSchema(indexable, "https://example.com");
      assert.ok(schema);
      assert.equal("offers" in (schema as Record<string, unknown>), false);
    }
  });
});
