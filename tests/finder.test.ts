import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { getStorefrontSkus } from "../src/lib/storefront/catalog";
import { caResidentialStatus, homeownerEligibleSystems, matchedSystems, meetsMinimum, systemHomeownerEligibility } from "../src/lib/catalog/compliance";
import { airConditionerBand } from "../src/lib/efficiency-policy";
import { brandPolicy } from "../src/lib/brand-policy";
import { CAPACITY_BANDS, estimateCapacityBtu } from "../src/lib/sizing";
import { questionsFor, prunedAnswers, segmentFor, tagsFor } from "../src/lib/finder/questions";
import { recommendForContractor, recommendForHomeowner } from "../src/lib/finder/recommend";
import { shortlistBody } from "../src/lib/finder/email";
import { prefillFromAnswers } from "../src/lib/finder/handoff";
import { finderFunnel } from "../src/lib/finder/funnel";
import { adsConfig } from "../src/lib/ads-config";
import { browserOptedOut, readCookie } from "../src/lib/privacy-cookies";
import { groupAudienceEmails, hashedAudienceCsv, audienceMinimum, audiencePurpose } from "../src/lib/audiences";
import { attributeReferralOrders, referralPreferencesSchema } from "../src/lib/referrals";
import { canMarket, canShareForAds, getConsent, recordAdSharingOptOut, recordMarketingConsent, withdrawByToken } from "../src/lib/backend/consent";
import { categoryAlertMatches, dispatchPlanningSeries, planningEmail, startPlanningSeries, stopPlanningSeries } from "../src/lib/backend/lifecycle";
import { readReportPages } from "../src/lib/backend/report-pages";
import { deliverOnce } from "../src/lib/backend/lifecycle-delivery";

const skus = getStorefrontSkus();

describe("finder compliance and sizing", () => {
  it("never treats missing efficiency ratings as compliant", () => {
    const input = { ...skus[0], category: "central-heat-pumps" as const, specifications: {}, ahri: null };
    assert.equal(caResidentialStatus(input), "unknown");
    assert.equal(meetsMinimum("heat_pump", 36000, { seer2: 20, eer2: null, hspf2: null }), null);
    assert.equal(meetsMinimum("heat_pump", 36000, { seer2: 14.2, eer2: null, hspf2: 8 }), false);
    assert.equal(meetsMinimum("heat_pump", 36000, { seer2: 14.3, eer2: null, hspf2: 7.5 }), true);
  });
  it("uses the two AC capacity bands and requires EER2", () => {
    assert.equal(airConditionerBand(44999).minSeer2, 14.3);
    assert.equal(airConditionerBand(45000).minSeer2, 13.8);
    assert.equal(meetsMinimum("air_conditioner", 44999, { seer2: 13.8, eer2: 11.2, hspf2: null }), false);
    assert.equal(meetsMinimum("air_conditioner", 45000, { seer2: 13.8, eer2: 11.2, hspf2: null }), true);
    assert.equal(meetsMinimum("air_conditioner", 45000, { seer2: 15, eer2: null, hspf2: null }), null);
  });
  it("has three matched systems, exactly one eligible, and holds R-410A", () => {
    assert.equal(matchedSystems(skus).length, 3);
    const eligible = homeownerEligibleSystems(skus);
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].ahriReference, "215869484");
    assert.equal(systemHomeownerEligibility({ ...eligible[0], refrigerant: "R-410A" }).eligible, false);
    assert.equal(brandPolicy("unlisted").homeownerSaleAllowed, false);
  });
  it("handles every sizing band boundary and out-of-range values", () => {
    for (const [index, band] of CAPACITY_BANDS.entries()) {
      assert.equal(estimateCapacityBtu(band.maxSqFt), band.btu);
      assert.equal(estimateCapacityBtu(band.maxSqFt + 1), CAPACITY_BANDS[index + 1]?.btu ?? null);
    }
    for (const value of [0, -1, NaN, Infinity]) assert.equal(estimateCapacityBtu(value), null);
  });
});

describe("finder branches and results", () => {
  it("prunes stale capacity answers when switching to parts or account opening", () => {
    assert.deepEqual(questionsFor("contractor", { need: "open_account" }).map((q) => q.id), ["need"]);
    assert.deepEqual(prunedAnswers("contractor", { need: "parts_supplies", capacity: "36000", system: "mini_split", timing: "today" }), { need: "parts_supplies", timing: "today" });
    assert.equal(questionsFor("homeowner", {}).length, 5);
  });
  it("derives broad segments and keeps finer preferences as tags", () => {
    assert.equal(segmentFor({ path: "contractor", answers: {} }), "contractor");
    assert.equal(segmentFor({ path: "homeowner", answers: { goal: "replace_failed" } }), "homeowner_active");
    assert.equal(segmentFor({ path: "homeowner", answers: {} }), "homeowner_researching");
    assert.deepEqual(tagsFor({ path: "homeowner", answers: { goal: "replace_failed", priority: "bills", current: "no_ducts" } }), ["emergency", "efficiency", "ductless_interest"]);
  });
  it("offers no ductless match and one verified ducted whole-home system", () => {
    assert.equal(recommendForHomeowner({ current: "no_ducts", size: "room_small" }, skus).options.length, 0);
    assert.equal(recommendForHomeowner({ current: "ducted_central", size: "home_mid" }, skus).options.length, 1);
  });
  it("contractor responses expose no pricing fields", () => {
    const result = recommendForContractor({ need: "job_equipment", system: "mini_split" }, skus);
    assert.ok(result.items.length);
    assert.doesNotMatch(JSON.stringify(result), /retailPrice|dealerPrice|unitPrice|msrp|retailTotal/);
  });
  it("escapes catalog text in shortlist email", () => {
    const result = recommendForContractor({}, skus);
    result.items[0].title = '<img src=x onerror="alert(1)">';
    const html = shortlistBody(result, "https://example.com", "555-555-5555");
    assert.ok(html.includes("&lt;img"));
    assert.ok(!html.includes('<img src=x'));
  });
  it("prefills only answers actually given", () => {
    assert.equal(prefillFromAnswers({ goal: "replace_failed", current: "ducted_central", zip: "94560" }).timeline, "asap");
    assert.equal(prefillFromAnswers({ current: "no_ducts" }).existingDucts, "no");
    assert.equal(prefillFromAnswers({}).existingDucts, undefined);
  });
});

describe("privacy and audiences", () => {
  it("requires all five advertising gates", () => {
    const env = { ADS_ENABLED: "true", NEXT_PUBLIC_META_PIXEL_ID: "123456789" };
    const privacy = { disclosesSharing: true, approved: true };
    assert.equal(adsConfig(env, privacy, 1).enabled, true);
    assert.equal(adsConfig({}, { disclosesSharing: false, approved: false }, 0).blockers.length, 5);
    assert.equal(adsConfig(env, { ...privacy, approved: false }, 1).enabled, false);
    assert.equal(adsConfig(env, privacy, 0).enabled, false);
    assert.equal(adsConfig({ ...env, ADS_LEAD_GEN_APPROVED: "true" }, privacy, 0).enabled, true);
    assert.equal(adsConfig().enabled, false);
  });
  it("honors either browser signal and tolerates malformed cookies", () => {
    assert.equal(browserOptedOut("", true), true);
    assert.equal(browserOptedOut("other=1; summit_ad_opt_out=1", false), true);
    assert.equal(browserOptedOut("summit_ad_consent=granted", false), false);
    assert.equal(readCookie("broken", "broken=%xx"), "%xx");
  });
  it("takes the latest session, deduplicates emails, and excludes purchasers from targets", () => {
    const groups = groupAudienceEmails([" A@example.com ", "a@example.com", "b@example.com"], [
      { email: "a@example.com", segment: "homeowner_researching", completed_at: "2026-09-01" },
      { email: "a@example.com", segment: "contractor", completed_at: "2026-10-01" },
      { email: "b@example.com", segment: "homeowner_active", completed_at: "2026-10-01" },
      { email: "no-consent@example.com", segment: "contractor", completed_at: "2026-10-01" },
    ], ["B@example.com"]);
    assert.deepEqual(groups.contractor, ["a@example.com"]);
    assert.deepEqual(groups.customer, ["b@example.com"]);
    assert.equal(groups.homeowner_active.length, 0);
    assert.equal(audienceMinimum("customer"), 100);
    assert.equal(audienceMinimum("contractor"), 250);
    assert.equal(audiencePurpose("customer"), "exclude");
  });
  it("exports hashes only", () => {
    const csv = hashedAudienceCsv([" A@example.com ", "a@example.com"]);
    assert.match(csv, /^email\r\n[a-f0-9]{64}\r\n$/);
    assert.ok(!csv.includes("@"));
  });
  it("does not lose opt-out when someone later consents or unsubscribes", async () => {
    const email = "privacy-regression@example.test";
    await recordAdSharingOptOut(email);
    const consent = await recordMarketingConsent(email, "finder");
    assert.equal(canMarket(consent), true);
    assert.equal(canShareForAds(consent), false);
    await withdrawByToken(consent.unsubscribeToken);
    assert.equal(canMarket(await getConsent(email)), false);
  });
});

describe("referral and reporting rules", () => {
  it("validates and deduplicates referral ZIPs", () => {
    assert.deepEqual(referralPreferencesSchema.parse({ accepts: true, paused: false, zips: "94560, 94560 94538" }).zips, ["94560", "94538"]);
    assert.equal(referralPreferencesSchema.safeParse({ accepts: true, paused: false, zips: "" }).success, false);
    assert.equal(referralPreferencesSchema.safeParse({ accepts: true, paused: false, zips: "9456" }).success, false);
  });
  it("counts each paid order once against the latest preceding introduction", () => {
    const totals = attributeReferralOrders([
      { id: "a", account_id: "installer", introduced_at: "2026-09-01" },
      { id: "b", account_id: "installer", introduced_at: "2026-09-10" },
    ], [
      { id: "old", account_id: "installer", created_at: "2026-08-01", total: 999 },
      { id: "one", account_id: "installer", created_at: "2026-09-05", total: 100 },
      { id: "two", account_id: "installer", created_at: "2026-09-15", total: "200" },
    ]);
    assert.deepEqual(totals.get("a"), { orders: 1, total: 100 });
    assert.deepEqual(totals.get("b"), { orders: 1, total: 200 });
  });
  it("handles empty funnel denominators and computes observed event rates", () => {
    assert.equal(finderFunnel([]).completionRate, "—");
    const result = finderFunnel([{ name: "finder_started", count: 10 }, { name: "finder_completed", count: 5 }, { name: "finder_marketing_optin", count: 2 }]);
    assert.equal(result.completionRate, "50.0%");
    assert.equal(result.optInRate, "40.0%");
  });
  it("reads beyond the database row cap and refuses partial error results", async () => {
    const records = Array.from({ length: 1250 }, (_, id) => ({ id }));
    assert.equal((await readReportPages(async (from, to) => ({ data: records.slice(from, to + 1), error: null }))).length, 1250);
    await assert.rejects(readReportPages(async () => ({ data: null, error: { message: "unavailable" } })), /unavailable/);
  });
});

describe("lifecycle rules", () => {
  it("claims a delivery once across concurrent dispatches and holds provider failures for review", async () => {
    const previous = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "re_test_placeholder";
    let requests = 0;
    const fetchMock = mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
      assert.ok(String(url).startsWith("https://api.resend.com/"));
      requests++;
      return new Response(JSON.stringify({ id: "test-delivery" }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    try {
      const outcomes = await Promise.all([
        deliverOnce("concurrent-test", "test@example.test", "Subject", "Body"),
        deliverOnce("concurrent-test", "test@example.test", "Subject", "Body"),
      ]);
      assert.deepEqual(outcomes.sort(), [false, true]);
      assert.equal(requests, 1);
      fetchMock.mock.mockImplementation(async () => new Response(JSON.stringify({ name: "validation_error", message: "Rejected" }), { status: 422, headers: { "Content-Type": "application/json" } }));
      await assert.rejects(deliverOnce("failed-test", "test@example.test", "Subject", "Body"));
      assert.equal(await deliverOnce("failed-test", "test@example.test", "Subject", "Body"), false);
    } finally {
      fetchMock.mock.restore();
      if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous;
    }
  });
  it("planning copy carries no dollar claims", () => {
    for (let stage = 1; stage <= 5; stage++) for (const lane of ["ducted", "ductless", "either"] as const) assert.ok(!planningEmail(stage, { lane }).body.includes("$"));
  });
  it("stock alerts require counted, positive stock and skip already-notified SKUs", () => {
    const candidate = { ...skus[0], category: "mini-splits" as const, btu: 12000, availabilityVerified: true, available: 3 };
    assert.equal(categoryAlertMatches([candidate], "mini-splits", 12000, new Set()).length, 1);
    assert.equal(categoryAlertMatches([{ ...candidate, availabilityVerified: false }], "mini-splits", null, new Set()).length, 0);
    assert.equal(categoryAlertMatches([candidate], "mini-splits", 18000, new Set()).length, 0);
    assert.equal(categoryAlertMatches([candidate], "mini-splits", null, new Set([candidate.id])).length, 0);
  });
  it("does not dispatch without consent, after withdrawal, or after an installer request", async () => {
    const email = "no-consent@example.test";
    await startPlanningSeries(email, "session", "homeowner_active");
    assert.equal((await dispatchPlanningSeries(40)).sent, 0);
    const consent = await recordMarketingConsent("withdrawn@example.test", "finder");
    await startPlanningSeries(consent.email, "session2", "homeowner_active");
    await withdrawByToken(consent.unsubscribeToken);
    assert.equal((await dispatchPlanningSeries(40)).sent, 0);
    await recordMarketingConsent("referred@example.test", "finder");
    await startPlanningSeries("referred@example.test", "session3", "homeowner_active");
    await stopPlanningSeries("referred@example.test", "requested_installer");
    assert.equal((await dispatchPlanningSeries(40)).sent, 0);
  });
  it("sends each consented planning stage once and stops mid-series on unsubscribe", async () => {
    const previous = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "re_test_placeholder";
    let requests = 0;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      requests++;
      return new Response(JSON.stringify({ id: "test-stage" }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    try {
      const consent = await recordMarketingConsent("planning-test@example.test", "finder");
      await startPlanningSeries(consent.email, "planning-session", "homeowner_active");
      assert.equal((await dispatchPlanningSeries(2)).sent, 1);
      assert.equal((await dispatchPlanningSeries(2)).sent, 0);
      assert.equal(requests, 1);
      await withdrawByToken(consent.unsubscribeToken);
      assert.equal((await dispatchPlanningSeries(40)).sent, 0);
      assert.equal(requests, 1);
    } finally {
      fetchMock.mock.restore();
      if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous;
    }
  });
});
