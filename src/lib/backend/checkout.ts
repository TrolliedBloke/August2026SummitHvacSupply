import { checkoutSchema } from "./schemas";
import { getSessionProfile } from "./auth";
import { createServiceRoleSupabaseClient } from "./supabase";
import { getStripe } from "./stripe";
import { isFulfillmentWindowAvailable, WAREHOUSE, type FulfillmentMethod } from "./fulfillment";
import { clearCartSnapshot } from "./lifecycle";
import { createOrderToken } from "./order-token";
import { type CheckoutState, type CheckoutStatus } from "./checkout-state";
import { issueCheckoutSnapshotWithCompliance, verifySnapshotToken } from "./checkout-snapshot";
import { acknowledgementRecord, missingAcknowledgements } from "@/lib/compliance/order-checks";
import { creditDecision, type CreditDecision } from "@/lib/payments/credit";
import { raiseStaffAlert } from "./alerts";
import type { CheckoutSnapshot } from "@/lib/checkout-snapshot-types";
import { toConfirmation, type OrderConfirmation, type StoredOrder } from "@/lib/order-confirmation";

/**
 * Places an order from the cart with a chosen fulfillment method.
 *
 * Trust rules:
 *  - Line prices are resolved SERVER-SIDE from the catalog by tier. The client
 *    never sends prices.
 *  - The delivery fee is resolved from delivery_zones (DB) / ZONES (seeded),
 *    never from the client.
 *  - Signed-in trade accounts (dealer/installer/staff) get Pro pricing and net
 *    terms (invoice later). Guests/homeowners pay now by card.
 */

type CheckoutResult = CheckoutStatus & {
  mode: "supabase" | "seeded";
  confirmationToken: string;
};

export class CheckoutConflictError extends Error {}

/**
 * The order cannot be placed as reviewed: a line is no longer purchasable, the
 * chosen fulfillment method is gone, or a price, stock, fee or tax changed
 * since the buyer's snapshot. Carries the CURRENT snapshot so the client can
 * show exactly what changed and ask for acknowledgment. Surfaces as HTTP 409.
 */
export class CheckoutReviewRequiredError extends Error {
  constructor(
    readonly code: "line_errors" | "method_unavailable" | "stale",
    readonly snapshot: CheckoutSnapshot,
    message: string
  ) {
    super(message);
  }
}

/**
 * The order could not be attempted because a dependency (the database) is not
 * configured or not reachable. Distinct from a conflict: nothing was written,
 * the cart is intact, and retrying later is the correct response. Surfaces as
 * HTTP 503, never as a confirmation.
 */
export class CheckoutUnavailableError extends Error {}


export async function placeOrder(input: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.parse(input);
  const profile = await getSessionProfile();

  // 1. Re-issue the snapshot from current data -- prices by the session's
  //    authorization, live stock, fulfillment, fee and tax. The client never
  //    sends prices, and what it reviewed must still be what is true now.
  const { snapshot, compliance } = await issueCheckoutSnapshotWithCompliance({
    items: parsed.items.map((item) => ({ skuId: item.skuId, qty: item.qty })),
    method: parsed.method,
    zip: parsed.zip ?? null,
  });
  if (snapshot.lines.some((line) => line.error)) {
    throw new CheckoutReviewRequiredError("line_errors", snapshot, "Some items can no longer be bought as listed. Review them to continue.");
  }
  if (!snapshot.methodAvailable) {
    throw new CheckoutReviewRequiredError("method_unavailable", snapshot, "That fulfillment option is no longer available for this order. Choose another.");
  }
  if (verifySnapshotToken(parsed.snapshotToken) !== snapshot.digest) {
    throw new CheckoutReviewRequiredError("stale", snapshot, "Your order changed since you reviewed it. Check the differences and confirm.");
  }
  if (snapshot.payment === "card" && snapshot.tax.status === "unavailable") {
    throw new CheckoutConflictError(
      "We cannot calculate sales tax for that delivery address online. Request a quote and we will confirm tax and freight."
    );
  }
  if (parsed.method !== "freight" && !isFulfillmentWindowAvailable(parsed.method, parsed.zip ?? null, parsed.window!)) {
    throw new CheckoutConflictError("That fulfillment window is no longer available. Choose another time.");
  }
  // Phase 3: the buyer ticked every acknowledgement this order needs, in the
  // version that was shown. The text and version are stored as evidence.
  if (missingAcknowledgements(compliance.acknowledgements, parsed.acknowledgements).length > 0) {
    throw new CheckoutConflictError("Confirm the installation and warranty terms for the equipment in this order to continue.");
  }

  const lines = parsed.items.map((item) => {
    const line = snapshot.lines.find((entry) => entry.skuId === item.skuId)!;
    return { ...item, catalogId: item.skuId, unitPrice: line.unitPrice ?? 0, lineTotal: line.lineTotal ?? 0 };
  });
  const { subtotal, fee, total, payment } = snapshot;
  const tax = snapshot.tax.amount;
  const availabilityVerified = snapshot.lines.every((line) => line.state === "purchasable");

  // Public checkout must use the trusted server client. The anonymous client
  // cannot insert orders under RLS or call reserve_public_order.
  const supabase = createServiceRoleSupabaseClient();
  const orderNumber = "SO-" + Date.now().toString(36).toUpperCase();

  // No database means no order. This previously fabricated a "confirmed" order
  // in memory and handed the customer a confirmation token, so a single missing
  // environment variable in production told buyers their order was placed while
  // nothing was ever persisted and no payment was taken. An unconfigured
  // backend is an outage, and an outage must look like one.
  if (!supabase) {
    throw new CheckoutUnavailableError(
      "We could not reach the ordering system, so nothing was charged and no order was placed. Your cart is saved -- please try again shortly."
    );
  }

  const { data: existing } = await supabase
    .from("sales_orders")
    .select("id, order_number, subtotal, total, fulfillment_fee, payment_mode, checkout_state, payment_intent_id")
    .eq("checkout_idempotency_key", parsed.idempotencyKey)
    .maybeSingle();
  if (existing) return existingCheckoutResult(existing);

  // Holds: the order is placed, but staff release it before it is charged,
  // picked or shipped. Net terms extend credit (1.6); a compliance note can
  // need a conversation with the buyer (3.3).
  const accountId = profile?.accountId ?? null;
  const credit = payment === "net_terms" ? await checkCredit(supabase, accountId, total) : null;
  if (credit && !credit.ok && credit.action === "block") {
    throw new CheckoutConflictError("This order is over your account's credit limit. Call the counter to arrange payment.");
  }
  const hold: { reason: string; detail: string } | null =
    credit && !credit.ok
      ? { reason: "credit_limit", detail: credit.detail }
      : compliance.hold
        ? { reason: "compliance_review", detail: compliance.review.filter((note) => note.hold).map((note) => note.message).join(" ") }
        : null;

  // 5. Insert the order + lines (service-role; validated above).
  const { data: order, error } = await supabase
    .from("sales_orders")
    .insert({
      order_number: orderNumber,
      account_id: accountId,
      status: "pending",
      subtotal,
      total,
      fulfillment_method: parsed.method,
      fulfillment_fee: fee,
      delivery_zip: parsed.zip ?? null,
      delivery_address: parsed.address ?? null,
      fulfillment_window: parsed.window ?? null,
      po_number: parsed.poNumber ?? null,
      pickup_warehouse_id: parsed.method === "pickup" ? WAREHOUSE.id : null,
      fulfillment_status: "pending",
      buyer_name: parsed.buyerName ?? null,
      buyer_email: parsed.buyerEmail ?? null,
      buyer_phone: parsed.phone ?? null,
      buyer_company: parsed.company ?? null,
      checkout_state: payment === "card" ? "checkout_started" : "confirmed",
      checkout_idempotency_key: parsed.idempotencyKey,
      reservation_expires_at: payment === "card" ? new Date(Date.now() + 30 * 60_000).toISOString() : null,
      payment_mode: payment,
      install_acknowledgement:
        compliance.acknowledgements.length > 0 || compliance.review.length > 0
          ? { ...acknowledgementRecord(compliance.acknowledgements, compliance.review, new Date()), pickupName: parsed.pickupName?.trim() || null }
          : parsed.pickupName?.trim()
            ? { pickupName: parsed.pickupName.trim() }
            : null,
      hold_reason: hold?.reason ?? null,
      hold_detail: hold?.detail ?? null,
      hold_set_at: hold ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !order) throw new Error(error?.message ?? "Order insert failed");

  // Storefront ids are catalog_products keys (text), not legacy skus uuids.
  // Writing them to sku_id raised 22P02 and killed every catalog checkout; see
  // migration 014, which adds this column and the one-of-two check constraint.
  const { error: lineError } = await supabase.from("order_lines").insert(
    lines.map((l) => ({
      order_id: order.id,
      catalog_product_id: l.catalogId,
      sku_id: null,
      description: `${l.title} (${l.sku})`,
      quantity: l.qty,
      unit_price: l.unitPrice,
    }))
  );
  if (lineError) {
    await supabase.from("sales_orders").delete().eq("id", order.id);
    throw new Error(lineError.message);
  }

  // 6. Reserve FIFO stock where this catalog item is inventory-tracked. Summit
  // also sells orderable products that are not quantity-tracked in the source
  // catalog; those become normal pending sales orders instead of failing a
  // public checkout merely because no inventory lot exists.
  if (availabilityVerified) {
    const { error: reserveError } = await supabase.rpc("reserve_public_order", { p_order_id: order.id });
    if (reserveError) {
      await supabase.from("sales_orders").delete().eq("id", order.id);
      throw new Error(reserveError.message);
    }
  }

  // 7. Card payment: PaymentIntent for the order total, keyed to the order.
  let clientSecret: string | undefined;
  if (payment === "card") {
    const stripe = getStripe();
    if (stripe && total > 0) {
      let intentId: string | null = null;
      try {
        // Authorize only. The card is charged when the counter confirms the
        // unit is on the shelf (src/lib/backend/payments.ts): catalog stock
        // lives in QuickBooks, so the counter may have sold it in person.
        const intent = await stripe.paymentIntents.create({
          amount: Math.round(total * 100),
          currency: "usd",
          capture_method: "manual",
          automatic_payment_methods: { enabled: true },
          metadata: { order_id: order.id, order_number: orderNumber },
        }, { idempotencyKey: parsed.idempotencyKey });
        intentId = intent.id;
        clientSecret = intent.client_secret ?? undefined;
        await supabase.from("sales_orders").update({
          checkout_state: "payment_pending",
          payment_intent_id: intent.id,
          checkout_updated_at: new Date().toISOString(),
        }).eq("id", order.id);
      } catch (error) {
        // If the intent exists but the order could not be linked to it, cancel
        // it so it can never be paid for a released order.
        if (intentId) await stripe.paymentIntents.cancel(intentId).catch(() => {});
        await supabase.rpc("release_checkout_order", { p_order_id: order.id, p_state: "payment_failed" });
        throw error;
      }
    } else {
      await supabase.rpc("release_checkout_order", { p_order_id: order.id, p_state: "payment_failed" });
      throw new Error("Card payment is temporarily unavailable. Your cart has been preserved.");
    }
  }

  if (hold) {
    void raiseStaffAlert({
      kind: "order_hold",
      dedupeKey: `hold:${order.id}`,
      subject: `Order ${orderNumber} is on hold: ${hold.reason === "credit_limit" ? "credit limit" : "compliance review"}`,
      body: `${hold.detail}\n\nRelease or cancel it in Admin → Fulfillment.${payment === "card" ? " The card is only authorized; nothing is charged until it is released and captured." : ""}`,
      relatedType: "order",
      relatedId: order.id,
    });
  }

  const checkoutState: CheckoutState = payment === "card" ? "payment_pending" : "confirmed";
  if (checkoutState === "confirmed" && parsed.buyerEmail) {
    void clearCartSnapshot(parsed.buyerEmail.toLowerCase()).catch(() => {});
  }

  return withToken({
    orderId: order.id,
    orderNumber,
    subtotal,
    fee,
    tax,
    total,
    payment,
    checkoutState,
    clientSecret,
  }, "supabase");
}

type ServiceClient = NonNullable<ReturnType<typeof createServiceRoleSupabaseClient>>;

/** Open AR plus uninvoiced net-terms orders, against the account's limit. */
async function checkCredit(supabase: ServiceClient, accountId: string | null, total: number): Promise<CreditDecision> {
  if (!accountId) return creditDecision({ creditLimit: 0, openInvoiceBalance: 0, uninvoicedOrders: 0 }, total);
  const [account, invoices, orders] = await Promise.all([
    supabase.from("accounts").select("credit_limit").eq("id", accountId).maybeSingle(),
    supabase.from("invoices").select("order_id, status, balance").eq("account_id", accountId).neq("status", "void"),
    supabase.from("sales_orders").select("id, total").eq("account_id", accountId).eq("payment_mode", "net_terms").eq("paid", false).neq("status", "cancelled"),
  ]);
  // A lookup failure must not extend credit: treat it as no limit (held).
  if (account.error || invoices.error || orders.error) {
    return creditDecision({ creditLimit: 0, openInvoiceBalance: 0, uninvoicedOrders: 0 }, total);
  }
  const invoiceRows = invoices.data ?? [];
  const invoiced = new Set(invoiceRows.map((row) => row.order_id).filter(Boolean));
  return creditDecision(
    {
      creditLimit: Number(account.data?.credit_limit ?? 0),
      openInvoiceBalance: invoiceRows.filter((row) => row.status !== "paid").reduce((sum, row) => sum + Number(row.balance ?? 0), 0),
      uninvoicedOrders: (orders.data ?? []).filter((row) => !invoiced.has(row.id)).reduce((sum, row) => sum + Number(row.total ?? 0), 0),
    },
    total
  );
}

type ExistingOrder = {
  id: string;
  order_number: string;
  subtotal: number | string;
  total: number | string;
  fulfillment_fee: number | string;
  payment_mode: CheckoutStatus["payment"];
  checkout_state: CheckoutState;
  payment_intent_id: string | null;
};

/**
 * The safe confirmation DTO: payment, order and fulfillment states, masked
 * contact and address, lines, totals, and the confirmation-email status --
 * never internal ids. Columns from migration 028 are read when present.
 */
export async function getOrderConfirmation(orderId: string): Promise<OrderConfirmation | null> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return null;
  const base =
    "order_number, created_at, checkout_state, payment_mode, fulfillment_method, fulfillment_window, fulfillment_status, delivery_address, delivery_zip, buyer_name, buyer_email, subtotal, total, fulfillment_fee";
  let { data, error } = await supabase.from("sales_orders").select(`${base}, confirmation_email_status`).eq("id", orderId).maybeSingle();
  if (error) ({ data, error } = await supabase.from("sales_orders").select(base).eq("id", orderId).maybeSingle());
  if (error || !data) return null;
  const withStatus = await supabase.from("order_lines").select("description, quantity, unit_price, fulfillment_status").eq("order_id", orderId);
  const lines: unknown[] | null = withStatus.error
    ? (await supabase.from("order_lines").select("description, quantity, unit_price").eq("order_id", orderId)).data
    : withStatus.data;
  return toConfirmation({ ...(data as unknown as StoredOrder), lines: (lines ?? []) as StoredOrder["lines"] });
}

async function existingCheckoutResult(order: ExistingOrder): Promise<CheckoutResult> {
  let clientSecret: string | undefined;
  if (order.payment_intent_id && order.checkout_state === "payment_pending") {
    const stripe = getStripe();
    const intent = stripe ? await stripe.paymentIntents.retrieve(order.payment_intent_id) : null;
    clientSecret = intent?.client_secret ?? undefined;
  }
  const subtotal = Number(order.subtotal);
  const fee = Number(order.fulfillment_fee);
  const total = Number(order.total);
  return withToken({
    orderId: order.id,
    orderNumber: order.order_number,
    subtotal,
    fee,
    tax: round(total - subtotal - fee),
    total,
    payment: order.payment_mode,
    checkoutState: order.checkout_state,
    clientSecret,
  }, "supabase");
}

function withToken(status: CheckoutStatus, mode: CheckoutResult["mode"]): CheckoutResult {
  return { ...status, mode, confirmationToken: createOrderToken(status.orderId) };
}

/**
 * Kept for the lifecycle dispatcher. Delegates to the payment-safe expiry,
 * which settles each PaymentIntent with Stripe before releasing its order.
 */
export async function cleanupExpiredCheckouts(): Promise<number> {
  const { expireStaleCheckouts } = await import("./payments");
  const { expired } = await expireStaleCheckouts();
  return expired;
}

export async function getCheckoutStatus(orderId: string): Promise<CheckoutStatus | null> {
  const supabase = createServiceRoleSupabaseClient();
  // Without a database there is no order to report on. Returning a seeded
  // status here would show a confirmation page for an order that does not
  // exist; null renders "not found", which is true.
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("sales_orders")
    .select("id, order_number, subtotal, total, fulfillment_fee, payment_mode, checkout_state, payment_intent_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return null;
  const result = await existingCheckoutResult(data as ExistingOrder);
  // The confirmation email goes out the first time anyone sees a confirmable
  // order (usually the buyer, on this page); the hourly job retries failures.
  if (["authorized", "paid", "confirmed", "paid_needs_review"].includes(result.checkoutState)) {
    void import("./payments").then((module) => module.ensureOrderConfirmation(result.orderId)).catch(() => {});
  }
  return {
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    subtotal: result.subtotal,
    fee: result.fee,
    tax: result.tax,
    total: result.total,
    payment: result.payment,
    checkoutState: result.checkoutState,
    clientSecret: result.clientSecret,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export type { FulfillmentMethod };
