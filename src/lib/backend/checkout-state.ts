import "server-only";

export type CheckoutState =
  | "checkout_started"
  | "payment_pending"
  | "paid"
  | "payment_failed"
  | "expired"
  | "confirmed";

export type CheckoutStatus = {
  orderId: string;
  orderNumber: string;
  subtotal: number;
  fee: number;
  tax: number;
  total: number;
  payment: "card" | "net_terms" | "freight_quote";
  checkoutState: CheckoutState;
  clientSecret?: string;
};

// Development fallback only. Production state is always read from Supabase.
const seededByOrder = new Map<string, CheckoutStatus>();
const seededByKey = new Map<string, CheckoutStatus>();

export function rememberSeededCheckout(idempotencyKey: string, status: CheckoutStatus) {
  seededByOrder.set(status.orderId, status);
  seededByKey.set(idempotencyKey, status);
}

export function seededCheckoutByOrder(orderId: string) {
  return seededByOrder.get(orderId) ?? null;
}

export function seededCheckoutByKey(idempotencyKey: string) {
  return seededByKey.get(idempotencyKey) ?? null;
}
