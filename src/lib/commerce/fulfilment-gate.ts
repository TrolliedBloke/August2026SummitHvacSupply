/**
 * Why an order cannot be staged, handed over or shipped yet, or null when it
 * can. Mirrors public.order_fulfilment_block (migration 043), which is what
 * actually enforces it; this copy decides which admin queue shows the order.
 */
export type GateOrder = {
  status: string;
  paid: boolean | null;
  payment_mode: string | null;
  checkout_state: string | null;
  hold_reason: string | null;
};

export type FulfilmentQueue = "capture" | "hold" | "awaiting_payment" | "ready" | "closed";

export function fulfilmentBlock(order: GateOrder): string | null {
  if (order.status === "cancelled") return "cancelled";
  if (order.hold_reason) return `on hold (${order.hold_reason.replaceAll("_", " ")})`;
  if (order.payment_mode === null) return null;
  if (order.payment_mode === "card") {
    if (order.paid && order.checkout_state === "paid") return null;
    return order.checkout_state === "authorized" ? "card authorized, not charged" : "card payment not taken";
  }
  if (order.payment_mode === "net_terms") return order.checkout_state === "confirmed" ? null : "net-terms order not confirmed";
  // Freight quotes: the database also accepts an account order with an issued
  // invoice; the queue shows those as waiting until that is checked there.
  if (order.payment_mode === "freight_quote") return order.paid ? null : "freight quote not paid or invoiced";
  return `unknown payment mode ${order.payment_mode}`;
}

export function fulfilmentQueue(order: GateOrder & { fulfillment_status: string }): FulfilmentQueue {
  if (order.hold_reason) return "hold";
  if (order.status === "cancelled" || order.fulfillment_status === "cancelled") return "closed";
  if (order.fulfillment_status === "delivered" || order.fulfillment_status === "picked_up") return "closed";
  if (order.payment_mode === "card" && order.checkout_state === "authorized") return "capture";
  return fulfilmentBlock(order) === null ? "ready" : "awaiting_payment";
}
