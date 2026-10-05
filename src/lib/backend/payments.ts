import "server-only";
import type Stripe from "stripe";
import { createServiceRoleSupabaseClient } from "./supabase";
import { getStripe } from "./stripe";
import { sendEmail, sendRequiredEmail } from "./email";
import { emailShell } from "./lifecycle";
import { raiseStaffAlert, recordHeartbeat, resolveStaffAlert } from "./alerts";
import { authorizationAction, reconcile, type IntentFacts, type OrderFacts } from "@/lib/payments/reconcile";
import { SITE } from "@/lib/site";
import { alertOnPrivacyDeadlines } from "./privacy-requests";

/**
 * Money safety (docs/LIABILITY-REMEDIATION-PLAN.md, phase 1).
 *
 * Card checkout authorizes; it does not charge. The counter confirms the stock
 * is physically there, and only then is the payment captured -- so nobody is
 * charged for a unit the counter sold an hour earlier. Around that:
 *
 *  - reconcilePayments: Stripe vs our records every run; repairs what is safe,
 *    alerts on the rest.
 *  - expireStaleCheckouts: abandoned checkouts release their stock, and their
 *    PaymentIntents are cancelled first so a late payment cannot land.
 *  - enforceAuthorizationDeadlines: an authorization nobody confirmed alerts
 *    after 3 days and is released before the card network drops it.
 *  - sendPendingConfirmations: every order gets a confirmation email, retried.
 *
 * Staff actions (capture, cancel, release hold, refund) live here too, so every
 * money movement goes through one audited place.
 */

export class PaymentActionError extends Error {}

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? SITE.origin;

function db() {
  const client = createServiceRoleSupabaseClient();
  if (!client) throw new PaymentActionError("The database is not configured on this server.");
  return client;
}

async function audit(event: string, orderId: string, by: string | null) {
  try {
    await db().from("activity_log").insert({ actor_profile_id: by || null, event, entity_type: "sales_orders", entity_id: orderId });
  } catch {
    /* the audit line is best effort; the money action already happened */
  }
}

type OrderRow = {
  id: string;
  order_number: string;
  checkout_state: string;
  status: string;
  paid: boolean;
  total: number | string;
  payment_intent_id: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
  fulfillment_method: string | null;
  authorized_at: string | null;
  authorization_expires_at: string | null;
  hold_reason: string | null;
  payment_mode: string | null;
};

const ORDER_COLUMNS =
  "id, order_number, checkout_state, status, paid, total, payment_intent_id, buyer_email, buyer_name, fulfillment_method, authorized_at, authorization_expires_at, hold_reason, payment_mode";

async function loadOrder(orderId: string): Promise<OrderRow> {
  const { data, error } = await db().from("sales_orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle();
  if (error || !data) throw new PaymentActionError("Order not found.");
  return data as OrderRow;
}

async function customerEmail(order: OrderRow, subject: string, body: string) {
  if (!order.buyer_email) return;
  await sendEmail(order.buyer_email, subject, emailShell(body), { kind: "order_update", relatedType: "order", relatedId: order.id });
}

/* Staff actions ---------------------------------------------------------------------------- */

/** The counter has the stock: charge the authorized card. */
export async function captureAuthorizedOrder(orderId: string, staff: { userId: string; name: string }): Promise<void> {
  const order = await loadOrder(orderId);
  if (order.checkout_state !== "authorized") throw new PaymentActionError(`Order ${order.order_number} is not waiting for capture (${order.checkout_state}).`);
  if (order.hold_reason) throw new PaymentActionError(`Order ${order.order_number} is on hold (${order.hold_reason}). Release the hold before charging.`);
  if (!order.payment_intent_id) throw new PaymentActionError("This order has no card authorization on file.");
  const stripe = getStripe();
  if (!stripe) throw new PaymentActionError("Stripe is not configured on this server.");

  const intent = await stripe.paymentIntents.capture(order.payment_intent_id, undefined, { idempotencyKey: `capture-${order.id}` });
  if (intent.status !== "succeeded") throw new PaymentActionError(`Stripe did not capture the payment (${intent.status}).`);
  // Record now for the counter's screen; the webhook's later call is a no-op
  // because mark_order_paid ignores an order that is already paid.
  const { error } = await db().rpc("mark_order_paid", { p_order_id: order.id, p_amount: intent.amount_received / 100, p_stripe_event_id: `capture:${intent.id}` });
  if (error) {
    await raiseStaffAlert({ kind: "payment_reconciliation", dedupeKey: `capture-record:${order.id}`, subject: `Captured ${order.order_number} but could not record it`, body: `Stripe captured ${usd(intent.amount_received / 100)} for ${order.order_number}, but the database update failed: ${error.message}. The next reconciliation run will retry.`, severity: "urgent", relatedType: "order", relatedId: order.id });
  }
  await audit("payment_captured", order.id, staff.userId);
  await resolveStaffAlert(`auth-expiring:${order.id}`, staff.name);
  await customerEmail(
    order,
    `Order ${order.order_number} confirmed`,
    `<h2 style="font-size:20px;margin:8px 0">Your order ${escape(order.order_number)} is confirmed.</h2>
     <p style="line-height:1.6">We checked the stock and your card was charged ${usd(intent.amount_received / 100)}.</p>
     <p style="line-height:1.6">${order.fulfillment_method === "pickup" ? "We'll email you when it's ready for pickup. Bring photo ID; the order is released to the name on it." : "We'll email you when it's on its way."}</p>`
  );
}

/** The counter cannot fulfil: release the card hold. The customer is not charged. */
export async function cancelAuthorizedOrder(orderId: string, staff: { userId: string; name: string }, reason: string): Promise<void> {
  const order = await loadOrder(orderId);
  if (order.checkout_state !== "authorized" && order.checkout_state !== "payment_pending") {
    throw new PaymentActionError(`Order ${order.order_number} cannot be released from state ${order.checkout_state}. Use a refund for a paid order.`);
  }
  const stripe = getStripe();
  if (order.payment_intent_id && stripe) {
    const intent = await stripe.paymentIntents.retrieve(order.payment_intent_id);
    if (intent.status === "succeeded") throw new PaymentActionError("Stripe shows this payment as captured. Refund it instead.");
    if (intent.status !== "canceled") await stripe.paymentIntents.cancel(order.payment_intent_id, { cancellation_reason: "abandoned" });
  }
  const { error } = await db().rpc("release_checkout_order", { p_order_id: order.id, p_state: "payment_failed" });
  if (error) throw new PaymentActionError(`Released the card hold but could not cancel the order: ${error.message}`);
  await audit("authorization_cancelled", order.id, staff.userId);
  await resolveStaffAlert(`auth-expiring:${order.id}`, staff.name);
  await customerEmail(
    order,
    `We couldn't fulfil order ${order.order_number}`,
    `<h2 style="font-size:20px;margin:8px 0">We couldn't fulfil order ${escape(order.order_number)}.</h2>
     <p style="line-height:1.6">${escape(reason)}</p>
     <p style="line-height:1.6"><strong>Your card was not charged.</strong> The temporary hold has been released; your bank may take a few days to remove it from your statement.</p>
     <p style="line-height:1.6">Call or text ${SITE.phone} and the counter will help you find an alternative.</p>`
  );
}

/** A named staff member decides a held order may proceed. */
export async function releaseOrderHold(orderId: string, staff: { userId: string; name: string }, note: string): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order.hold_reason) throw new PaymentActionError("This order is not on hold.");
  const patch: Record<string, unknown> = { hold_reason: null, hold_detail: null, hold_released_by: `${staff.name}: ${note}`.slice(0, 300), hold_released_at: new Date().toISOString() };
  // A late payment the counter has decided to fulfil becomes a normal paid
  // order. Catalog stock lives in QuickBooks, not in database reservations, so
  // releasing it IS the counter's confirmation that the unit is on the shelf;
  // the admin asks for exactly that before calling this.
  if (order.checkout_state === "paid_needs_review") Object.assign(patch, { checkout_state: "paid", status: "pending", fulfillment_status: "pending" });
  const { error } = await db().from("sales_orders").update(patch).eq("id", order.id);
  if (error) throw new PaymentActionError(error.message);
  await audit(`hold_released:${order.hold_reason}`, order.id, staff.userId);
  await resolveStaffAlert(`hold:${order.id}`, staff.name);
  await resolveStaffAlert(`paid-review:${order.id}`, staff.name);
  // Holds raised by a ShipStation ship notice (migration 042) key their alert by reason.
  await resolveStaffAlert(`${order.hold_reason}:${order.id}`, staff.name);
}

/**
 * Cancel an order that has not shipped. A card authorization is released
 * through Stripe; an unpaid net-terms or freight order is cancelled in the
 * database. A captured payment is never cancelled here: refund it.
 */
export async function cancelOrder(orderId: string, staff: { userId: string; name: string }, reason: string): Promise<void> {
  const order = await loadOrder(orderId);
  if (order.checkout_state === "authorized" || order.checkout_state === "payment_pending" || order.checkout_state === "checkout_started") {
    await cancelAuthorizedOrder(orderId, staff, reason);
  } else {
    if (order.paid) throw new PaymentActionError("This order has a captured payment. Refund it instead.");
    const { error } = await db().rpc("cancel_unshipped_order", { p_order_id: order.id, p_reason: `${staff.name}: ${reason}`.slice(0, 300) });
    if (error) throw new PaymentActionError(error.message);
    await audit("order_cancelled", order.id, staff.userId);
    await customerEmail(
      order,
      `Order ${order.order_number} has been cancelled`,
      `<h2 style="font-size:20px;margin:8px 0">We've cancelled order ${escape(order.order_number)}.</h2>
       <p style="line-height:1.6">${escape(reason)}</p>
       <p style="line-height:1.6">Nothing was charged. Call or text ${SITE.phone} if you have questions or want to arrange it another way.</p>`
    );
  }
  await resolveStaffAlert(`hold:${order.id}`, staff.name);
}

/** A held, paid order the counter will not fulfil: refund in full and close the hold. */
export async function refundHeldOrder(orderId: string, staff: { userId: string; name: string }, reason: string): Promise<{ refundId: string }> {
  const order = await loadOrder(orderId);
  if (!order.hold_reason) throw new PaymentActionError("This order is not on hold.");
  const result = await refundOrder(orderId, Number(order.total), staff, { reason });
  await db()
    .from("sales_orders")
    .update({ hold_reason: null, hold_released_by: `${staff.name}: refunded. ${reason}`.slice(0, 300), hold_released_at: new Date().toISOString(), status: "cancelled", fulfillment_status: "cancelled" })
    .eq("id", order.id);
  await resolveStaffAlert(`hold:${order.id}`, staff.name);
  await resolveStaffAlert(`paid-review:${order.id}`, staff.name);
  return result;
}

/**
 * Refund through Stripe, tied to the order (and RMA, when there is one). The
 * refund webhook records the reversal; reconciliation catches it if not.
 */
export async function refundOrder(
  orderId: string,
  amountDollars: number,
  staff: { userId: string; name: string },
  context: { reason: string; rmaNumber?: string | null }
): Promise<{ refundId: string }> {
  const order = await loadOrder(orderId);
  if (!order.paid || !order.payment_intent_id) throw new PaymentActionError("Only card-paid orders can be refunded here. Record other refunds manually.");
  if (!(amountDollars > 0) || amountDollars > Number(order.total) + 0.001) throw new PaymentActionError("The refund must be more than zero and no more than the order total.");
  const stripe = getStripe();
  if (!stripe) throw new PaymentActionError("Stripe is not configured on this server.");
  const refund = await stripe.refunds.create(
    {
      payment_intent: order.payment_intent_id,
      amount: Math.round(amountDollars * 100),
      reason: "requested_by_customer",
      metadata: { order_id: order.id, order_number: order.order_number, rma_number: context.rmaNumber ?? "", staff: staff.name, note: context.reason.slice(0, 200) },
    },
    { idempotencyKey: `refund-${order.id}-${context.rmaNumber ?? "manual"}-${Math.round(amountDollars * 100)}` }
  );
  await audit(`refund:${refund.id}`, order.id, staff.userId);
  await customerEmail(
    order,
    `Refund for order ${order.order_number}`,
    `<h2 style="font-size:20px;margin:8px 0">We've refunded ${usd(amountDollars)}.</h2>
     <p style="line-height:1.6">For order ${escape(order.order_number)}${context.rmaNumber ? `, return ${escape(context.rmaNumber)}` : ""}. It goes back to the card you paid with; banks usually show it within 5–10 business days.</p>`
  );
  return { refundId: refund.id };
}

/* Background jobs ---------------------------------------------------------------------------- */

function intentFacts(intent: Stripe.PaymentIntent): IntentFacts {
  const charge = typeof intent.latest_charge === "object" && intent.latest_charge ? intent.latest_charge : null;
  return {
    id: intent.id,
    status: intent.status,
    amount: intent.amount,
    amountReceived: intent.amount_received,
    amountCapturable: intent.amount_capturable,
    amountRefunded: charge?.amount_refunded ?? 0,
    orderId: intent.metadata?.order_id || null,
  };
}

export type ReconcileSummary = { checked: number; fixed: number; issues: Array<{ intent: string; order: string | null; action: string; detail?: string }>; skipped?: string };

export async function reconcilePayments(now = new Date(), lookbackDays = 7): Promise<ReconcileSummary> {
  const stripe = getStripe();
  const client = createServiceRoleSupabaseClient();
  if (!stripe || !client) return { checked: 0, fixed: 0, issues: [], skipped: "Stripe or Supabase not configured" };
  const { data: run } = await client.from("payment_reconciliation_runs").insert({}).select("id").single();
  const summary: ReconcileSummary = { checked: 0, fixed: 0, issues: [] };

  try {
    const intents: Stripe.PaymentIntent[] = [];
    for await (const intent of stripe.paymentIntents.list({ created: { gte: Math.floor(now.getTime() / 1000) - lookbackDays * 86_400 }, limit: 100, expand: ["data.latest_charge"] })) {
      if (intent.metadata?.order_id) intents.push(intent);
      if (intents.length >= 2000) break;
    }
    const orderIds = Array.from(new Set(intents.map((intent) => intent.metadata.order_id)));
    const orders = new Map<string, OrderFacts>();
    for (let index = 0; index < orderIds.length; index += 200) {
      const batch = orderIds.slice(index, index + 200);
      const { data } = await client.from("sales_orders").select("id, order_number, checkout_state, status, paid, total").in("id", batch);
      const { data: payments } = await client.from("order_payments").select("order_id, amount").in("order_id", batch);
      for (const row of data ?? []) {
        const recorded = (payments ?? []).filter((payment) => payment.order_id === row.id).reduce((sum, payment) => sum + Number(payment.amount), 0);
        orders.set(row.id, { id: row.id, orderNumber: row.order_number, checkoutState: row.checkout_state, status: row.status, paid: Boolean(row.paid), total: Number(row.total), recordedPayments: recorded });
      }
    }

    for (const intent of intents) {
      summary.checked += 1;
      const facts = intentFacts(intent);
      const order = facts.orderId ? orders.get(facts.orderId) ?? null : null;
      const action = reconcile(facts, order);
      if (action.kind === "ok") continue;
      const label = order?.orderNumber ?? facts.orderId ?? intent.id;

      if (action.kind === "record_payment") {
        const { error } = await client.rpc("mark_order_paid", { p_order_id: order!.id, p_amount: facts.amountReceived / 100, p_stripe_event_id: `reconcile:${intent.id}` });
        if (!error) summary.fixed += 1;
        summary.issues.push({ intent: intent.id, order: label, action: action.reason });
        await raiseStaffAlert({
          kind: action.urgent ? "paid_needs_review" : "payment_reconciliation",
          dedupeKey: `reconcile-paid:${intent.id}`,
          subject: action.urgent ? `Paid order ${label} was cancelled: re-reserve or refund` : `Recorded a missed payment for ${label}`,
          body: action.urgent
            ? `Stripe received ${usd(facts.amountReceived / 100)} for ${label}, which had already been cancelled or expired. It is held as "paid, needs review". Re-reserve the stock and fulfil, or refund.`
            : `Stripe received ${usd(facts.amountReceived / 100)} for ${label}, but our records did not show it (the payment webhook may be failing). It has now been recorded. Check the Stripe webhook.`,
          severity: action.urgent ? "urgent" : "normal",
          relatedType: "order",
          relatedId: order!.id,
        });
      } else if (action.kind === "record_authorization") {
        const { error } = await client.rpc("mark_order_authorized", { p_order_id: order!.id, p_amount: facts.amountCapturable / 100, p_stripe_event_id: `reconcile:${intent.id}`, p_expires_at: null });
        if (!error) summary.fixed += 1;
        summary.issues.push({ intent: intent.id, order: label, action: action.reason });
        await raiseStaffAlert({ kind: "payment_reconciliation", dedupeKey: `reconcile-auth:${intent.id}`, subject: `Recorded a missed card authorization for ${label}`, body: `${label} was authorized in Stripe but still showed "payment pending". It now waits for stock confirmation. Check the Stripe webhook.`, relatedType: "order", relatedId: order!.id });
      } else if (action.kind === "cancel_authorization") {
        await stripe.paymentIntents.cancel(intent.id, { cancellation_reason: "abandoned" }).catch(() => null);
        summary.fixed += 1;
        summary.issues.push({ intent: intent.id, order: label, action: action.reason });
      } else if (action.kind === "release_order") {
        const { error } = await client.rpc("release_checkout_order", { p_order_id: order!.id, p_state: "payment_failed" });
        if (!error) summary.fixed += 1;
        summary.issues.push({ intent: intent.id, order: label, action: action.reason });
      } else {
        summary.issues.push({ intent: intent.id, order: label, action: action.reason, detail: action.detail });
        await raiseStaffAlert({ kind: "payment_reconciliation", dedupeKey: `reconcile-${action.reason}:${intent.id}`, subject: `Payment mismatch: ${label}`, body: action.detail, severity: "urgent", relatedType: "order", relatedId: order?.id });
      }
    }
    if (run) await client.from("payment_reconciliation_runs").update({ finished_at: new Date().toISOString(), checked: summary.checked, fixed: summary.fixed, issues: summary.issues }).eq("id", run.id);
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (run) await client.from("payment_reconciliation_runs").update({ finished_at: new Date().toISOString(), error: message }).eq("id", run.id);
    await raiseStaffAlert({ kind: "job_failure", dedupeKey: `reconcile-failed:${now.toISOString().slice(0, 13)}`, subject: "Payment reconciliation failed", body: message, severity: "urgent" });
    throw error;
  }
}

/**
 * Release abandoned checkouts. Each PaymentIntent is settled with Stripe first:
 * one that succeeded or was authorized in the meantime is recorded, not
 * expired; anything else is cancelled so it can no longer be paid.
 */
export async function expireStaleCheckouts(now = new Date()): Promise<{ expired: number; rescued: number }> {
  const client = createServiceRoleSupabaseClient();
  if (!client) return { expired: 0, rescued: 0 };
  const stripe = getStripe();
  let rescued = 0;
  const { data: stale } = await client
    .from("sales_orders")
    .select("id, payment_intent_id")
    .eq("checkout_state", "payment_pending")
    .eq("paid", false)
    .lte("reservation_expires_at", now.toISOString())
    .limit(200);
  for (const order of stale ?? []) {
    if (!order.payment_intent_id || !stripe) continue;
    try {
      const intent = await stripe.paymentIntents.retrieve(order.payment_intent_id);
      if (intent.status === "succeeded") {
        await client.rpc("mark_order_paid", { p_order_id: order.id, p_amount: intent.amount_received / 100, p_stripe_event_id: `expiry:${intent.id}` });
        rescued += 1;
      } else if (intent.status === "requires_capture") {
        await client.rpc("mark_order_authorized", { p_order_id: order.id, p_amount: intent.amount_capturable / 100, p_stripe_event_id: `expiry:${intent.id}`, p_expires_at: null });
        rescued += 1;
      } else if (intent.status !== "canceled") {
        await stripe.paymentIntents.cancel(intent.id, { cancellation_reason: "abandoned" });
      }
    } catch (error) {
      // Leave this one for the next run rather than expiring an order whose
      // payment state we could not confirm.
      console.error("[expire checkout]", order.id, error instanceof Error ? error.message : error);
      await client.from("sales_orders").update({ reservation_expires_at: new Date(now.getTime() + 15 * 60_000).toISOString() }).eq("id", order.id);
    }
  }
  const { data, error } = await client.rpc("expire_stale_checkout_orders");
  if (error) throw new Error(error.message);
  return { expired: Number(data ?? 0), rescued };
}

export async function enforceAuthorizationDeadlines(now = new Date()): Promise<{ alerted: number; cancelled: number }> {
  const client = createServiceRoleSupabaseClient();
  if (!client) return { alerted: 0, cancelled: 0 };
  const { data } = await client.from("sales_orders").select(ORDER_COLUMNS).eq("checkout_state", "authorized").limit(500);
  let alerted = 0;
  let cancelled = 0;
  for (const order of (data ?? []) as OrderRow[]) {
    const action = authorizationAction(order.authorized_at, order.authorization_expires_at, now);
    if (action === "alert") {
      if (await raiseStaffAlert({ kind: "authorization_expiring", dedupeKey: `auth-expiring:${order.id}`, subject: `Confirm or release ${order.order_number}`, body: `${order.order_number} (${usd(Number(order.total))}) was authorized ${order.authorized_at ? new Date(order.authorized_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }) : ""} and still waits for stock confirmation. The card hold will be released automatically one day before it lapses.`, relatedType: "order", relatedId: order.id })) alerted += 1;
    } else if (action === "cancel") {
      try {
        await cancelAuthorizedOrder(order.id, { userId: "", name: "system" }, "We weren't able to confirm stock for your order in time.");
        cancelled += 1;
        await raiseStaffAlert({ kind: "authorization_cancelled", dedupeKey: `auth-cancelled:${order.id}`, subject: `Released unconfirmed order ${order.order_number}`, body: `Nobody confirmed stock for ${order.order_number} before the card authorization would lapse, so it was released and the customer was told they were not charged.`, severity: "urgent", relatedType: "order", relatedId: order.id });
      } catch (error) {
        await raiseStaffAlert({ kind: "job_failure", dedupeKey: `auth-cancel-failed:${order.id}`, subject: `Could not release ${order.order_number}`, body: error instanceof Error ? error.message : String(error), severity: "urgent", relatedType: "order", relatedId: order.id });
      }
    }
  }
  return { alerted, cancelled };
}

/* Confirmation email ------------------------------------------------------------------------- */

const CONFIRMABLE = ["authorized", "paid", "confirmed", "paid_needs_review"];

function confirmationBody(order: OrderRow & { lines: Array<{ description: string | null; quantity: number; unit_price: number | string }>; fulfillment_window: string | null }): string {
  const rows = order.lines
    .map((line) => `<tr><td style="padding:4px 0">${line.quantity} × ${escape(line.description ?? "Item")}</td><td style="padding:4px 0;text-align:right">${usd(Number(line.unit_price) * line.quantity)}</td></tr>`)
    .join("");
  const state =
    order.checkout_state === "authorized"
      ? "<p style=\"line-height:1.6\"><strong>Your card has been authorized, not charged.</strong> The Newark counter checks the stock first; we'll email you before your card is charged. If we can't fulfil it, the hold is released and you pay nothing.</p>"
      : order.checkout_state === "confirmed"
        ? order.payment_mode === "freight_quote"
          ? "<p style=\"line-height:1.6\">We'll email you a freight quote. Nothing is charged until you approve it.</p>"
          : "<p style=\"line-height:1.6\">This order is on your account terms; you'll receive an invoice.</p>"
        : "<p style=\"line-height:1.6\">Payment received.</p>";
  // A held order is received, not promised: say so rather than imply it is on its way.
  const review = order.hold_reason
    ? "<p style=\"line-height:1.6\"><strong>Our team reviews this order before it's released.</strong> We'll contact you within one business day if anything needs confirming.</p>"
    : "";
  const fulfilment =
    order.fulfillment_method === "pickup"
      ? "<p style=\"line-height:1.6\">Will-call pickup at our Newark counter. Bring photo ID: the order is released to the name on it.</p>"
      : order.fulfillment_method === "freight"
        ? "<p style=\"line-height:1.6\"><strong>Freight delivery: inspect before you sign.</strong> Note any damage on the delivery receipt before signing, or the carrier may refuse the claim.</p>"
        : "<p style=\"line-height:1.6\">Local delivery. Please inspect the equipment when it arrives and note any damage before signing.</p>";
  return `<h2 style="font-size:20px;margin:8px 0">Order ${escape(order.order_number)} received</h2>
    ${state}
    ${review}
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}<tr><td style="padding-top:8px;border-top:1px solid silver"><strong>Total</strong></td><td style="padding-top:8px;border-top:1px solid silver;text-align:right"><strong>${usd(Number(order.total))}</strong></td></tr></table>
    ${fulfilment}
    ${order.fulfillment_window ? `<p style="line-height:1.6">Requested window: ${escape(order.fulfillment_window)}</p>` : ""}
    <p style="line-height:1.6;font-size:13px">Returns: <a href="${siteUrl()}/returns">${siteUrl().replace(/^https?:\/\//, "")}/returns</a> · Warranty claims: <a href="${siteUrl()}/warranty">${siteUrl().replace(/^https?:\/\//, "")}/warranty</a></p>`;
}

/** Send the order confirmation once, claimed atomically; safe to call repeatedly. */
export async function ensureOrderConfirmation(orderId: string): Promise<"sent" | "skipped" | "failed"> {
  const client = createServiceRoleSupabaseClient();
  if (!client) return "skipped";
  const { data: claimed } = await client.rpc("claim_order_confirmation", { p_order_id: orderId });
  if (!claimed) return "skipped";
  const { data: order } = await client.from("sales_orders").select(`${ORDER_COLUMNS}, fulfillment_window, confirmation_email_attempts`).eq("id", orderId).single();
  if (!order?.buyer_email || !CONFIRMABLE.includes(order.checkout_state)) {
    await client.from("sales_orders").update({ confirmation_email_status: "not_applicable" }).eq("id", orderId);
    return "skipped";
  }
  const { data: lines } = await client.from("order_lines").select("description, quantity, unit_price").eq("order_id", orderId);
  try {
    await sendRequiredEmail(order.buyer_email, `Order ${order.order_number} received`, emailShell(confirmationBody({ ...(order as OrderRow), fulfillment_window: order.fulfillment_window, lines: lines ?? [] })), `confirmation-${orderId}-${order.confirmation_email_attempts}`, {
      kind: "order_confirmation",
      relatedType: "order",
      relatedId: orderId,
    });
    await client.from("sales_orders").update({ confirmation_email_status: "sent" }).eq("id", orderId);
    return "sent";
  } catch (error) {
    await client.from("sales_orders").update({ confirmation_email_status: "failed" }).eq("id", orderId);
    if ((order.confirmation_email_attempts ?? 0) >= 5) {
      await raiseStaffAlert({ kind: "confirmation_email_failed", dedupeKey: `confirmation-failed:${orderId}`, subject: `Confirmation email failed for ${order.order_number}`, body: `Five attempts to email ${order.order_number}'s confirmation failed (${error instanceof Error ? error.message : "unknown error"}). Contact the customer directly.`, relatedType: "order", relatedId: orderId });
    }
    return "failed";
  }
}

export async function sendPendingConfirmations(): Promise<{ sent: number; failed: number }> {
  const client = createServiceRoleSupabaseClient();
  if (!client) return { sent: 0, failed: 0 };
  const { data } = await client
    .from("sales_orders")
    .select("id")
    .in("checkout_state", CONFIRMABLE)
    .in("confirmation_email_status", ["pending", "failed"])
    .lt("confirmation_email_attempts", 5)
    .not("buyer_email", "is", null)
    .limit(100);
  let sent = 0;
  let failed = 0;
  for (const row of data ?? []) {
    const result = await ensureOrderConfirmation(row.id);
    if (result === "sent") sent += 1;
    if (result === "failed") failed += 1;
  }
  return { sent, failed };
}

/** Alerts for held orders and late payments, once each. */
export async function alertOnHeldOrders(): Promise<number> {
  const client = createServiceRoleSupabaseClient();
  if (!client) return 0;
  const { data } = await client.from("sales_orders").select("id, order_number, total, hold_reason, hold_detail, checkout_state").not("hold_reason", "is", null).limit(200);
  let raised = 0;
  for (const order of data ?? []) {
    const urgent = order.checkout_state === "paid_needs_review";
    if (
      await raiseStaffAlert({
        kind: urgent ? "paid_needs_review" : "order_hold",
        dedupeKey: urgent ? `paid-review:${order.id}` : `hold:${order.id}`,
        subject: urgent ? `Paid order ${order.order_number} needs review` : `Order ${order.order_number} is on hold (${String(order.hold_reason).replaceAll("_", " ")})`,
        body: `${order.order_number}, ${usd(Number(order.total))}: ${order.hold_detail ?? order.hold_reason}. Decide in /admin/fulfillment.`,
        severity: urgent ? "urgent" : "normal",
        relatedType: "order",
        relatedId: order.id,
      })
    )
      raised += 1;
  }
  return raised;
}

/** One place the hourly dispatcher calls for every money-safety job. */
export async function runPaymentSafetyJobs(now = new Date()) {
  const results = {
    expiry: await expireStaleCheckouts(now).catch((error) => ({ error: String(error) })),
    reconciliation: await reconcilePayments(now).catch((error) => ({ error: String(error) })),
    authorizations: await enforceAuthorizationDeadlines(now).catch((error) => ({ error: String(error) })),
    confirmations: await sendPendingConfirmations().catch((error) => ({ error: String(error) })),
    holds: await alertOnHeldOrders().catch((error) => ({ error: String(error) })),
    // Not money, but the same "nobody noticed" failure: a 45-day legal deadline.
    privacyDeadlines: await alertOnPrivacyDeadlines(now).catch((error) => ({ error: String(error) })),
  };
  const failed = Object.values(results).some((value) => typeof value === "object" && value !== null && "error" in value);
  await recordHeartbeat("payment-safety", failed ? "error" : "ok", results as unknown as Record<string, unknown>);
  return results;
}
