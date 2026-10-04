import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPeople, filterPeople, normalizeEmail, peopleKpis, personId, type CrmRows } from "../src/lib/crm/people";
import { DEMO_CRM_ROWS } from "../src/lib/crm/demo-rows";

const NOW = new Date("2026-10-04T18:00:00Z");
const empty: CrmRows = {
  profiles: [], accounts: [], contacts: [], quoteRequests: [], contactRequests: [], homeownerRequests: [], dealerApplications: [],
  orders: [], orderLines: [], carts: [], stockAlerts: [], categoryAlerts: [], finderSessions: [], consents: [], emails: [],
};
const people = buildPeople(DEMO_CRM_ROWS, NOW);
const byEmail = (email: string) => people.find((person) => person.email === email)!;

describe("customer view: identity", () => {
  it("merges every table into one person per email, case-insensitively", () => {
    const rows: CrmRows = {
      ...empty,
      quoteRequests: [{ id: "q", reference: "Q-1", name: "Ann", email: "Ann@Example.com ", phone: null, need: "x", lifecycle: "received", status: "new", project_type: null, zip: null, account_id: null, created_at: "2026-10-01T00:00:00Z" }],
      stockAlerts: [{ email: "ann@example.com", sku_code: "TCL24KODU", created_at: "2026-10-02T00:00:00Z", notified_at: null, unsubscribed: false }],
    };
    const result = buildPeople(rows, NOW);
    assert.equal(result.length, 1);
    assert.equal(result[0].email, "ann@example.com");
    assert.equal(result[0].requests.length, 1);
    assert.ok(result[0].interests.includes("TCL24KODU"));
  });

  it("never puts the email in the id", () => {
    assert.equal(normalizeEmail("  X@Y.com"), "x@y.com");
    assert.equal(normalizeEmail("not-an-email"), null);
    assert.ok(!personId("ann@example.com").includes("@"));
    assert.equal(personId("ANN@example.com"), personId("ann@example.com"));
  });
});

describe("customer view: persona and stage", () => {
  it("classifies from the strongest signal and says why", () => {
    assert.equal(byEmail("maria@bayheat.example.com").persona, "contractor");
    assert.equal(byEmail("dana@coastalcomfort.example.com").persona, "contractor_applicant");
    assert.equal(byEmail("priya.shah@example.com").persona, "homeowner");
    assert.equal(byEmail("lee.wong@example.com").persona, "homeowner");
    assert.equal(byEmail("sam.ortiz@example.com").persona, "shopper");
    assert.equal(byEmail("counter@example.com").persona, "staff");
    assert.match(byEmail("maria@bayheat.example.com").personaReason, /Bay Heat & Air/);
  });

  it("is a customer only with a paid order", () => {
    assert.equal(byEmail("jin.park@example.com").stage, "customer");
    assert.equal(byEmail("priya.shah@example.com").stage, "lead");
    assert.equal(byEmail("jin.park@example.com").lifetimeValue, 1450);
  });

  it("tracks marketing consent, including withdrawal", () => {
    assert.equal(byEmail("priya.shah@example.com").marketing, "subscribed");
    assert.equal(byEmail("sam.ortiz@example.com").marketing, "withdrawn");
    assert.equal(byEmail("jin.park@example.com").marketing, "none");
  });
});

describe("customer view: orders and emails", () => {
  it("attaches orders with their lines", () => {
    const maria = byEmail("maria@bayheat.example.com");
    assert.equal(maria.orders.length, 1);
    assert.equal(maria.orders[0].lines.length, 2);
  });

  it("combines logged sends with sends recorded only as flags, without double counting", () => {
    const jin = byEmail("jin.park@example.com");
    // Logged confirmation and the order's confirmation flag are the same email.
    assert.equal(jin.emails.filter((email) => email.kind === "order_confirmation").length, 1);
    assert.equal(jin.emails[0].source, "log");
    const maria = byEmail("maria@bayheat.example.com");
    assert.deepEqual(new Set(maria.emails.map((email) => email.kind)), new Set(["order_confirmation", "review_request", "warranty"]));
    assert.ok(maria.emails.every((email) => email.source === "reconstructed"));
    assert.ok(byEmail("sam.ortiz@example.com").emails.some((email) => email.kind === "abandoned_cart"));
  });
});

describe("customer view: follow-ups", () => {
  it("flags open requests, abandoned carts and finished-finder homeowners", () => {
    assert.ok(byEmail("maria@bayheat.example.com").followUps.some((item) => item.reason.includes("Q-1042") && item.priority === "high"));
    assert.ok(byEmail("sam.ortiz@example.com").followUps.some((item) => item.reason.includes("cart")));
    assert.ok(byEmail("lee.wong@example.com").followUps.some((item) => item.reason.includes("finder")));
    assert.ok(byEmail("jin.park@example.com").followUps.some((item) => item.reason.includes("C-2207")));
    // Priya asked for installer help, so finishing the finder is not an open loop.
    assert.ok(!byEmail("priya.shah@example.com").followUps.some((item) => item.reason.includes("finder")));
  });

  it("puts urgent people first and hides staff", () => {
    const list = filterPeople(people, {});
    assert.ok(!list.some((person) => person.persona === "staff"));
    assert.ok(list[0].followUps.some((item) => item.priority === "high"));
    // Priya and Lee from the finder and request, Jin from a retail account.
    assert.equal(filterPeople(people, { persona: "homeowner" }).length, 3);
    assert.equal(filterPeople(people, { q: "bay heat" })[0].email, "maria@bayheat.example.com");
    assert.equal(peopleKpis(people).people, list.length);
  });
});
