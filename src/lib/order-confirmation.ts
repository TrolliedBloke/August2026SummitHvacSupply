/**
 * The order confirmation, as three separate state machines -- payment, order,
 * fulfillment -- plus the confirmation email, which is a side effect and never
 * part of whether the order succeeded. Pure mapping from stored order fields,
 * shared by the confirmation page, the status API and the printable receipt.
 */

export type PaymentStatus = "pending" | "authorized" | "paid" | "failed" | "invoiced" | "quoted";
export type OrderStatus = "processing" | "confirmed" | "cancelled";
export type FulfillmentStatus = "pending" | "ready" | "partial" | "backordered" | "completed" | "cancelled";
export type EmailStatus = "pending" | "sent" | "failed" | "not_applicable";

export type ConfirmationLine = {
  title: string;
  sku: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  status: "pending" | "ready" | "partial" | "backordered" | "fulfilled" | "cancelled";
};

export type OrderConfirmation = {
  orderNumber: string;
  placedAt: string | null;
  payment: PaymentStatus;
  order: OrderStatus;
  fulfillment: FulfillmentStatus;
  email: EmailStatus;
  method: "pickup" | "local_delivery" | "freight" | null;
  windowLabel: string | null;
  /** Masked: "5437 C••• Ave…, 94560". Never the full address. */
  address: string | null;
  contact: { name: string | null; email: string | null };
  lines: ConfirmationLine[];
  totals: { subtotal: number; fee: number; tax: number; total: number };
};

export type StoredOrder = {
  order_number: string;
  created_at?: string | null;
  checkout_state: string;
  payment_mode: "card" | "net_terms" | "freight_quote";
  fulfillment_method?: string | null;
  fulfillment_window?: string | null;
  fulfillment_status?: string | null;
  delivery_address?: string | null;
  delivery_zip?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  confirmation_email_status?: string | null;
  subtotal: number | string;
  total: number | string;
  fulfillment_fee: number | string;
  lines?: Array<{ description: string; quantity: number; unit_price: number | string; fulfillment_status?: string | null }>;
};

export function maskEmailAddress(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  return domain ? `${local.slice(0, 1)}•••@${domain}` : null;
}

export function maskAddress(address: string | null | undefined, zip: string | null | undefined): string | null {
  if (!address) return null;
  const first = address.split(",")[0]?.trim() ?? "";
  const words = first.split(/\s+/);
  const masked = words.map((word, index) => (index === 0 ? word : `${word.slice(0, 1)}•••`)).join(" ");
  return zip ? `${masked}, ${zip}` : masked;
}

export function paymentStatusFor(order: Pick<StoredOrder, "checkout_state" | "payment_mode">): PaymentStatus {
  if (order.payment_mode === "net_terms" && order.checkout_state === "confirmed") return "invoiced";
  if (order.payment_mode === "freight_quote" && order.checkout_state === "confirmed") return "quoted";
  if (order.checkout_state === "authorized") return "authorized";
  // A late payment staff are reviewing is still money received: never "failed".
  if (order.checkout_state === "paid" || order.checkout_state === "paid_needs_review") return "paid";
  if (order.checkout_state === "payment_failed" || order.checkout_state === "expired") return "failed";
  return "pending";
}

export function orderStatusFor(order: Pick<StoredOrder, "checkout_state">): OrderStatus {
  if (order.checkout_state === "paid" || order.checkout_state === "confirmed") return "confirmed";
  // Authorized and under-review orders are being confirmed by the counter.
  if (order.checkout_state === "authorized" || order.checkout_state === "paid_needs_review") return "processing";
  if (order.checkout_state === "payment_failed" || order.checkout_state === "expired") return "cancelled";
  return "processing";
}

export function fulfillmentStatusFor(orderStatus: string | null | undefined, lines: ConfirmationLine[]): FulfillmentStatus {
  if (orderStatus === "cancelled") return "cancelled";
  if (orderStatus === "delivered" || orderStatus === "picked_up") return "completed";
  if (lines.some((line) => line.status === "backordered")) {
    return lines.every((line) => line.status === "backordered") ? "backordered" : "partial";
  }
  if (lines.some((line) => line.status === "partial")) return "partial";
  if (orderStatus === "ready_for_pickup" || orderStatus === "out_for_delivery") return "ready";
  return "pending";
}

const WINDOW_FORMAT = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function toConfirmation(order: StoredOrder): OrderConfirmation {
  const lines: ConfirmationLine[] = (order.lines ?? []).map((line) => {
    const unitPrice = Number(line.unit_price);
    const match = /^(.*) \(([^)]+)\)$/.exec(line.description);
    return {
      title: match?.[1] ?? line.description,
      sku: match?.[2] ?? "",
      qty: line.quantity,
      unitPrice,
      lineTotal: Math.round(unitPrice * line.quantity * 100) / 100,
      status: (line.fulfillment_status as ConfirmationLine["status"]) ?? "pending",
    };
  });
  const subtotal = Number(order.subtotal);
  const fee = Number(order.fulfillment_fee);
  const total = Number(order.total);
  const order_ = orderStatusFor(order);
  return {
    orderNumber: order.order_number,
    placedAt: order.created_at ?? null,
    payment: paymentStatusFor(order),
    order: order_,
    fulfillment: order_ === "cancelled" ? "cancelled" : fulfillmentStatusFor(order.fulfillment_status, lines),
    email: (order.confirmation_email_status as EmailStatus) ?? "pending",
    method: (order.fulfillment_method as OrderConfirmation["method"]) ?? null,
    windowLabel: order.fulfillment_window ? `${WINDOW_FORMAT.format(new Date(order.fulfillment_window))} PT` : null,
    address: maskAddress(order.delivery_address, order.delivery_zip),
    contact: { name: order.buyer_name ?? null, email: maskEmailAddress(order.buyer_email) },
    lines,
    totals: { subtotal, fee, tax: Math.round((total - subtotal - fee) * 100) / 100, total },
  };
}

/**
 * The one headline and next step for each combination, so a paid order with a
 * backordered line never reads as "complete", and a failed email never reads as
 * a failed order.
 */
export function confirmationMessage(confirmation: Pick<OrderConfirmation, "payment" | "order" | "fulfillment" | "method">): { tone: "success" | "pending" | "warning" | "danger"; title: string; body: string; next: string } {
  const { payment, order, fulfillment, method } = confirmation;
  if (order === "cancelled") {
    return { tone: "danger", title: "Payment not completed", body: "No order was placed and nothing was charged. Your cart is still saved.", next: "Return to checkout to try again." };
  }
  if (payment === "pending") {
    return { tone: "pending", title: "Payment pending", body: "Your items are held while payment completes.", next: "Finish payment below." };
  }
  if (payment === "authorized") {
    return {
      tone: "pending",
      title: "Card authorized -- confirming stock",
      body: "Your card is held, not charged. The Newark counter is checking the stock; we email you before your card is charged. If we can't fulfil the order, the hold is released and you pay nothing.",
      next: "Watch your email for confirmation.",
    };
  }
  const where = method === "pickup" ? "pickup" : method === "local_delivery" ? "delivery" : "shipment";
  if (fulfillment === "backordered") {
    return { tone: "warning", title: payment === "paid" ? "Payment received -- items on backorder" : "Order confirmed -- items on backorder", body: "Everything on this order is waiting on stock. We email the expected date before anything ships.", next: "Watch your email for the backorder date." };
  }
  if (fulfillment === "partial") {
    return { tone: "warning", title: payment === "paid" ? "Payment received -- part of the order is ready" : "Order confirmed -- part of the order is ready", body: `Some lines are ready for ${where}; the rest are listed below with their status.`, next: `We confirm the ${where} plan for the remaining lines by email.` };
  }
  if (fulfillment === "ready") {
    return { tone: "success", title: method === "pickup" ? "Ready for pickup" : "Out for delivery", body: "Your order is staged.", next: method === "pickup" ? "Bring the order number and photo ID to the Newark counter; the order is released to the name on it." : "Someone should be on site to receive it and note any damage on the delivery receipt before signing." };
  }
  if (fulfillment === "completed") {
    return { tone: "success", title: "Order complete", body: "Every line has been picked up or delivered.", next: "Keep the receipt for warranty registration." };
  }
  if (payment === "invoiced") {
    return { tone: "success", title: "Order confirmed", body: "Invoiced to your account on net terms.", next: `We email your confirmed ${where} window.` };
  }
  if (payment === "quoted") {
    return { tone: "success", title: "Order received -- freight quote on the way", body: "Nothing is charged for freight until you approve the quote.", next: "Watch your email for the freight quote." };
  }
  return { tone: "success", title: "Payment received", body: "Your order is confirmed and being prepared.", next: `We email your ${where} details.` };
}
