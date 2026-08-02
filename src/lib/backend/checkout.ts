import { checkoutSchema } from "./schemas";
import { getStorefrontSku } from "@/lib/storefront/catalog";
import { getSessionProfile } from "./auth";
import { createServerSupabaseClient } from "./supabase";
import { getStripe } from "./stripe";
import { localDeliveryFee, resolveZone, WAREHOUSE, type FulfillmentMethod } from "./fulfillment";
import { estimateTax } from "./pricing";
import { clearCartSnapshot } from "./lifecycle";

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

type CheckoutResult = {
  mode: "supabase" | "seeded";
  orderId: string;
  orderNumber: string;
  subtotal: number;
  fee: number;
  tax: number;
  total: number;
  payment: "card" | "net_terms" | "freight_quote";
  clientSecret?: string;
};

function isTrade(role: string | undefined): boolean {
  return role === "dealer" || role === "installer" || role === "staff";
}

export async function placeOrder(input: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.parse(input);
  const profile = await getSessionProfile();
  const trade = isTrade(profile?.role);

  // 1. Price every line server-side, by tier.
  const lines = parsed.items.map((item) => {
    const sku = getStorefrontSku(item.skuId);
    if (!sku) throw new Error(`Unknown SKU: ${item.sku}`);
    const unit = trade ? sku.dealerPrice : sku.msrp;
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
  const tax = payment === "card" ? estimateTax(subtotal) : 0;
  const total = round(subtotal + fee + tax);

  const supabase = createServerSupabaseClient();
  const orderNumber = "SO-" + Date.now().toString(36).toUpperCase();

  // A placed order ends any pending abandoned-cart sequence (best-effort).
  if (parsed.buyerEmail) {
    void clearCartSnapshot(parsed.buyerEmail.toLowerCase()).catch(() => {});
  }

  if (!supabase) {
    // Seeded fallback: no DB. Return a simulated order so the UI flow works.
    return {
      mode: "seeded",
      orderId: `so-${Date.now()}`,
      orderNumber,
      subtotal,
      fee,
      tax,
      total,
      payment,
    };
  }

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
    })
    .select("id")
    .single();
  if (error || !order) throw new Error(error?.message ?? "Order insert failed");

  const { error: lineError } = await supabase.from("order_lines").insert(
    lines.map((l) => ({
      order_id: order.id,
      sku_id: l.skuRecord.id,
      description: `${l.title} (${l.sku})`,
      quantity: l.qty,
      unit_price: l.unitPrice,
    }))
  );
  if (lineError) throw new Error(lineError.message);

  // 6. Reserve stock (FIFO) via the public-checkout reserve function.
  await supabase.rpc("reserve_public_order", { p_order_id: order.id });

  // 7. Card payment: PaymentIntent for the order total, keyed to the order.
  let clientSecret: string | undefined;
  if (payment === "card") {
    const stripe = getStripe();
    if (stripe && total > 0) {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100),
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: { order_id: order.id, order_number: orderNumber },
      });
      clientSecret = intent.client_secret ?? undefined;
    }
  }

  return {
    mode: "supabase",
    orderId: order.id,
    orderNumber,
    subtotal,
    fee,
    tax,
    total,
    payment,
    clientSecret,
  };
}

async function resolveDeliveryFee(zip: string | undefined, subtotal: number): Promise<number> {
  const supabase = createServerSupabaseClient();
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
