import { checkoutSchema } from "./schemas";
import { getStorefrontSku } from "@/lib/storefront/catalog";
import { getSessionProfile } from "./auth";
import { createServiceRoleSupabaseClient } from "./supabase";
import { getStripe } from "./stripe";
import { isFulfillmentWindowAvailable, localDeliveryFee, resolveZone, WAREHOUSE, type FulfillmentMethod } from "./fulfillment";
import { estimateTax } from "./pricing";
import { clearCartSnapshot } from "./lifecycle";
import { createOrderToken } from "./order-token";
import { type CheckoutState, type CheckoutStatus } from "./checkout-state";

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
 * The order could not be attempted because a dependency (the database) is not
 * configured or not reachable. Distinct from a conflict: nothing was written,
 * the cart is intact, and retrying later is the correct response. Surfaces as
 * HTTP 503, never as a confirmation.
 */
export class CheckoutUnavailableError extends Error {}

function isTrade(role: string | undefined): boolean {
  return role === "dealer" || role === "installer" || role === "staff";
}

export async function placeOrder(input: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.parse(input);
  const profile = await getSessionProfile();
  const trade = isTrade(profile?.role);

  if (parsed.method !== "freight" && !isFulfillmentWindowAvailable(parsed.method, parsed.zip ?? null, parsed.window!)) {
    throw new CheckoutConflictError("That fulfillment window is no longer available. Choose another time.");
  }

  // 1. Price every line server-side, by tier.
  const lines = parsed.items.map((item) => {
    const sku = getStorefrontSku(item.skuId);
    // A SKU the catalog does not contain is a bad request, not a server fault.
    // Throwing a plain Error surfaced it as a 500, which both misreports the
    // cause and makes a tampered cart look like an outage in monitoring.
    if (!sku) throw new CheckoutConflictError("One of the items in your cart is no longer available.");
    if (!sku.purchaseEligible || sku.retailPrice === null) {
      throw new CheckoutConflictError(`${sku.sku} requires a verified quote before purchase.`);
    }
    // No trade price on file means the trade buyer pays retail, not zero.
    const unit = trade && sku.dealerPrice !== null && sku.dealerPrice > 0 ? sku.dealerPrice : sku.retailPrice;
    return { ...item, skuRecord: sku, unitPrice: unit, lineTotal: unit * item.qty };
  });
  const subtotal = round(lines.reduce((sum, l) => sum + l.lineTotal, 0));

  // 2. Resolve the delivery fee authoritatively.
  const fee =
    parsed.method === "local_delivery"
      ? await resolveDeliveryFee(parsed.zip, subtotal)
      : 0;

  // 3. Decide the payment path.
  const payment: CheckoutResult["payment"] =
    parsed.method === "freight" ? "freight_quote" : trade ? "net_terms" : "card";

  // 4. Estimated sales tax applies only to card checkout (homeowners/guests).
  //    Trade net-terms orders are taxed on the invoice; freight is quoted.
  //
  //    The destination decides the rate: will-call is taxed at the Newark hub,
  //    local delivery at the delivery ZIP. estimateTax returns null outside the
  //    one jurisdiction this rate is valid for, and an uncomputable tax must
  //    stop the sale rather than be charged as 0 -- undercharging tax is a
  //    liability Summit absorbs, not the customer.
  let tax = 0;
  if (payment === "card") {
    const destinationZip = parsed.method === "pickup" ? WAREHOUSE.zip : parsed.zip;
    const computed = estimateTax(subtotal, destinationZip);
    if (computed === null) {
      throw new CheckoutConflictError(
        "We cannot calculate sales tax for that delivery address online. Request a quote and we will confirm tax and freight."
      );
    }
    tax = computed;
  }
  const total = round(subtotal + fee + tax);

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

  // 5. Insert the order + lines (service-role; validated above).
  const { data: order, error } = await supabase
    .from("sales_orders")
    .insert({
      order_number: orderNumber,
      account_id: profile?.accountId ?? null,
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
      catalog_product_id: l.skuRecord.id,
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
  if (lines.some((line) => line.skuRecord.availabilityVerified)) {
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
      try {
        const intent = await stripe.paymentIntents.create({
          amount: Math.round(total * 100),
          currency: "usd",
          automatic_payment_methods: { enabled: true },
          metadata: { order_id: order.id, order_number: orderNumber },
        }, { idempotencyKey: parsed.idempotencyKey });
        clientSecret = intent.client_secret ?? undefined;
        await supabase.from("sales_orders").update({
          checkout_state: "payment_pending",
          payment_intent_id: intent.id,
          checkout_updated_at: new Date().toISOString(),
        }).eq("id", order.id);
      } catch (error) {
        await supabase.rpc("release_checkout_order", { p_order_id: order.id, p_state: "payment_failed" });
        throw error;
      }
    } else {
      await supabase.rpc("release_checkout_order", { p_order_id: order.id, p_state: "payment_failed" });
      throw new Error("Card payment is temporarily unavailable. Your cart has been preserved.");
    }
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

export async function cleanupExpiredCheckouts(): Promise<number> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc("expire_stale_checkout_orders");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
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

async function resolveDeliveryFee(zip: string | undefined, subtotal: number): Promise<number> {
  const supabase = createServiceRoleSupabaseClient();
  if (supabase && zip) {
    const { data } = await supabase
      .from("delivery_zones")
      .select("local_delivery_eligible, delivery_fee, free_delivery_over")
      .eq("zip", zip.slice(0, 5))
      .single();
    if (data) {
      if (!data.local_delivery_eligible) return 0;
      if (data.free_delivery_over > 0 && subtotal >= Number(data.free_delivery_over)) return 0;
      return Number(data.delivery_fee);
    }
    return 0;
  }
  // Seeded path mirrors the DB table.
  const zone = resolveZone(zip);
  return zone ? localDeliveryFee(zone, subtotal) : 0;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export type { FulfillmentMethod };
