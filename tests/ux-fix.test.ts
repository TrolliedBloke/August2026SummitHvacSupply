import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterStorefrontSkus, getStorefrontSkus, rankBySearch, searchMatchReason } from "../src/lib/storefront/catalog";
import { queryCatalog } from "../src/lib/storefront/catalog-query";
import { catalogTask } from "../src/lib/storefront/catalog-tasks";
import { compatibilitySummary, productCompatibility, resultCompatibilityNotes } from "../src/lib/storefront/compatibility";
import { matchedSystems } from "../src/lib/catalog/compliance";
import { getStorefrontSku } from "../src/lib/storefront/catalog";
import {
  clearFacets,
  EMPTY_FILTERS,
  parseCatalogFilters,
  selectTask,
  serializeCatalogFilters,
  toCatalogFilters,
} from "../src/lib/storefront/filter-codec";
import { buildGroups } from "../src/components/catalog-filters";
import { getCatalogFacets } from "../src/lib/storefront/catalog";

const skus = getStorefrontSkus();
const bySku = (code: string) => skus.find((sku) => sku.sku === code)!;

describe("WS-3 catalog tasks", () => {
  it("round-trips the task through the URL and ignores unknown tasks", () => {
    const parsed = parseCatalogFilters(new URLSearchParams("task=parts&q=line"));
    assert.equal(parsed.task, "parts");
    assert.equal(serializeCatalogFilters(parsed), "q=line&task=parts");
    assert.equal(parseCatalogFilters(new URLSearchParams("task=everything")).task, null);
  });

  it("limits results to the task's categories", () => {
    const parts = filterStorefrontSkus(toCatalogFilters({ ...EMPTY_FILTERS, task: "parts" }), skus);
    assert.ok(parts.length > 0);
    assert.ok(parts.every((sku) => catalogTask("parts")!.categories!.includes(sku.category)));
  });

  it("keeps the task when filters are cleared and drops a category the new task cannot reach", () => {
    const filters = { ...EMPTY_FILTERS, task: "component" as const, category: "mini-splits" as const, brand: ["TCL"] };
    assert.equal(clearFacets(filters).task, "component");
    const switched = selectTask(filters, "parts");
    assert.equal(switched.category, null);
    assert.deepEqual(switched.brand, ["TCL"]);
    assert.equal(selectTask(filters, "system").category, "mini-splits");
  });

  it("shows only the task's facets, in its order, plus anything selected", () => {
    const facets = getCatalogFacets();
    const parts = buildGroups({ facets, filters: { ...EMPTY_FILTERS, task: "parts" }, skus, showCategory: true }).map((group) => group.key);
    assert.ok(!parts.includes("refrigerant") && !parts.includes("btu"), parts.join());
    const withSelection = buildGroups({ facets, filters: { ...EMPTY_FILTERS, task: "parts", stock: "unknown" }, skus, showCategory: true });
    assert.ok(withSelection.some((group) => group.key === "stock"));
  });
});

describe("WS-3 search relevance", () => {
  it("puts an exact SKU match first under Most relevant", () => {
    const page = queryCatalog(skus, { ...EMPTY_FILTERS, q: "TCL24KODU" });
    assert.equal(page.items[0].sku, "TCL24KODU");
    assert.equal(rankBySearch(skus, "")[0], skus[0]);
  });

  it("explains each match no more strongly than it ranked", () => {
    assert.equal(searchMatchReason(bySku("TCL24KODU"), "TCL24KODU"), "Exact SKU match");
    assert.match(searchMatchReason(bySku("CAR36KAHU"), "FJ5ANXD")!, /^Model starts with/);
    assert.equal(searchMatchReason(bySku("TCL24KODU"), "zzzz-nothing"), null);
  });
});

describe("WS-3 compatibility notes", () => {
  it("flags mixed refrigerants and split halves only when present", () => {
    const mixed = resultCompatibilityNotes([bySku("TCL24KODU"), bySku("TCL36KODU"), bySku("TCL24KIDU")]).map((note) => note.id);
    assert.ok(mixed.includes("split-halves"));
    const single = resultCompatibilityNotes([bySku("TCL24KODU")]);
    assert.deepEqual(single, []);
    const outdoorOnly = resultCompatibilityNotes([bySku("TCL24KODU"), bySku("TCL36KHPU")]).map((note) => note.id);
    assert.ok(!outdoorOnly.includes("split-halves"));
  });
});

describe("WS-4 product compatibility", () => {
  const systems = matchedSystems();
  const level = (code: string) => productCompatibility(bySku(code), systems, getStorefrontSku).level;

  it("ranks evidence: AHRI pair, then listed pairing, then nothing", () => {
    assert.equal(level("TCL24KODU"), "matched");
    assert.equal(level("TCL09KIDU"), "listed");
    assert.equal(level("CAR48KAHU"), "notEstablished");
    assert.equal(level("LS143850FT"), "notApplicable");
  });

  it("names the partner for a matched pair and never claims a match from capacity", () => {
    const matched = productCompatibility(bySku("TCL24KODU"), systems, getStorefrontSku);
    assert.ok(matched.level === "matched" && matched.partners.some((sku) => sku.sku === "TCL24KIDU"));
    assert.match(compatibilitySummary({ level: "notEstablished" }, "R-410A").detail, /Similar capacity does not make a match/);
  });
});

describe("WS-5 finder recap", () => {
  it("recaps only answered questions before the current one, in the buyer's words", async () => {
    const { finderRecap } = await import("../src/lib/finder/questions");
    const recap = finderRecap("homeowner", { goal: "replace_aging", current: undefined }, 2);
    assert.deepEqual(
      recap.map((item) => [item.id, item.answer]),
      [["goal", "Replacing an aging system"], ["current", "Skipped"]]
    );
    assert.equal(finderRecap("homeowner", { goal: "replace_aging" }, 0).length, 0);
  });
});

describe("WS-6 resources and tools", () => {
  it("names a distinct action for every resource type", async () => {
    const { resourceActionLabel, fromTool } = await import("../src/lib/resources");
    const base = { id: "x", title: "T", summary: "", topics: [], audience: [], updated: null, destination: "/x" };
    assert.equal(resourceActionLabel({ ...base, type: "guide" }), "Read guide");
    assert.equal(resourceActionLabel(fromTool({ slug: "rebate-lookup", title: "R", description: "" })), "Open tool");
    assert.equal(
      resourceActionLabel({ ...base, type: "document", fileType: "PDF", sizeBytes: null, source: "TCL", opensInNewTab: true, covers: [], available: true }),
      "Download PDF"
    );
    assert.equal(resourceActionLabel({ ...base, type: "external", source: "AHRI Directory", opensInNewTab: true, destination: "https://x" }), "Open AHRI Directory");
  });

  it("gives every tool a next step back into a buying task", async () => {
    const { SEO_TOOLS, TOOL_NEXT_STEP } = await import("../src/lib/seo/tools");
    for (const tool of SEO_TOOLS) {
      const next = TOOL_NEXT_STEP[tool.slug];
      assert.ok(next && next.href.startsWith("/"), tool.slug);
    }
  });
});
