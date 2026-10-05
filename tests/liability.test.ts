import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { getStorefrontSku, getStorefrontSkus, type StorefrontSku } from "../src/lib/storefront/catalog";
import { isR410a } from "../src/lib/refrigerant-policy";
import { authorizationAction, reconcile, type IntentFacts, type OrderFacts } from "../src/lib/payments/reconcile";
import { creditDecision } from "../src/lib/payments/credit";
import { evaluateOrderCompliance, INSTALL_ACKNOWLEDGEMENT, isRefrigerantProduct, missingAcknowledgements, R410A_ATTESTATION } from "../src/lib/compliance/order-checks";
import { buildSnapshot } from "../src/lib/checkout-snapshot";
import { fulfilmentBlock, fulfilmentQueue } from "../src/lib/commerce/fulfilment-gate";
import { createScopedToken, verifyScopedToken } from "../src/lib/backend/order-token";
import { jobHealth } from "../src/lib/ops/job-health";
import { warrantyClaimSchema } from "../src/lib/forms/warranty";
import { privacyRequestSchema } from "../src/lib/forms/privacy";
import { checkoutSchema } from "../src/lib/backend/schemas";
import { daysSince, suggestedRefund } from "../src/lib/backend/returns";

/* docs/LIABILITY-REMEDIATION-PLAN.md: one describe per safeguard. */

const intent = (patch: Partial<IntentFacts>): IntentFacts => ({ id: "pi_1", status: "succeeded", amount: 10_000, amountReceived: 10_000, amountCapturable: 0, amountRefunded: 0, orderId: "o1", ...patch });
const order = (patch: Partial<OrderFacts>): OrderFacts => ({ id: "o1", orderNumber: "SO-1", checkoutState: "payment_pending", status: "pending", paid: false, total: 100, recordedPayments: 0, ...patch });

describe("1.2 payment reconciliation", () => {
  it("records a payment Stripe took that we missed, urgently when the order is dead", () => {
    assert.deepEqual(reconcile(intent({}), order({})), { kind: "record_payment", reason: "missed_success", urgent: false });
    assert.equal((reconcile(intent({}), order({ checkoutState: "expired", status: "cancelled" })) as { urgent: boolean }).urgent, true);
  });
  it("releases an authorization held for an order that is gone, and records one we missed", () => {
    assert.equal(reconcile(intent({ status: "requires_capture" }), order({ checkoutState: "expired" })).kind, "cancel_authorization");
    assert.equal(reconcile(intent({ status: "requires_capture" }), order({})).kind, "record_authorization");
    assert.equal(reconcile(intent({ status: "requires_capture" }), order({ checkoutState: "authorized" })).kind, "ok");
  });
  it("never treats a cancelled intent on a paid order as fine", () => {
    const action = reconcile(intent({ status: "canceled" }), order({ paid: true, checkoutState: "paid", recordedPayments: 100 }));
    assert.equal(action.kind === "alert" && action.reason, "paid_without_charge");
  });
  it("flags refunds and amounts that don't match the ledger", () => {
    const refunded = reconcile(intent({ amountRefunded: 5_000 }), order({ paid: true, checkoutState: "paid", recordedPayments: 100 }));
    assert.equal(refunded.kind === "alert" && refunded.reason, "refund_not_recorded");
    const short = reconcile(intent({ amountReceived: 9_000 }), order({ paid: true, checkoutState: "paid", recordedPayments: 90 }));
    assert.equal(short.kind === "alert" && short.reason, "amount_mismatch");
    assert.equal(reconcile(intent({}), order({ paid: true, checkoutState: "paid", recordedPayments: 100 })).kind, "ok");
  });
  it("alerts on money with no order", () => {
    assert.equal(reconcile(intent({}), null).kind, "alert");
    assert.equal(reconcile(intent({ status: "canceled" }), null).kind, "ok");
  });
});

describe("1.1 authorization deadline", () => {
  const authorizedAt = "2026-10-01T12:00:00Z";
  it("waits, then alerts after 72 hours, then releases a day before the hold lapses", () => {
    assert.equal(authorizationAction(authorizedAt, null, new Date("2026-10-02T12:00:00Z")), "none");
    assert.equal(authorizationAction(authorizedAt, null, new Date("2026-10-04T13:00:00Z")), "alert");
    assert.equal(authorizationAction(authorizedAt, null, new Date("2026-10-07T13:00:00Z")), "cancel");
    assert.equal(authorizationAction(authorizedAt, "2026-10-03T12:00:00Z", new Date("2026-10-02T13:00:00Z")), "cancel");
    assert.equal(authorizationAction(null, null, new Date()), "none");
  });
});

describe("1.6 contractor credit limits", () => {
  it("holds a net-terms order when no limit is set: no limit is not unlimited credit", () => {
    const decision = creditDecision({ creditLimit: null, openInvoiceBalance: 0, uninvoicedOrders: 0 }, 500);
    assert.equal(decision.ok, false);
    assert.equal(!decision.ok && decision.reason, "no_limit");
    assert.equal(!decision.ok && decision.action, "hold");
  });
  it("counts open invoices and uninvoiced orders against the limit", () => {
    assert.equal(creditDecision({ creditLimit: 5000, openInvoiceBalance: 3000, uninvoicedOrders: 1000 }, 900).ok, true);
    const over = creditDecision({ creditLimit: 5000, openInvoiceBalance: 3000, uninvoicedOrders: 1000 }, 1500);
    assert.equal(!over.ok && over.reason, "over_limit");
    assert.equal(over.exposure, 5500);
  });
});

describe("Phase 3 order compliance", () => {
  const r410a = getStorefrontSkus().find((sku) => isR410a(sku.refrigerant))!;
  const r32 = { ...getStorefrontSku("TCL09KIDU")!, refrigerant: "R-32" };
  const supply = getStorefrontSkus().find((sku) => sku.category === "installation-supplies")!;

  it("keeps R-410A from guests and homeowners while California rules are unconfirmed", () => {
    const result = evaluateOrderCompliance([r410a], { trade: false, epa608OnFile: false });
    assert.equal(result.restricted.get(r410a.id)?.code, "r410a_contractor_only");
  });
  it("lets an approved contractor order R-410A with an attestation", () => {
    const result = evaluateOrderCompliance([r410a], { trade: true, epa608OnFile: false });
    assert.equal(result.restricted.size, 0);
    assert.deepEqual(result.acknowledgements.map((ack) => ack.id).sort(), ["install", "r410a"]);
  });
  it("asks for the licensed-install acknowledgement on equipment, not supplies", () => {
    assert.deepEqual(evaluateOrderCompliance([r32], { trade: false, epa608OnFile: false }).acknowledgements, [INSTALL_ACKNOWLEDGEMENT]);
    assert.deepEqual(evaluateOrderCompliance([supply], { trade: false, epa608OnFile: false }).acknowledgements, []);
  });
  it("holds a homeowner order for equipment below the California minimum", () => {
    const belowMinimum = { ...r32, category: "central-air-conditioners" as const, btu: 36000, specifications: { seer2: 10, eer2: 8 }, ahri: null } as unknown as StorefrontSku;
    const homeowner = evaluateOrderCompliance([belowMinimum], { trade: false, epa608OnFile: false });
    assert.equal(homeowner.hold, true);
    assert.equal(evaluateOrderCompliance([belowMinimum], { trade: true, epa608OnFile: false }).hold, false);
  });
  it("sells refrigerant only to trade accounts with EPA 608 on file", () => {
    const cylinder = { ...supply, id: "cyl", title: "R-410A Refrigerant 25 lb cylinder" };
    assert.equal(isRefrigerantProduct(cylinder), true);
    assert.equal(evaluateOrderCompliance([cylinder], { trade: true, epa608OnFile: false }).restricted.get("cyl")?.code, "refrigerant_needs_epa608");
    assert.equal(evaluateOrderCompliance([cylinder], { trade: true, epa608OnFile: true }).restricted.size, 0);
  });
  it("classifies no current catalog record as refrigerant (the first one added is noticed)", () => {
    assert.deepEqual(getStorefrontSkus().filter((sku) => isRefrigerantProduct(sku)).map((sku) => sku.sku), []);
  });
  it("requires each acknowledgement in the version that was shown", () => {
    assert.equal(missingAcknowledgements([INSTALL_ACKNOWLEDGEMENT, R410A_ATTESTATION], [INSTALL_ACKNOWLEDGEMENT.version]).length, 1);
    assert.equal(missingAcknowledgements([INSTALL_ACKNOWLEDGEMENT], ["install-old-version"]).length, 1);
    assert.equal(missingAcknowledgements([INSTALL_ACKNOWLEDGEMENT], [INSTALL_ACKNOWLEDGEMENT.version]).length, 0);
  });
  it("turns a restricted line into a checkout line error and puts the acknowledgements on the snapshot", () => {
    const sellable = { ...r410a, availabilityVerified: true, availabilityStatus: "in_stock", available: 3, purchaseEligible: true } as StorefrontSku;
    const build = (account: Parameters<typeof buildSnapshot>[0]["account"]) =>
      buildSnapshot({ items: [{ skuId: sellable.id, qty: 1 }], method: "pickup", zip: "94560", resolveSku: () => sellable, account, pricing: null, deliveryFee: () => null, now: new Date("2026-10-01T17:00:00Z") });
    assert.equal(build({ kind: "anonymous" }).lines[0].error?.code, "restricted");
    const trade = buildSnapshot({ items: [{ skuId: sellable.id, qty: 1 }], method: "pickup", zip: "94560", resolveSku: () => sellable, account: { kind: "tradeApproved", accountId: "a1", tierLabel: "Pro" }, pricing: { status: "ok", prices: new Map([[sellable.id, 400]]) }, deliveryFee: () => null, now: new Date("2026-10-01T17:00:00Z") });
    assert.equal(trade.lines[0].error, null);
    assert.deepEqual(trade.acknowledgements.map((ack) => ack.id).sort(), ["install", "r410a"]);
  });
});

describe("pay before you ship (fulfilment gate)", () => {
  const base = { status: "pending", paid: false, payment_mode: "card", checkout_state: "payment_pending", hold_reason: null, fulfillment_status: "pending" };
  it("keeps unpaid, authorized-only and held orders out of the ready queue", () => {
    assert.equal(fulfilmentQueue(base), "awaiting_payment");
    assert.equal(fulfilmentQueue({ ...base, checkout_state: "authorized" }), "capture");
    assert.equal(fulfilmentQueue({ ...base, paid: true, checkout_state: "paid", hold_reason: "compliance_review" }), "hold");
    assert.equal(fulfilmentQueue({ ...base, paid: true, checkout_state: "paid" }), "ready");
    assert.equal(fulfilmentQueue({ ...base, payment_mode: "net_terms", checkout_state: "confirmed" }), "ready");
    assert.notEqual(fulfilmentBlock({ ...base, status: "cancelled", paid: true, checkout_state: "paid" }), null);
  });
  it("is enforced in the database too (migration 043)", () => {
    const sql = readFileSync("supabase/migrations/043_fulfilment_gates.sql", "utf8");
    assert.match(sql, /v_block := order_fulfilment_block\(p_order_id\)/);
    assert.match(sql, /Record who collected the order and confirm you checked their ID/);
    assert.match(sql, /revoke execute on function public\.cancel_unshipped_order\(uuid, text\) from public, anon, authenticated/);
  });
});

describe("signed links (guest returns, privacy confirmation)", () => {
  it("accepts its own token and rejects another purpose, a tampered one or an expired one", () => {
    const now = Date.UTC(2026, 9, 5);
    const token = createScopedToken("guest-return", "order-1", 60_000, now);
    assert.equal(verifyScopedToken("guest-return", token, now), "order-1");
    assert.equal(verifyScopedToken("privacy-verify", token, now), null);
    assert.equal(verifyScopedToken("guest-return", token.replace(/.$/, (c) => (c === "A" ? "B" : "A")), now), null);
    assert.equal(verifyScopedToken("guest-return", token, now + 61_000), null);
  });
});

describe("returns helpers", () => {
  it("uses the recorded delivery date and the draft restocking fee", () => {
    assert.equal(daysSince("2026-10-01T00:00:00Z", new Date("2026-10-05T12:00:00Z")), 4);
    assert.equal(daysSince(null), null);
    assert.equal(suggestedRefund(100, 2, "full_refund"), 200);
    assert.equal(suggestedRefund(100, 2, "refund_less_restocking"), 170);
  });
});

describe("7.1 job health", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  it("reports a job that never ran or stopped running", () => {
    const health = jobHealth([{ job: "payment-safety", lastRunAt: "2026-10-05T11:50:00Z", lastStatus: "ok" }, { job: "lifecycle-dispatch", lastRunAt: "2026-10-05T06:00:00Z", lastStatus: "ok" }], now);
    assert.equal(health.find((job) => job.job === "payment-safety")?.state, "ok");
    assert.equal(health.find((job) => job.job === "lifecycle-dispatch")?.state, "stale");
    assert.equal(health.find((job) => job.job === "quickbooks-sync")?.state, "never_ran");
  });
  it("reports a job that runs but fails", () => {
    assert.equal(jobHealth([{ job: "payment-safety", lastRunAt: "2026-10-05T11:55:00Z", lastStatus: "error" }], now)[0].state, "failing");
  });
});

describe("intake forms are bounded and validated", () => {
  it("warranty claims need the unit's model and serial and a description", () => {
    const valid = { name: "Pat Lee", email: "pat@example.com", phone: "510 555 0100", productDescription: "Mini split", modelNumber: "TCL24", serialNumber: "SN12345", issue: "Blinking E1 code, no cooling" };
    assert.equal(warrantyClaimSchema.safeParse(valid).success, true);
    assert.equal(warrantyClaimSchema.safeParse({ ...valid, serialNumber: "" }).success, false);
    assert.equal(warrantyClaimSchema.safeParse({ ...valid, issue: "x".repeat(5001) }).success, false);
  });
  it("privacy requests take know, delete or correct", () => {
    assert.equal(privacyRequestSchema.safeParse({ kind: "delete", email: "pat@example.com" }).success, true);
    assert.equal(privacyRequestSchema.safeParse({ kind: "sell", email: "pat@example.com" }).success, false);
  });
  it("checkout rejects oversized fields (QA-011)", () => {
    const order = { idempotencyKey: crypto.randomUUID(), items: [{ skuId: "a", sku: "A", modelNumber: "A", title: "A", qty: 1 }], method: "pickup", window: "w", buyerName: "Pat Lee", buyerEmail: "pat@example.com", phone: "5105550100" };
    assert.equal(checkoutSchema.safeParse(order).success, true);
    assert.equal(checkoutSchema.safeParse({ ...order, address: "x".repeat(501) }).success, false);
    assert.equal(checkoutSchema.safeParse({ ...order, items: Array.from({ length: 101 }, () => order.items[0]) }).success, false);
  });
});

describe("privacy and payment SQL", () => {
  it("erases only on a verified deletion request, and matches emails exactly", () => {
    const erase = readFileSync("supabase/migrations/044_privacy_operations.sql", "utf8");
    assert.match(erase, /kind = 'delete' and verified_at is not null/);
    assert.match(erase, /p_dry_run boolean default true/);
    const report = readFileSync("supabase/migrations/045_privacy_report.sql", "utf8").replace(/--.*$/gm, "");
    assert.doesNotMatch(report, /ilike/i);
    assert.match(report, /lower\(btrim\(p_email\)\)/);
  });
  it("records a late payment as held, not paid (migration 039)", () => {
    const sql = readFileSync("supabase/migrations/039_liability_safeguards.sql", "utf8");
    assert.match(sql, /paid_needs_review/);
    assert.match(sql, /paid_after_cancellation/);
  });
});
