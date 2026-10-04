import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { getStorefrontSku, getStorefrontSkus, catalogCategoryDestinations, getCatalogFacets, filterStorefrontSkus, type StorefrontSku } from "../src/lib/storefront/catalog";
import {
  activeFacets,
  clearFacets,
  EMPTY_FILTERS,
  normalizeCatalogFilters,
  parseCatalogFilters,
  removeFacet,
  serializeCatalogFilters,
  toCatalogFilters,
  toggleFacet,
} from "../src/lib/storefront/filter-codec";
import { decodeCursor, queryCatalog } from "../src/lib/storefront/catalog-query";
import { intentFor, presentCommerceState, resolveCommerceState } from "../src/lib/commerce/state";
import { parseStoredItems } from "../src/components/quote-context";
import { productMedia, reconcileActiveId } from "../src/lib/media";
import { brandDirectory, opticalSize } from "../src/lib/brands";
import { behaviorLabel, filterResources, fromDocuments, fromGuide, parseResourceFilters, serializeResourceFilters, validateResource, InvalidResourceError } from "../src/lib/resources";
import { SEO_GUIDES } from "../src/lib/seo/guides";
import { leadingZeroForm, normalizeIdentifier, rankIdentifiers, resolveIdentifier, type IdentifierRecord } from "../src/lib/model-identifier";
import { crossReferenceLookup, normalizeModelQuery } from "../src/lib/storefront/cross-reference";
import { deliveryPromise, fulfillmentWindows, resolveFulfillmentAnswer } from "../src/lib/backend/fulfillment";
import { branchOpeningHoursSchema, branchStatus, hoursSummary, NEWARK, type Branch } from "../src/lib/branch";
import { FULFILLMENT_POLICY, type FulfillmentPolicy } from "../src/lib/fulfillment-policy";
import { LOCAL_PAGES, localAreaServed } from "../src/lib/local-pages";
import { homeownerRequestSchema } from "../src/lib/forms/homeowner";
import { dealerFormSchema } from "../src/lib/forms/dealer";
import { canTransition, DEALER_TRANSITIONS } from "../src/lib/dealer-application-state";
import { contactFormSchema, contactPrefill } from "../src/lib/forms/contact";
import { canonicalTopic, CONTACT_TOPICS } from "../src/lib/contact-topics";
import { checkQuoteLines, compatibilityNotes } from "../src/lib/backend/quote";
import { allowedNext, classifyAccess, portalDestination, toAccountContext, toNavAccount } from "../src/lib/access-state";
import { passwordRuleResults, resetPasswordSchema, signupSchema } from "../src/lib/forms/auth";
import { buildSnapshot } from "../src/lib/checkout-snapshot";
import { diffSnapshots, type CheckoutSnapshot } from "../src/lib/checkout-snapshot-types";
import { confirmationMessage, toConfirmation } from "../src/lib/order-confirmation";
import { evaluateReturn } from "../src/lib/returns-policy";
import { LEGAL_ARCHIVE, LEGAL_DOCUMENTS } from "../src/content/legal/registry";
import { recoveryTokens } from "../src/components/not-found-recovery";
import { CATEGORY_RAIL } from "../src/lib/nav-links";
import { mergeDuplicateRows, parseQuantity, parseQuickOrderText, QUICK_ORDER_ROW_LIMIT } from "../src/lib/quick-order";
import { parseQuickOrderCsv } from "../src/lib/csv";
import { accountPriceUnavailable } from "../src/lib/commerce/price-presentation";
import { floatingChatAllowed, shellVariantForPathname } from "../src/lib/shell-variant";

const sku = (code: string) => getStorefrontSku(code)!;
const withStock = (base: StorefrontSku, patch: Partial<StorefrontSku>): StorefrontSku => ({ ...base, ...patch });
const CONFIRMED_REVIEW = { status: "confirmed" as const, reviewedAt: "2026-09-30" };
const CONFIRMED_BRANCH: Branch = { ...NEWARK, hoursReview: CONFIRMED_REVIEW };
const CONFIRMED_POLICY: FulfillmentPolicy = {
  ...FULFILLMENT_POLICY,
  cutoff: { ...FULFILLMENT_POLICY.cutoff, review: CONFIRMED_REVIEW },
  pickupPrep: { ...FULFILLMENT_POLICY.pickupPrep, review: CONFIRMED_REVIEW },
  zones: { ...FULFILLMENT_POLICY.zones, review: CONFIRMED_REVIEW },
  fees: { review: CONFIRMED_REVIEW },
};

describe("01 shell variants", () => {
  it("keeps merchandising chrome on commerce routes and reduces it for task routes", () => {
    assert.equal(shellVariantForPathname("/"), "commerce");
    assert.equal(shellVariantForPathname("/products/ductless/tcl/tcl09kidu"), "commerce");
    assert.equal(shellVariantForPathname("/finder"), "service");
    assert.equal(shellVariantForPathname("/resources/guides/sizing"), "service");
    assert.equal(shellVariantForPathname("/portal/login"), "focused");
    assert.equal(shellVariantForPathname("/account/orders"), "focused");
    assert.equal(shellVariantForPathname("/checkout"), "focused");
    assert.equal(shellVariantForPathname("/accounting"), "commerce");
  });

  it("suppresses floating assistance where it competes with a focused task", () => {
    assert.equal(floatingChatAllowed("/products"), true);
    assert.equal(floatingChatAllowed("/finder"), true);
    assert.equal(floatingChatAllowed("/portal/login"), false);
    assert.equal(floatingChatAllowed("/checkout"), false);
    assert.equal(floatingChatAllowed("/quote"), false);
    assert.equal(floatingChatAllowed("/contact"), false);
  });
});

/* 01 — the homepage has no audience state; covered end-to-end in tests/e2e. */

describe("02 catalog query boundary", () => {
  const pool = getStorefrontSkus();
  const base = { ...EMPTY_FILTERS };

  it("pages 0, 1, 24, 25 and 1000+ results with a correct total and cursor", () => {
    assert.equal(queryCatalog(pool, { ...base, q: "zzzz-no-such-thing" }).total, 0);
    const one = queryCatalog(pool, { ...base, q: "TCL09KIDU" });
    assert.ok(one.total >= 1);
    const twentyFour = queryCatalog(pool.slice(0, 24), base, { limit: 24 });
    assert.equal(twentyFour.items.length, 24);
    assert.equal(twentyFour.nextCursor, null);
    const twentyFive = queryCatalog(pool.slice(0, 25), base, { limit: 24 });
    assert.equal(twentyFive.items.length, 24);
    const rest = queryCatalog(pool.slice(0, 25), base, { cursor: twentyFive.nextCursor, limit: 24 });
    assert.equal(rest.items.length, 1);
    assert.equal(rest.nextCursor, null);
    const big = Array.from({ length: 1100 }, (_, index) => ({ ...pool[index % pool.length], id: `big-${index}` }));
    const page = queryCatalog(big, base, { limit: 24 });
    assert.equal(page.total, 1100);
    assert.equal(page.items.length, 24);
  });

  it("rejects unrenderable records instead of showing blanks", () => {
    const broken = { ...pool[0], id: "broken", title: " " };
    const result = queryCatalog([...pool.slice(0, 3), broken], base);
    assert.deepEqual(result.rejected.map((record) => record.id), ["broken"]);
    assert.equal(result.total, 3);
  });

  it("treats an unreadable cursor as the first page", () => {
    assert.equal(decodeCursor("not-a-cursor"), 0);
  });
});

describe("03 filter codec", () => {
  const facets = getCatalogFacets();
  it("round-trips empty, single-select and multi-brand filters", () => {
    for (const query of ["", "category=furnaces", "brand=Carrier%2CTCL&btu=mid", "q=3+ton&sort=price-asc"]) {
      const parsed = normalizeCatalogFilters(parseCatalogFilters(new URLSearchParams(query)), facets);
      assert.equal(serializeCatalogFilters(parsed), query);
    }
  });
  it("drops malformed, duplicate and unknown parameters", () => {
    const parsed = normalizeCatalogFilters(parseCatalogFilters(new URLSearchParams("category=ductless&brand=TCL,TCL,Nope&btu=huge&sort=wat&evil=1")), facets);
    assert.equal(parsed.category, null);
    assert.deepEqual(parsed.brand, ["TCL"]);
    assert.equal(parsed.btu, null);
    assert.equal(parsed.sort, "relevance");
    assert.equal(serializeCatalogFilters(parsed), "brand=TCL");
  });
  it("encodes cardinality: brand adds, other facets replace", () => {
    let filters = toggleFacet(EMPTY_FILTERS, "brand", "TCL");
    filters = toggleFacet(filters, "brand", "Carrier");
    assert.deepEqual(filters.brand, ["TCL", "Carrier"]);
    filters = toggleFacet(filters, "category", "furnaces");
    filters = toggleFacet(filters, "category", "air-handlers");
    assert.equal(filters.category, "air-handlers");
    assert.deepEqual(removeFacet(filters, "brand", "TCL").brand, ["Carrier"]);
    assert.equal(clearFacets({ ...filters, q: "x" }).q, "x");
    assert.equal(activeFacets(clearFacets(filters)).length, 0);
  });
  it("orders brands canonically so the same filters give one URL", () => {
    const a = normalizeCatalogFilters({ ...EMPTY_FILTERS, brand: ["TCL", "Carrier"] }, facets);
    const b = normalizeCatalogFilters({ ...EMPTY_FILTERS, brand: ["Carrier", "TCL"] }, facets);
    assert.equal(serializeCatalogFilters(a), serializeCatalogFilters(b));
  });
});

describe("04 commerce state", () => {
  const priced = sku("TCL09KIDU");
  const unpriced = getStorefrontSkus().find((item) => item.retailPrice === null)!;

  it("covers the resolver matrix", () => {
    assert.equal(resolveCommerceState(withStock(priced, { availabilityVerified: true, availabilityStatus: "in_stock", available: 5, purchaseEligible: true })).kind, "purchasable");
    assert.equal(resolveCommerceState(withStock(priced, { availabilityVerified: true, availabilityStatus: "out_of_stock", available: 0 })).kind, "unavailable");
    assert.equal(resolveCommerceState(withStock(priced, { availabilityVerified: true, availabilityStatus: "in_stock", available: 5, purchaseEligible: false })).kind, "availabilityRequired");
    assert.equal(resolveCommerceState(priced).kind, "availabilityRequired");
    assert.equal(resolveCommerceState(unpriced).kind, "quoteRequired");
    assert.equal(resolveCommerceState(withStock(priced, { availabilityVerified: true, availabilityStatus: "lead_time", available: 2 })).kind, "quoteRequired");
    assert.equal(resolveCommerceState(withStock(priced, { publicationStatus: "needs_review" })).kind, "unavailable");
  });
  it("never infers checkout from a positive price", () => {
    const state = resolveCommerceState(priced);
    assert.ok((priced.retailPrice ?? 0) > 0);
    assert.notEqual(intentFor(state), "cart");
    assert.equal(presentCommerceState(state).destination, "/quote");
  });
  it("prices an authorized trade account from its own row, and never relabels retail on failure", () => {
    const sellable = withStock(priced, { availabilityVerified: true, availabilityStatus: "in_stock", available: 5, purchaseEligible: true });
    const account = { kind: "tradeApproved" as const, accountId: "acct-1", tierLabel: "Preferred trade" };
    const ok = resolveCommerceState(sellable, { account, pricing: { status: "ok", accountAmount: 300, asOf: "", expiresAt: null } });
    assert.equal(ok.kind === "purchasable" && ok.price.amount, 300);
    assert.equal(ok.kind === "purchasable" && ok.price.tier, "account");
    assert.equal(resolveCommerceState(sellable, { account, pricing: { status: "error" } }).kind, "pricingUnavailable");
    assert.equal(accountPriceUnavailable().amount, null);
  });
  it("migrates a legacy positive-price line to an availability request", () => {
    const legacy = JSON.stringify([{ skuId: priced.id, sku: priced.sku, modelNumber: "", title: priced.title, image: "/x.png", unitPrice: 450, available: 0, qty: 2 }]);
    const [line] = parseStoredItems(null, legacy);
    assert.equal(line.intent, "availability");
  });
  it("rejects a tampered non-purchasable line at checkout", () => {
    const snapshot = buildSnapshot({
      items: [{ skuId: priced.id, qty: 1 }],
      method: "pickup",
      zip: "94560",
      resolveSku: (id) => getStorefrontSku(id),
      account: { kind: "anonymous" },
      pricing: null,
      deliveryFee: () => null,
    });
    assert.equal(snapshot.lines[0].error?.code, "not_purchasable");
    assert.equal(snapshot.subtotal, 0);
  });
});

describe("05/F08 media", () => {
  it("gives stable ids, dedupes, and offers a larger view only for large assets", () => {
    const media = productMedia(["/products/catalog-official/tosot-wall-front.webp", "/products/catalog-official/tosot-wall-front.webp", "/products/catalog-official/tcl24kahu.jpeg"], { title: "Unit", label: "View" });
    assert.equal(media.length, 2);
    assert.ok(media[0].largeSrc);
    assert.equal(media[1].largeSrc, null);
    assert.equal(productMedia(["/missing.png"], { title: "Unit", label: "View" })[0].aspectRatio, null);
  });
  it("keeps the selected image by id through reorder and removal", () => {
    const media = productMedia(["/a.png", "/b.png", "/c.png"], { title: "Unit", label: "View" });
    const selected = media[1].id;
    assert.equal(reconcileActiveId(media, [media[2], media[1], media[0]], selected), selected);
    assert.equal(reconcileActiveId(media, [media[0], media[2]], selected), media[2].id);
    assert.equal(reconcileActiveId(media, [], selected), null);
  });
});

describe("06 brands", () => {
  it("renders unknown brands and builds hrefs from catalog keys", () => {
    const fake = [{ ...getStorefrontSkus()[0], brand: "A Very Long Manufacturer Name Of Forty Ch" }];
    const [card] = brandDirectory(fake);
    assert.equal(card.asset, undefined);
    assert.equal(card.href, "/products?brand=A%20Very%20Long%20Manufacturer%20Name%20Of%20Forty%20Ch");
    for (const brand of brandDirectory(getStorefrontSkus())) {
      assert.ok(filterStorefrontSkus({ brand: brand.key }).length > 0, `${brand.key} lands on products`);
    }
  });
  it("fits wide, tall and square marks in the optical box", () => {
    for (const asset of [{ src: "", width: 4000, height: 200 }, { src: "", width: 200, height: 800 }, { src: "", width: 500, height: 500 }]) {
      const size = opticalSize(asset, { width: 260, height: 112 });
      assert.ok(size.width <= 260 && size.height <= 112, JSON.stringify(size));
    }
  });
});

describe("07 resources", () => {
  it("adapts guides and documents, and labels behavior in words", () => {
    const guide = fromGuide(SEO_GUIDES[0]);
    assert.equal(behaviorLabel(guide), "Guide");
    const [doc] = fromDocuments([{ sku: "X1", documents: [{ kind: "spec_sheet", title: "Spec", url: "/documents/tosot-tu36-32gdu-submittal.pdf", modelCoverageVerified: true }] }], () => ({ sizeBytes: 1_258_291, exists: true }));
    assert.equal(behaviorLabel(doc), "PDF, 1.2 MB · Hosted by Summit · Opens in a new tab");
    const [missing] = fromDocuments([{ sku: "X1", documents: [{ kind: "spec_sheet", title: "Spec", url: "/documents/gone.pdf", modelCoverageVerified: true }] }], () => ({ sizeBytes: null, exists: false }));
    assert.equal(missing.type === "document" && missing.available, false);
  });
  it("rejects variants missing their required fields", () => {
    assert.throws(() => validateResource({ type: "external", id: "x", title: "t", summary: "", topics: [], audience: [], updated: null, destination: "/relative", source: "s", opensInNewTab: true }), InvalidResourceError);
  });
  it("round-trips filters through the URL", () => {
    const filters = parseResourceFilters(new URLSearchParams("q=permit&type=guide&topic=Permits+%26+code"));
    assert.equal(serializeResourceFilters(filters), "q=permit&type=guide&topic=Permits+%26+code");
    assert.equal(parseResourceFilters(new URLSearchParams("type=bogus")).type, null);
    assert.ok(filterResources(SEO_GUIDES.map(fromGuide), filters).length >= 1);
  });
});

describe("08 guides", () => {
  it("gives every section a unique, stable id", () => {
    for (const guide of SEO_GUIDES) {
      const ids = guide.sections.map((section) => section.id);
      assert.equal(new Set(ids).size, ids.length, guide.slug);
      assert.ok(ids.every((id) => /^[a-z0-9-]+$/.test(id)));
    }
  });
});

describe("09 model identifiers", () => {
  const records: IdentifierRecord[] = [
    { id: "a", codes: [{ value: "TSC-09HA1/I3TI22", field: "model" }, { value: "TCL09KIDU", field: "sku" }] },
    { id: "b", codes: [{ value: "TCL09KODU", field: "sku" }] },
    { id: "c", codes: [{ value: "TCL24KAHU", field: "sku" }] },
  ];
  it("normalizes case, spaces, hyphens and slashes", () => {
    assert.equal(normalizeIdentifier(" tsc-09ha1 / i3ti22 "), "TSC09HA1I3TI22");
    assert.equal(leadingZeroForm("TCL09K"), "TCL9K");
  });
  it("ranks exact over partial and labels OCR confusions as suggestions", () => {
    const exact = resolveIdentifier("tcl09kidu", records);
    assert.equal(exact.kind, "exact");
    assert.equal(exact.kind === "exact" && exact.match.id, "a");
    const ambiguous = resolveIdentifier("TCL09K", records);
    assert.equal(ambiguous.kind, "ambiguous");
    const ocr = resolveIdentifier("TCLO9KIDU", records);
    assert.equal(ocr.kind, "no_coverage");
    assert.equal(ocr.kind === "no_coverage" && ocr.suggestions[0].reason, "ocr");
    assert.equal(rankIdentifiers("TCL09KIDU", records)[0].matchType, "exact");
    assert.equal(rankIdentifiers("tcl-09 kidu", records)[0].matchType, "normalized");
  });
  it("handles too-short and punctuation-only input", () => {
    assert.equal(resolveIdentifier("tc", records).kind, "too_short");
    assert.equal(resolveIdentifier("--/", records).kind, "invalid");
  });
  it("never claims compatibility without a verified cross-reference", () => {
    assert.deepEqual(crossReferenceLookup("TCL09KIDU"), []);
    assert.equal(normalizeModelQuery("Tsc-09"), normalizeIdentifier("Tsc-09").toLowerCase());
  });
});

describe("10 fulfillment answer and promise", () => {
  const thursday10 = new Date("2026-10-01T17:00:00Z"); // Thu 10:00 PDT
  const thursday15 = new Date("2026-10-01T22:00:00Z"); // Thu 15:00 PDT
  const friday10 = new Date("2026-10-02T17:00:00Z");
  const wednesdayBeforeThanksgiving = new Date("2026-11-25T18:00:00Z");

  it("answers eligible, ineligible, malformed and unknown ZIPs", () => {
    assert.equal(resolveFulfillmentAnswer("94601", thursday10, CONFIRMED_POLICY, CONFIRMED_BRANCH).kind, "eligible");
    assert.equal(resolveFulfillmentAnswer("94952", thursday10, CONFIRMED_POLICY, CONFIRMED_BRANCH).kind, "ineligible");
    assert.equal(resolveFulfillmentAnswer("9460", thursday10, CONFIRMED_POLICY, CONFIRMED_BRANCH).kind, "malformed");
    assert.equal(resolveFulfillmentAnswer("10001", thursday10, CONFIRMED_POLICY, CONFIRMED_BRANCH).kind, "unknown");
    assert.equal(resolveFulfillmentAnswer("94601", thursday10, null).kind, "unavailable");
    assert.equal(resolveFulfillmentAnswer("94601", thursday10).kind, "unavailable", "draft policy is never a public promise");
  });
  it("states the cutoff, Friday and holiday rules the same way checkout applies them", () => {
    assert.equal(deliveryPromise(thursday10, CONFIRMED_POLICY, CONFIRMED_BRANCH)?.line, "Order by 2 PM Thu, arrives Fri");
    assert.equal(deliveryPromise(thursday15, CONFIRMED_POLICY, CONFIRMED_BRANCH)?.line, "Order by 2 PM Fri, arrives Mon");
    assert.equal(deliveryPromise(friday10, CONFIRMED_POLICY, CONFIRMED_BRANCH)?.line, "Order by 2 PM Fri, arrives Mon");
    assert.equal(deliveryPromise(wednesdayBeforeThanksgiving, CONFIRMED_POLICY, CONFIRMED_BRANCH)?.line, "Order by 2 PM Wed, arrives Fri");
    const [first] = fulfillmentWindows("local_delivery", "94601", thursday10, CONFIRMED_POLICY);
    assert.equal(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date(first.startAt)), deliveryPromise(thursday10, CONFIRMED_POLICY, CONFIRMED_BRANCH)?.arrivesDay);
    const answer = resolveFulfillmentAnswer("94601", thursday10, CONFIRMED_POLICY, CONFIRMED_BRANCH);
    assert.equal(answer.kind === "eligible" && answer.methods.find((method) => method.method === "local_delivery")?.earliest, "tomorrow");
  });
  it("never publishes an unconfirmed fee", () => {
    const pendingFees = { ...CONFIRMED_POLICY, fees: { review: { status: "pending_operations" as const, reviewedAt: null } } };
    const answer = resolveFulfillmentAnswer("94538", thursday10, pendingFees, CONFIRMED_BRANCH);
    assert.equal(answer.kind === "eligible" && answer.fee.status, "quoted");
  });
});

describe("11 branch status", () => {
  const at = (iso: string) => branchStatus(CONFIRMED_BRANCH, new Date(iso));
  it("covers open, closing soon, closed, weekend, holiday and DST", () => {
    assert.equal(at("2026-10-01T13:00:00Z").label, "Closed · opens 7 AM");
    assert.equal(at("2026-10-01T17:00:00Z").kind, "open");
    assert.equal(at("2026-10-01T23:30:00Z").kind, "closingSoon");
    assert.equal(at("2026-10-02T01:00:00Z").label, "Closed · opens tomorrow 7 AM");
    assert.equal(at("2026-10-03T19:00:00Z").label, "Closed · opens Mon 7 AM");
    assert.equal(at("2026-11-26T18:00:00Z").kind, "exception");
    assert.equal(at("2026-03-09T14:30:00Z").kind, "open"); // 7:30 PDT, the Monday after DST starts
    assert.equal(at("2026-03-09T13:30:00Z").kind, "closed");
    assert.equal(branchStatus(null).kind, "unknown");
  });
  it("derives visible hours and structured data from one model", () => {
    assert.equal(hoursSummary(CONFIRMED_BRANCH), "Mon–Fri 7 AM–5 PM PT");
    const schema = branchOpeningHoursSchema(CONFIRMED_BRANCH, new Date("2026-11-01T18:00:00Z"));
    const opening = schema.openingHoursSpecification ?? [];
    const special = schema.specialOpeningHoursSpecification ?? [];
    assert.deepEqual(opening[0].dayOfWeek, ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    assert.ok(special.some((entry) => entry.validFrom === "2026-11-26"));
    assert.deepEqual(branchOpeningHoursSchema(NEWARK), {}, "unapproved hours are omitted from structured data");
  });
});

describe("12 local pages", () => {
  it("links only to valid catalog destinations and scopes areaServed to policy coverage", () => {
    const facets = getCatalogFacets();
    for (const page of LOCAL_PAGES) {
      for (const href of [page.primaryHref, page.secondaryHref]) {
        if (!href.startsWith("/products?")) continue;
        const params = new URLSearchParams(href.split("?")[1]);
        const filters = normalizeCatalogFilters(parseCatalogFilters(params), facets);
        assert.equal(serializeCatalogFilters(filters), params.toString(), `${page.slug}: ${href} has unknown filter values`);
        assert.ok(filterStorefrontSkus(toCatalogFilters(filters)).length > 0, `${page.slug}: ${href} is empty`);
      }
      assert.ok(localAreaServed(page).every((name) => name.endsWith(", CA")));
    }
  });
});

describe("13/14/16 typed request schemas", () => {
  it("homeowner requests are typed and carry no dealer fields", () => {
    const shape = Object.keys(homeownerRequestSchema.shape);
    for (const field of ["licenseNumber", "taxIdLast4", "monthlyVolume", "resaleCertificateNumber"]) assert.ok(!shape.includes(field));
    assert.equal(homeownerRequestSchema.safeParse({ zip: "94560", city: "Newark", homeType: "adu", zones: "1", existingDucts: "no", rebateInterest: "yes", timeline: "month", name: "Pat", email: "pat@example.com", consent: false }).success, false);
  });
  it("dealer requirements are conditional on the business", () => {
    const base = { company: "Acme HVAC", entityType: "llc", contactName: "Pat Lee", email: "pat@acme.com", phone: "4155551234", taxIdLast4: "1234", buysForResale: "no", serviceArea: "ca", monthlyVolume: "1-5" };
    assert.equal(dealerFormSchema.safeParse({ ...base, businessType: "contractor", licenseApplicable: "no" }).success, false);
    assert.equal(dealerFormSchema.safeParse({ ...base, businessType: "contractor", licenseApplicable: "yes", licenseNumber: "1234567", licenseState: "ca" }).success, true);
    assert.equal(dealerFormSchema.safeParse({ ...base, businessType: "dealer", licenseApplicable: "no", buysForResale: "yes" }).success, false);
    assert.equal(dealerFormSchema.safeParse({ ...base, businessType: "dealer", licenseApplicable: "no", buysForResale: "yes", resaleCertificateNumber: "SR-12345" }).success, true);
  });
  it("dealer application transitions follow the approved matrix", () => {
    assert.ok(canTransition("submitted", "under_review"));
    assert.ok(!canTransition("approved", "rejected"));
    assert.ok(!canTransition("draft", "approved"));
    assert.deepEqual(DEALER_TRANSITIONS.approved, []);
  });
  it("contact prefill only accepts allow-listed, canonical values", () => {
    const prefill = contactPrefill(new URLSearchParams("topic=hack&sku=tcl24kahu&branch=paris&order=<script>"), (raw) => getStorefrontSku(raw)?.sku ?? null);
    assert.deepEqual(prefill, { topic: "product", sku: "TCL24KAHU", branchId: undefined, orderRef: "" });
    assert.equal(contactPrefill(new URLSearchParams("sku=NOPE"), () => null).sku, "");
    assert.equal(canonicalTopic("property"), "quote");
    assert.ok(CONTACT_TOPICS.every((topic) => topic.responseWindow && topic.queue));
    assert.equal(contactFormSchema.safeParse({ topic: "product", name: "", email: "x", message: "" }).success, false);
  });
});

describe("17 quote lines", () => {
  it("merges duplicates, rejects unknown SKUs visibly, and never guesses compatibility", () => {
    const indoor = sku("TCL09KIDU");
    const outdoor = sku("TCL09KODU");
    const { lines, merged } = checkQuoteLines([
      { skuId: indoor.id, sku: indoor.sku, quantity: 2 },
      { skuId: indoor.id, sku: indoor.sku, quantity: 3 },
      { skuId: "nope", sku: "NOPE", quantity: 1 },
      { skuId: outdoor.id, sku: outdoor.sku, quantity: 1 },
    ]);
    assert.deepEqual(lines.map((line) => line.status), ["valid", "merged", "unknown", "valid"]);
    assert.equal(merged.find((line) => line.sku.id === indoor.id)?.quantity, 5);
    const notes = compatibilityNotes(merged.map((line) => line.sku));
    assert.ok(notes.length > 0 && notes.every((note) => note.verdict === "unverified"));
  });
});

describe("18/21 access state", () => {
  const profile = { userId: "u", email: "pat@example.com", name: "Pat", role: "dealer" as const, accountId: "a" };
  const account = { id: "a", name: "Acme", status: "active", priceTier: "standard" };
  it("routes every authentication/authorization combination deterministically", () => {
    const user = { id: "u", email: "pat@example.com" };
    assert.equal(classifyAccess({ user: null, profile: null, account: null, application: null }).kind, "signedOut");
    assert.equal(classifyAccess({ user, profile: null, account: null, application: null }).kind, "profileMissing");
    assert.equal(classifyAccess({ user, profile: null, account: null, application: "under_review" }).kind, "pendingApplication");
    assert.equal(classifyAccess({ user, profile: null, account: null, application: "needs_information" }).kind, "needsInformation");
    assert.equal(classifyAccess({ user, profile: { ...profile, accessStatus: "suspended" }, account, application: null }).kind, "disabled");
    assert.equal(classifyAccess({ user, profile, account: { ...account, status: "suspended" }, application: null }).kind, "disabled");
    const ready = classifyAccess({ user, profile, account, application: null });
    assert.equal(portalDestination(ready), "/portal/dealer");
    assert.equal(portalDestination(classifyAccess({ user, profile: null, account: null, application: null })), "/portal/status");
    assert.equal(toNavAccount(ready).variant, "tradeApproved");
    assert.equal(toAccountContext(ready).kind, "tradeApproved");
  });
  it("honors next only when the role may see it", () => {
    const user = { id: "u", email: "pat@example.com" };
    const homeowner = classifyAccess({ user, profile: { ...profile, role: "homeowner", accountId: null }, account: null, application: null });
    assert.equal(allowedNext(homeowner, "/admin"), null);
    assert.equal(allowedNext(homeowner, "/checkout"), "/checkout");
    assert.equal(allowedNext(homeowner, "/portal/login"), null);
    assert.equal(toNavAccount(classifyAccess({ user, profile: { ...profile, role: "homeowner", accountId: null }, account: null, application: "submitted" })).variant, "tradePending");
  });
  it("links an approved pre-signup application and keeps privileged RPCs service-only", () => {
    const migration = readFileSync("supabase/migrations/026_identity_and_trade_access.sql", "utf8");
    assert.match(migration, /where normalized_email = lower\(btrim\(new\.email\)\)/);
    assert.match(migration, /v_application\.status = 'approved'/);
    for (const signature of [
      "handle_new_retail_user()",
      "dealer_application_transition_allowed(text, text)",
      "transition_dealer_application(uuid, text, text, text)",
      "approve_dealer_application(uuid, text, text)",
    ]) {
      assert.ok(migration.includes(`revoke all on function public.${signature} from public, anon, authenticated`), signature);
    }
  });
});

describe("19/23 one password policy", () => {
  it("applies the same rules to signup and reset", () => {
    for (const password of ["short1", "allletters!!", "1234567890"]) {
      assert.equal(signupSchema.safeParse({ name: "Pat Lee", email: "pat@example.com", password }).success, false, password);
      assert.equal(resetPasswordSchema.safeParse({ password, confirm: password }).success, false, password);
    }
    assert.equal(signupSchema.safeParse({ name: "Pat Lee", email: "PAT@Example.com", password: "copper-line-42" }).success, true);
    assert.equal(resetPasswordSchema.safeParse({ password: "copper-line-42", confirm: "copper-line-43" }).success, false);
    assert.ok(passwordRuleResults("pat@example.com", "pat@example.com").some((rule) => rule.id === "not-email" && !rule.met));
  });
});

describe("24 checkout snapshot", () => {
  const sellable = withStock(sku("TCL09KIDU"), { availabilityVerified: true, availabilityStatus: "in_stock", available: 3, purchaseEligible: true });
  const build = (method: "pickup" | "local_delivery" | "freight", zip: string | null, qty = 1) =>
    buildSnapshot({ items: [{ skuId: sellable.id, qty }], method, zip, resolveSku: () => sellable, account: { kind: "anonymous" }, pricing: null, deliveryFee: () => null, now: new Date("2026-10-01T17:00:00Z") });

  it("prices, taxes and totals on the server", () => {
    const snapshot = build("pickup", "94560", 2);
    assert.equal(snapshot.subtotal, 900);
    assert.equal(snapshot.tax.status, "estimated");
    assert.equal(snapshot.total, Math.round((900 + snapshot.tax.amount) * 100) / 100);
  });
  it("never silently swaps an unavailable method", () => {
    const snapshot = build("local_delivery", "10001");
    assert.equal(snapshot.method, "local_delivery");
    assert.equal(snapshot.methodAvailable, false);
  });
  it("flags quantity beyond counted stock", () => {
    assert.equal(build("pickup", "94560", 9).lines[0].error?.code, "exceeds_stock");
  });
  it("describes what changed between snapshots", () => {
    const before = { ...build("pickup", "94560"), digest: "a", token: "t" } as CheckoutSnapshot;
    const after = { ...before, lines: [{ ...before.lines[0], unitPrice: 500 }], total: 550 } as CheckoutSnapshot;
    const kinds = diffSnapshots(before, after).map((diff) => diff.kind);
    assert.ok(kinds.includes("price") && kinds.includes("total"));
  });
});

describe("25 confirmation states", () => {
  const order = { order_number: "SO-1", checkout_state: "paid", payment_mode: "card" as const, subtotal: 100, total: 110, fulfillment_fee: 0 };
  it("separates payment, order and fulfillment", () => {
    const backordered = toConfirmation({ ...order, lines: [{ description: "Unit (X1)", quantity: 1, unit_price: 100, fulfillment_status: "backordered" }] });
    assert.equal(backordered.payment, "paid");
    assert.equal(backordered.fulfillment, "backordered");
    assert.equal(confirmationMessage(backordered).tone, "warning");
    const partial = toConfirmation({ ...order, lines: [{ description: "A (A1)", quantity: 1, unit_price: 50, fulfillment_status: "ready" }, { description: "B (B1)", quantity: 1, unit_price: 50, fulfillment_status: "backordered" }] });
    assert.equal(partial.fulfillment, "partial");
    assert.equal(toConfirmation({ ...order, checkout_state: "payment_failed" }).order, "cancelled");
    assert.equal(toConfirmation({ ...order, payment_mode: "net_terms", checkout_state: "confirmed" }).payment, "invoiced");
  });
  it("a failed email never fails the order", () => {
    const confirmation = toConfirmation({ ...order, confirmation_email_status: "failed" });
    assert.equal(confirmation.order, "confirmed");
    assert.equal(confirmation.email, "failed");
  });
  it("masks contact details", () => {
    const confirmation = toConfirmation({ ...order, buyer_email: "pat.lee@example.com", delivery_address: "5437 Central Ave, Newark", delivery_zip: "94560" });
    assert.equal(confirmation.contact.email, "p•••@example.com");
    assert.ok(!confirmation.address?.includes("Central"));
  });
});

describe("27 return rules", () => {
  it("cites the rule that fired", () => {
    const full = evaluateReturn({ arrivedDamagedOrWrong: false, installed: false, specialOrder: false, openedRefrigerant: false, daysSinceDelivery: 10, opened: false });
    assert.equal(full.kind === "result" && full.verdict, "full_refund");
    assert.equal(full.kind === "result" && full.sectionId, "what-can-be-returned");
    const restock = evaluateReturn({ arrivedDamagedOrWrong: false, installed: false, specialOrder: false, openedRefrigerant: false, daysSinceDelivery: 10, opened: true });
    assert.equal(restock.kind === "result" && restock.verdict, "refund_less_restocking");
    assert.equal(evaluateReturn({ arrivedDamagedOrWrong: false, installed: true }).kind === "result", true);
    const late = evaluateReturn({ arrivedDamagedOrWrong: false, installed: false, specialOrder: false, openedRefrigerant: false, daysSinceDelivery: 45 });
    assert.equal(late.kind === "result" && late.reasonCode, "outside_window");
    const damage = evaluateReturn({ arrivedDamagedOrWrong: true, damageNotedOnReceipt: true });
    assert.equal(damage.kind === "result" && damage.verdict, "damage_claim");
    assert.deepEqual(evaluateReturn({}), { kind: "needs", question: "arrivedDamagedOrWrong" });
  });
});

describe("29/30 legal documents", () => {
  it("has unique, permanent section ids and a version history with archives", () => {
    for (const document of Object.values(LEGAL_DOCUMENTS)) {
      const ids = [...document.sections.map((section) => section.id), ...document.sections.flatMap((section) => section.definitions?.map((definition) => definition.id) ?? [])];
      assert.equal(new Set(ids).size, ids.length, document.id);
      assert.equal(document.history[0].version, document.version);
      for (const entry of document.history) assert.ok(LEGAL_ARCHIVE[document.id][entry.version], `${document.id} ${entry.version} archived`);
    }
    const terms = LEGAL_DOCUMENTS.terms;
    const definitions = terms.sections.find((section) => section.id === "definitions")?.definitions ?? [];
    assert.ok(definitions.length >= 3);
    assert.ok(terms.sections.some((section) => section.id === "accounts"), "definition cross-link target exists");
  });
  it("keeps old anchors alive in archived versions", () => {
    const old = LEGAL_ARCHIVE.terms["1.0"];
    const current = LEGAL_DOCUMENTS.terms;
    for (const section of old.sections) assert.ok(current.sections.some((entry) => entry.id === section.id), section.id);
  });
});

describe("31 not-found recovery", () => {
  it("keeps only path fragments and drops anything that looks private", () => {
    const { pattern, segments } = recoveryTokens("/products/sku/pat@example.com/abcdef0123456789abcdef0123456789abcd/tcl09kid");
    assert.equal(pattern, "/products/*");
    assert.deepEqual(segments, ["products", "sku", "tcl09kid"]);
  });
});

describe("F01 navigation destinations", () => {
  it("links only categories and rail entries that land on products", () => {
    for (const category of catalogCategoryDestinations().filter((entry) => entry.status === "available")) {
      assert.ok(category.productCount > 0 && category.href.startsWith("/products?category="));
    }
    assert.ok(catalogCategoryDestinations().some((entry) => entry.status === "empty"), "empty categories are marked, not linked");
    for (const item of CATEGORY_RAIL) {
      const filters = parseCatalogFilters(new URLSearchParams(item.href.split("?")[1]));
      assert.ok(filterStorefrontSkus(toCatalogFilters(filters)).length > 0, item.href);
    }
  });
});

describe("F04/F05 quick order and CSV", () => {
  it("parses rows without coercing bad quantities", () => {
    assert.deepEqual(parseQuantity("2"), { quantity: 2, error: null });
    for (const [raw, error] of [["", "missing_quantity"], ["0", "zero_quantity"], ["-1", "negative_quantity"], ["1.5", "decimal_quantity"], ["two", "invalid_quantity"], ["999", "oversized_quantity"]] as const) {
      assert.equal(parseQuantity(raw).error, error, raw);
    }
    const { rows } = parseQuickOrderText("TCL24KAHU, 2\n\n  tcl24kahu ,3\nTOS12KODU\nX\t1");
    assert.equal(rows.length, 4);
    assert.deepEqual(rows[2].errors, ["missing_quantity"]);
    const merged = mergeDuplicateRows(rows);
    assert.equal(merged[0].quantity, 5);
    assert.deepEqual(merged[0].mergedLines, [1, 3]);
  });
  it("reports rows past the limit instead of slicing them away", () => {
    const text = Array.from({ length: QUICK_ORDER_ROW_LIMIT + 3 }, (_, index) => `SKU${index}, 1`).join("\n");
    assert.equal(parseQuickOrderText(text).overLimit, 3);
  });
  it("reads BOM, CRLF, quoted fields, tabs and reordered headers", () => {
    const csv = parseQuickOrderCsv('﻿quantity,notes,sku\r\n2,"needs ""rush"", please",TCL24KAHU\r\n1,,TOS12KODU\r\n');
    assert.ok(csv.ok);
    assert.equal(csv.ok && csv.rows[0].sku, "TCL24KAHU");
    assert.deepEqual(csv.ok && csv.ignoredColumns, ["notes"]);
    const tabs = parseQuickOrderCsv("sku\tqty\nTCL24KAHU\t2\n");
    assert.equal(tabs.ok && tabs.delimiter, "\t");
  });
  it("rejects malformed files with specific messages", () => {
    assert.equal(parseQuickOrderCsv('sku,quantity\n"TCL24KAHU,2\n').ok === false && "malformed", "malformed");
    const missing = parseQuickOrderCsv("part\nTCL24KAHU\n");
    assert.equal(!missing.ok && missing.error.code, "missing_header");
    const duplicate = parseQuickOrderCsv("sku,model,quantity\nA,B,1\n");
    assert.equal(!duplicate.ok && duplicate.error.code, "duplicate_header");
    assert.equal(!parseQuickOrderCsv("x", 3_000_000).ok, true);
  });
  it("gives pasted and CSV input identical rows", () => {
    const pasted = parseQuickOrderText("TCL24KAHU, 2\nTOS12KODU, 0").rows.map(({ sku, quantity, errors }) => ({ sku, quantity, errors }));
    const csv = parseQuickOrderCsv("sku,quantity\nTCL24KAHU,2\nTOS12KODU,0\n");
    assert.ok(csv.ok);
    assert.deepEqual(csv.ok && csv.rows.map(({ sku, quantity, errors }) => ({ sku, quantity, errors })), pasted);
  });
});
