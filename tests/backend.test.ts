import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  availableForSku,
  invoiceBalance,
  orderFillRate,
  quoteSubtotal,
  summarizeInventory,
} from "../src/lib/backend/math";
import { createDemoOperationsData } from "../src/lib/backend/mock-data";
import { checkoutSchema } from "../src/lib/backend/schemas";
import { resolveUnitPrice } from "../src/lib/backend/pricing";
import { fulfillmentWindows, isFulfillmentWindowAvailable } from "../src/lib/backend/fulfillment";
import { createQuoteRequest, roleCanAccessAccount } from "../src/lib/backend/services";
import { categorySitemapEntries, productSitemapEntries, renderSitemapIndex } from "../src/lib/seo/sitemaps";
import { filterStorefrontSkus, getStorefrontSku, getStorefrontSkus, searchStorefrontSkus } from "../src/lib/storefront/catalog";
import { catalogHealth, catalogReconciliation } from "../src/lib/catalog/reconciliation";
import type { InventoryLot, OrderLine } from "../src/lib/backend/types";

describe("backend inventory math", () => {
  const lots: InventoryLot[] = [
    {
      id: "lot-a",
      skuId: "sku-a",
      warehouseId: "wh",
      binCode: "A-01",
      lotCode: "LOT-A",
      onHand: 10,
      reserved: 3,
      reorderPoint: 4,
    },
    {
      id: "lot-b",
      skuId: "sku-a",
      warehouseId: "wh",
      binCode: "A-02",
      lotCode: "LOT-B",
      onHand: 2,
      reserved: 2,
      reorderPoint: 4,
    },
  ];

  it("calculates available as on hand minus reserved", () => {
    assert.equal(availableForSku(lots, "sku-a"), 7);
  });

  it("rolls up SKU lots and assigns stock state", () => {
    assert.deepEqual(summarizeInventory(lots), [
      {
        skuId: "sku-a",
        onHand: 12,
        reserved: 5,
        available: 7,
        reorderPoint: 4,
        status: "ready",
      },
    ]);
  });
});

describe("storefront SKU discovery", () => {
  it("searches the imported inventory by SKU, OEM model, brand, BTU, voltage, and refrigerant", () => {
    assert.equal(searchStorefrontSkus("TCL09KIDU")[0]?.sku, "TCL09KIDU");
    assert.ok(searchStorefrontSkus("TSC-09HA1/I3TI22").some((sku) => sku.sku === "TCL09KIDU"));
    assert.ok(searchStorefrontSkus("Tosot").every((sku) => sku.brand === "Tosot"));
    assert.ok(searchStorefrontSkus("24000").some((sku) => sku.btu === 24000));
    assert.ok(searchStorefrontSkus("208/230V").length > 0);
    assert.ok(searchStorefrontSkus("R-454B").some((sku) => sku.refrigerant === "R-454B"));
  });

  it("filters by stable catalog facets", () => {
    assert.ok(filterStorefrontSkus({ category: "mini-splits" }).every((sku) => sku.category === "mini-splits"));
    assert.ok(filterStorefrontSkus({ brand: "Carrier" }).every((sku) => sku.brand === "Carrier"));
    assert.ok(filterStorefrontSkus({ btu: "large" }).every((sku) => sku.btu >= 36000));
    assert.ok(filterStorefrontSkus({ stock: "unknown" }).every((sku) => sku.availabilityStatus === "unknown"));
    assert.ok(filterStorefrontSkus({ pricing: "quote" }).every((sku) => sku.retailPrice === null));
  });
});

describe("catalog import reconciliation", () => {
  it("maps every source row to one unique public record without exposing false commerce state", () => {
    const skus = getStorefrontSkus();
    const health = catalogHealth();
    assert.equal(health.healthy, true);
    assert.equal(health.sourceRows, 100);
    assert.equal(health.generatedRecords, 100);
    assert.equal(new Set(skus.map((sku) => sku.sku)).size, 100);
    assert.equal(new Set(skus.map((sku) => sku.slug)).size, 100);
    assert.ok(skus.every((sku) => sku.quoteEligible));
    // Nothing is sellable unless we know we hold it AND we know what it is.
    // This previously asserted that a price alone made a SKU purchasable, which
    // encoded the defect: 23 SKUs were buyable against zero known stock, six of
    // them with a model number absent from the manufacturer's catalog.
    assert.ok(
      skus.every((sku) => !sku.purchaseEligible || (sku.availabilityVerified && sku.researchStatus !== "conflict")),
      "a SKU is purchasable without verified stock or with an unresolved identity"
    );
    assert.ok(skus.every((sku) => !sku.purchaseEligible || sku.retailPrice !== null));
    // With no real on-hand quantities in the source sheet, the correct state for
    // the whole catalog is quote-only.
    assert.equal(skus.filter((sku) => sku.purchaseEligible).length, 0);
    assert.ok(skus.every((sku) => sku.availabilityStatus === "unknown"));
    assert.ok(skus.every((sku) => sku.retailPrice === null || sku.retailPrice > 0));
    assert.ok(skus.every((sku) => !("unitCost" in sku)));
  });

  it("keeps acquisition cost out of the browser-reachable catalog", async () => {
    // The projection dropping unitCost is not enough on its own: a JSON import
    // is bundled whole, so any "use client" module that reaches the catalog
    // publishes every key in the file. Assert on the raw published data, not
    // on the mapped shape.
    const raw = JSON.parse(
      await readFile(new URL("../src/data/catalog.generated.json", import.meta.url), "utf8")
    ) as Array<Record<string, unknown>>;
    assert.equal(raw.length, 100);
    const costKeys = ["unitCost", "unit_cost", "cost", "margin"];
    for (const record of raw) {
      for (const key of costKeys) {
        assert.ok(!(key in record), `${String(record.catalogSku)} still publishes "${key}"`);
      }
    }

    // ...and where the operator has the cost file, it must still hold real
    // costs server-side. That file is gitignored on purpose -- this repository
    // is public -- so it is absent in a fresh clone and in CI. Reading it
    // unconditionally made this test throw ENOENT for everyone except the
    // operator, which meant the assertion above stopped guarding anything.
    // The published-catalog check runs always; this half runs when there is
    // something to check.
    const costPath = new URL("../data/catalog/costs.generated.json", import.meta.url);
    if (existsSync(costPath)) {
      const costs = JSON.parse(await readFile(costPath, "utf8")) as {
        records: Array<{ unitCost: number | null }>;
      };
      assert.equal(costs.records.length, 100);
      assert.ok(costs.records.some((record) => (record.unitCost ?? 0) > 0));
    }
  });

  it("publishes only exact-model mapped imagery and never falls back to a broad family assignment", async () => {
    const skus = getStorefrontSkus();
    const branded = skus.filter((sku) => sku.brand !== "Unbranded");
    const verified = branded.filter((sku) => sku.imageVerified);
    assert.equal(branded.length, 78);
    assert.equal(verified.length, 56);
    assert.ok(verified.every((sku) => sku.imageExactModel && sku.images.length > 0));
    assert.ok(branded.filter((sku) => !sku.imageVerified).every((sku) => sku.images.length === 0));
    assert.ok(skus.filter((sku) => sku.brand === "Unbranded").every((sku) => !sku.imageVerified && sku.images.length === 0));
    assert.equal(catalogReconciliation.manufacturerImageCoverage, 56);
    assert.equal(catalogReconciliation.exactModelImageCoverage, 56);
    for (const image of new Set(verified.flatMap((sku) => sku.images))) {
      const bytes = await readFile(new URL(`../public${image}`, import.meta.url));
      assert.ok(bytes.length > 1000, `${image} is missing or unexpectedly small`);
    }
  });

  it("documents every intentionally shared exact-model image", async () => {
    const config = JSON.parse(await readFile(new URL("../data/catalog/exact-media.json", import.meta.url), "utf8")) as { groups: Array<{ skus: string[]; images: string[] }> };
    const byImage = new Map<string, string[]>();
    for (const sku of getStorefrontSkus().filter((item) => item.imageVerified)) {
      for (const image of sku.images) byImage.set(image, [...(byImage.get(image) ?? []), sku.sku]);
    }
    for (const [image, skus] of byImage) {
      if (skus.length < 2) continue;
      const documented = new Set(config.groups.filter((group) => group.images.includes(image)).flatMap((group) => group.skus));
      assert.ok(skus.every((sku) => documented.has(sku)), `${image} is duplicated without a manufacturer-backed mapping`);
    }
  });

  it("does not market Carrier 26SCA5 air conditioners as heat pumps", () => {
    const carrierCondensers = getStorefrontSkus().filter((sku) => sku.modelNumber.startsWith("26SCA5"));
    assert.equal(carrierCondensers.length, 3);
    assert.ok(carrierCondensers.every((sku) => sku.category === "central-air-conditioners"));
  });

  it("does not file accessories or parts under equipment categories", () => {
    const skus = getStorefrontSkus();
    const bySku = (code: string) => skus.find((sku) => sku.sku === code);
    // A copper line coil is not an evaporator coil, and a line-hide cover kit
    // is not a mini split. Both were miscategorised by name-keyword matching.
    assert.equal(bySku("NATAK78350")?.category, "installation-supplies");
    assert.equal(bySku("LHCKITWHT")?.category, "installation-supplies");
    // Every evaporator coil in the sheet is a Carrier cased coil.
    assert.ok(skus.filter((sku) => sku.category === "evaporator-coils").every((sku) => sku.brand === "Carrier"));
    // A blank category cell must not demote an outdoor condenser to supplies.
    assert.equal(bySku("TOS09KODU-09AT19D6DO")?.category, "mini-splits");
    assert.equal(skus.filter((sku) => sku.category === "air-handlers").length, 11);
  });

  it("never publishes sheet prose as a manufacturer model number", () => {
    const skus = getStorefrontSkus();
    for (const sku of skus) {
      if (!sku.modelNumber) continue;
      assert.ok(
        (sku.modelNumber.match(/\s/g) ?? []).length <= 1 && /\d/.test(sku.modelNumber),
        `${sku.sku} publishes "${sku.modelNumber}" as a model number`
      );
    }
    // "Cassette Panel 01" and "THEY DONT MAKE IT" are label text, not part numbers.
    assert.equal(skus.find((sku) => sku.sku === "TCLCASPAN01")?.modelNumber, "");
    assert.equal(skus.find((sku) => sku.sku === "TCL24KMZIDU")?.modelNumber, "");
  });

  it("finds equipment by the words contractors actually type", () => {
    const hits = (query: string) => searchStorefrontSkus(query).map((sku) => sku.sku);
    assert.ok(hits("3 ton heat pump").length > 0, "3 ton heat pump returned nothing");
    assert.ok(hits("5 ton condenser").length > 0, "5 ton condenser returned nothing");
    assert.ok(hits("gas furnace").length > 0, "gas furnace returned nothing");
    assert.ok(hits("heater").length > 0, "heater returned nothing");
    assert.ok(hits("heating unit").length > 0, "heating unit returned nothing");
    assert.ok(hits("heatr").length > 0, "one-character product typo returned nothing");
    assert.ok(
      searchStorefrontSkus("heater").slice(0, 4).every((sku) => ["furnaces", "central-heat-pumps"].includes(sku.category)),
      "heater should rank dedicated heating equipment ahead of broad HVAC matches"
    );
    assert.ok(
      searchStorefrontSkus("heat pump").every((sku) => sku.category !== "central-air-conditioners"),
      "heat pump should not return cooling-only central air conditioners"
    );
    assert.ok(hits("thermostat").includes("TCLWIREDCONT"));
    assert.ok(hits("wired remote").includes("TCLWIREDCONT"));
    assert.ok(hits("temp gun").includes("DCT414"));
    assert.ok(hits("condenser pad").every((sku) => sku.startsWith("BSP")));
    assert.ok(hits("fused disconnect").includes("DISC-30A-FUSE"));
    assert.ok(hits("liquid tight conduit").includes("COND-LT-1/2-100FT"));
    assert.ok(hits("line hide kit").includes("LHCKITWHT"));
    assert.ok(hits("cassette grille").every((sku) => sku.includes("PAN")));
    assert.ok(hits("indoor head").every((sku) => sku.includes("IDU")));
    assert.ok(hits("mini-split").length > 0);
    assert.ok(hits("a/c").every((sku) => searchStorefrontSkus("air conditioner").some((item) => item.sku === sku)));
    assert.ok(hits("r410a").length > 0);
    assert.ok(hits("115v").length > 0);
    assert.ok(hits("19 seer").includes("TOS36KHPU"));
    assert.ok(hits("80 afue").every((sku) => sku.endsWith("FUR")));
    assert.equal(hits("water heater").length, 0);
    assert.equal(hits("boiler").length, 0);
    // Exact identifiers must still win outright.
    assert.equal(hits("TSC-09HA1/I3TI22")[0], "TCL09KIDU");
    assert.equal(hits("zzzznotarealquery").length, 0);
  });

  it("preserves all collision rows as reviewable, distinct variants", () => {
    assert.equal(catalogReconciliation.collisionGroups, 9);
    assert.ok(catalogReconciliation.collisionRows.every((group) => group.sourceRows.length === group.generatedSkus.length));
    assert.ok(catalogReconciliation.collisionRows.every((group) => new Set(group.generatedSkus).size === group.generatedSkus.length));
  });

  it("removes spreadsheet formulas and normalizes fields supported by the row itself", () => {
    const publicCatalog = JSON.stringify(getStorefrontSkus());
    assert.doesNotMatch(publicCatalog, /#(?:N\/A|NAME|REF|VALUE)|=Ai\(|THEY DONT MAKE IT/i);
    assert.equal(getStorefrontSku("TCL12KMZIDU")?.productType, "Indoor unit");
    assert.equal(getStorefrontSku("TCLCAS9K")?.btu, 9000);
    assert.equal(getStorefrontSku("CAR60KCOIL")?.category, "evaporator-coils");
    assert.equal(getStorefrontSku("TCL24KMZIDU")?.modelNumber, "");
  });
});

describe("checkout validation", () => {
  const validItem = {
    skuId: "sku-elt-09",
    sku: "TSC-09HA2/I3TI23",
    modelNumber: "TSC-09HA2/I3TI23",
    title: "Elite 9K Hyper-Heat Pump",
    qty: 1,
  };

  it("accepts SKU-level reserve checkout payloads", () => {
    const parsed = checkoutSchema.parse({
      idempotencyKey: "f6c3bea4-2315-4ca8-b4a2-d7139d411780",
      items: [validItem],
      method: "pickup",
      window: "2026-08-05T16:00:00.000Z",
      buyerName: "Andre Lewis",
      buyerEmail: "andre@example.com",
      phone: "(415) 555-0199",
    });
    assert.equal(parsed.items[0].skuId, "sku-elt-09");
  });

  it("rejects series-era cart lines and missing buyer contact", () => {
    assert.throws(() =>
      checkoutSchema.parse({
        items: [{ slug: "elite", name: "Elite Series", qty: 1 }],
        method: "pickup",
      })
    );
  });
});

describe("quote request catalog authority", () => {
  it("accepts actual quote-eligible SKUs and ignores spoofed display data", async () => {
    const result = await createQuoteRequest({
      name: "Test Buyer",
      email: "buyer@example.com",
      need: "Confirm pricing and availability.",
      lines: [{ skuId: "inventory-row-2", sku: "FAKE", modelNumber: "FAKE", productName: "Fake title", quantity: 2 }],
    });
    assert.equal(result.mode, "seeded");
    if (result.mode === "seeded") assert.deepEqual(result.prepared, { customer: "Test Buyer", lineCount: 1, unitCount: 2 });
  });

  it("rejects products that are not in the production catalog", async () => {
    await assert.rejects(() => createQuoteRequest({
      name: "Test Buyer",
      email: "buyer@example.com",
      need: "Quote an unknown product.",
      lines: [{ skuId: "unknown", sku: "unknown", modelNumber: "", productName: "Unknown", quantity: 1 }],
    }), /not available for quoting/);
  });
});

describe("fulfillment windows", () => {
  it("omits elapsed same-day slots and validates returned identifiers", () => {
    const now = new Date("2026-08-05T19:30:00.000Z"); // 12:30 PM Pacific
    const windows = fulfillmentWindows("pickup", "94560", now);
    assert.ok(windows.length > 0);
    assert.ok(windows.every((window) => new Date(window.startAt) > now));
    assert.equal(isFulfillmentWindowAvailable("pickup", "94560", windows[0].id, now), true);
  });

  it("does not offer same-day pickup after the Pacific cutoff", () => {
    const now = new Date("2026-08-05T22:30:00.000Z"); // 3:30 PM Pacific
    const windows = fulfillmentWindows("pickup", "94560", now);
    assert.ok(windows.every((window) => !window.label.startsWith("Today")));
  });
});

describe("SEO route inventory", () => {
  it("includes clean static URLs and excludes portal URLs", () => {
    const urls = categorySitemapEntries().map((entry) => entry.url);
    assert.ok(urls.includes("https://www.summithvacsupply.com/homeowners"));
    assert.ok(!urls.some((url) => url.includes("/portal")));
  });

  it("publishes only verified product records", () => {
    const urls = productSitemapEntries().map((entry) => entry.url);
    assert.ok(!urls.includes("https://www.summithvacsupply.com/products/sku/TSC-09HA2-I3TI23"));
  });

  it("renders a split sitemap index", () => {
    const xml = renderSitemapIndex();
    assert.match(xml, /sitemap-products\.xml/);
    assert.match(xml, /sitemap-guides\.xml/);
  });
});

describe("backend order and invoice math", () => {
  it("calculates quote subtotal from line quantities", () => {
    assert.equal(
      quoteSubtotal([
        { quantity: 2, unitPrice: 1090 },
        { quantity: 1, unitPrice: 865 },
      ]),
      3045
    );
  });

  it("calculates invoice balance from mock payment ledger", () => {
    assert.equal(invoiceBalance({ total: 5291.95, paid: 436.25 }), 4855.7);
  });

  it("calculates order fill rate", () => {
    const lines: OrderLine[] = [
      {
        orderId: "order",
        skuId: "sku-a",
        quantity: 4,
        reservedQuantity: 4,
        shippedQuantity: 2,
        unitPrice: 100,
      },
      {
        orderId: "order",
        skuId: "sku-b",
        quantity: 1,
        reservedQuantity: 1,
        shippedQuantity: 1,
        unitPrice: 200,
      },
    ];
    assert.equal(orderFillRate(lines), 60);
  });
});

describe("role-based account access", () => {
  it("allows staff to inspect any account", () => {
    assert.equal(roleCanAccessAccount("staff", "acct-a", "acct-b"), true);
  });

  it("limits non-staff roles to their own account", () => {
    assert.equal(roleCanAccessAccount("dealer", "acct-a", "acct-a"), true);
    assert.equal(roleCanAccessAccount("dealer", "acct-a", "acct-b"), false);
  });
});

describe("seeded quote-to-order-to-invoice flow", () => {
  it("links the seeded sales path end to end", () => {
    const data = createDemoOperationsData();
    const quote = data.quotes.find((candidate) => candidate.quoteNumber === "Q-2026-1042");
    assert.ok(quote);
    const order = data.salesOrders.find((candidate) => candidate.quoteId === quote.id);
    assert.ok(order);
    const invoice = data.invoices.find((candidate) => candidate.orderId === order.id);
    assert.ok(invoice);
    assert.equal(order.total, quote.total);
    assert.equal(invoice.total, quote.total);
    assert.equal(invoiceBalance(invoice), invoice.balance);
  });
});

describe("trade pricing fallback", () => {
  // catalog_product_trade_pricing is empty by design until the counter loads
  // real contractor pricing, so "no trade price on file" is the normal path,
  // and it must land on retail. Falling to 0 would hand a dealer free
  // equipment; the storefront projection hardcodes dealerPrice to null, which
  // is exactly why this branch went unexercised for so long.
  it("charges retail when no trade price is on file", () => {
    assert.equal(resolveUnitPrice(true, undefined, 2500), 2500);
  });

  it("never treats a zero or negative trade price as free", () => {
    assert.equal(resolveUnitPrice(true, 0, 2500), 2500);
    assert.equal(resolveUnitPrice(true, -10, 2500), 2500);
  });

  it("ignores a non-finite trade price", () => {
    assert.equal(resolveUnitPrice(true, Number.NaN, 2500), 2500);
    assert.equal(resolveUnitPrice(true, Number.POSITIVE_INFINITY, 2500), 2500);
  });

  it("applies a real trade price for a trade buyer", () => {
    assert.equal(resolveUnitPrice(true, 1875, 2500), 1875);
  });

  it("charges a retail buyer list even when a trade price exists", () => {
    assert.equal(resolveUnitPrice(false, 1875, 2500), 2500);
  });

  it("never charges a trade buyer above list on a bad trade row", () => {
    assert.equal(resolveUnitPrice(true, 9999, 2500), 2500);
  });
});
