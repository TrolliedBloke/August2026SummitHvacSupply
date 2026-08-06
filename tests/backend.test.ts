import assert from "node:assert/strict";
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
import { roleCanAccessAccount } from "../src/lib/backend/services";
import { categorySitemapEntries, productSitemapEntries, renderSitemapIndex } from "../src/lib/seo/sitemaps";
import { filterStorefrontSkus, searchStorefrontSkus } from "../src/lib/storefront/catalog";
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
  it("searches by SKU, model, title, BTU, voltage, and series", () => {
    assert.equal(searchStorefrontSkus("TSC-09HA2/I3TI23")[0]?.sku, "TSC-09HA2/I3TI23");
    assert.equal(searchStorefrontSkus("TSC-09HA2/I3TI23")[0]?.modelNumber, "TSC-09HA2/I3TI23");
    assert.ok(searchStorefrontSkus("Hyper-Heat Pump").some((sku) => sku.sku === "TSC-09HA2/I3TI23"));
    assert.ok(searchStorefrontSkus("24000").some((sku) => sku.btu === 24000));
    assert.ok(searchStorefrontSkus("208/230V").length > 0);
    assert.ok(searchStorefrontSkus("BreezeIN").some((sku) => sku.seriesSlug === "breezein"));
  });

  it("filters by stable catalog facets", () => {
    assert.ok(filterStorefrontSkus({ category: "ductless" }).every((sku) => sku.category === "ductless"));
    assert.ok(filterStorefrontSkus({ btu: "large" }).every((sku) => sku.btu >= 36000));
    assert.ok(filterStorefrontSkus({ stock: "ready" }).every((sku) => sku.stockStatus === "ready"));
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
      items: [validItem],
      method: "pickup",
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
