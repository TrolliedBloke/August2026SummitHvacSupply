/**
 * What to do when Stripe and our order records disagree
 * (docs/LIABILITY-REMEDIATION-PLAN.md, 1.2 and 1.3).
 *
 * Pure: the job in src/lib/backend/payments.ts fetches PaymentIntents and
 * orders, and this decides. Every decision is either a safe repair (record
 * what Stripe already did, or release an authorization nobody can use) or an
 * alert for a person. Nothing here charges a card or refunds money.
 */

export type IntentFacts = {
  id: string;
  status: "requires_payment_method" | "requires_confirmation" | "requires_action" | "processing" | "requires_capture" | "canceled" | "succeeded";
  /** Cents. */
  amount: number;
  amountReceived: number;
  amountCapturable: number;
  amountRefunded: number;
  orderId: string | null;
};

export type OrderFacts = {
  id: string;
  orderNumber: string;
  checkoutState: string;
  status: string;
  paid: boolean;
  /** Dollars. */
  total: number;
  /** Net of reversals, dollars. */
  recordedPayments: number;
};

export type ReconcileAction =
  | { kind: "ok" }
  | { kind: "record_payment"; reason: "missed_success"; urgent: boolean }
  | { kind: "record_authorization"; reason: "missed_authorization" }
  | { kind: "cancel_authorization"; reason: "authorization_for_dead_order" }
  | { kind: "release_order"; reason: "missed_cancellation" }
  | { kind: "alert"; reason: "order_not_found" | "paid_without_charge" | "amount_mismatch" | "refund_not_recorded"; detail: string };

const LIVE_UNPAID = new Set(["checkout_started", "payment_pending", "authorized"]);
const DEAD = new Set(["expired", "payment_failed"]);

const cents = (dollars: number) => Math.round(dollars * 100);

export function reconcile(intent: IntentFacts, order: OrderFacts | null): ReconcileAction {
  if (!order) {
    // Only intents we created carry an order id; one without a matching order
    // means money (or a hold) with no record on our side.
    if (intent.status === "succeeded" || intent.status === "requires_capture") {
      return { kind: "alert", reason: "order_not_found", detail: `PaymentIntent ${intent.id} (${intent.status}) has no matching order.` };
    }
    return { kind: "ok" };
  }
  const dead = order.status === "cancelled" || DEAD.has(order.checkoutState);

  switch (intent.status) {
    case "succeeded": {
      if (!order.paid) return { kind: "record_payment", reason: "missed_success", urgent: dead };
      const netReceived = intent.amountReceived - intent.amountRefunded;
      if (Math.abs(cents(order.recordedPayments) - netReceived) > 1) {
        return intent.amountRefunded > 0
          ? { kind: "alert", reason: "refund_not_recorded", detail: `${order.orderNumber}: Stripe net ${(netReceived / 100).toFixed(2)}, recorded ${order.recordedPayments.toFixed(2)}.` }
          : { kind: "alert", reason: "amount_mismatch", detail: `${order.orderNumber}: Stripe received ${(intent.amountReceived / 100).toFixed(2)}, recorded ${order.recordedPayments.toFixed(2)}.` };
      }
      if (Math.abs(intent.amountReceived - cents(order.total)) > 1 && intent.amountRefunded === 0) {
        return { kind: "alert", reason: "amount_mismatch", detail: `${order.orderNumber}: charged ${(intent.amountReceived / 100).toFixed(2)} but the order total is ${order.total.toFixed(2)}.` };
      }
      return { kind: "ok" };
    }
    case "requires_capture":
      if (dead) return { kind: "cancel_authorization", reason: "authorization_for_dead_order" };
      if (order.checkoutState === "checkout_started" || order.checkoutState === "payment_pending") return { kind: "record_authorization", reason: "missed_authorization" };
      return { kind: "ok" };
    case "canceled":
      if (order.paid) return { kind: "alert", reason: "paid_without_charge", detail: `${order.orderNumber} is marked paid but its PaymentIntent was cancelled.` };
      if (LIVE_UNPAID.has(order.checkoutState)) return { kind: "release_order", reason: "missed_cancellation" };
      return { kind: "ok" };
    default:
      if (order.paid) return { kind: "alert", reason: "paid_without_charge", detail: `${order.orderNumber} is marked paid but Stripe shows ${intent.status}.` };
      return { kind: "ok" };
  }
}

/* Authorization deadline --------------------------------------------------------- */

/** Card authorizations lapse after about 7 days; act well before that. */
export const AUTHORIZATION_ALERT_AFTER_HOURS = 72;
export const AUTHORIZATION_CANCEL_BEFORE_EXPIRY_HOURS = 24;

export type AuthorizationAction = "none" | "alert" | "cancel";

export function authorizationAction(authorizedAt: string | null, expiresAt: string | null, now: Date): AuthorizationAction {
  if (!authorizedAt) return "none";
  const expiry = expiresAt ? new Date(expiresAt).getTime() : new Date(authorizedAt).getTime() + 7 * 86_400_000;
  if (expiry - now.getTime() <= AUTHORIZATION_CANCEL_BEFORE_EXPIRY_HOURS * 3_600_000) return "cancel";
  if (now.getTime() - new Date(authorizedAt).getTime() >= AUTHORIZATION_ALERT_AFTER_HOURS * 3_600_000) return "alert";
  return "none";
}
