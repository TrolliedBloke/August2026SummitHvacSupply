import "server-only";
import { createServiceRoleSupabaseClient } from "./supabase";
import { sendShippedEmail } from "./email";
import { SITE } from "@/lib/site";
import { skuMedia } from "@/lib/media";
import { getStorefrontSku } from "@/lib/storefront/catalog";
import { ZONES } from "./fulfillment";
import { EXPORT_PAGE_SIZE, EXPORT_WINDOW_SLACK_MS, trackingUrl, type ExportOrder, type ShipNotice } from "@/lib/shipstation/custom-store";

/**
 * The database side of the ShipStation Custom Store integration.
 *
 * Export: orders ready to fulfil -- card orders once Stripe has marked them
 * paid, and confirmed net-terms orders, which ship on account before payment
 * (docs/PIPELINE-ARCHITECTURE-PLAN.md: "pay before you ship" applies to card).
 * Cancelled orders that were once exportable are sent as cancelled so
 * ShipStation drops them.
 *
 * Ship notice: record_external_shipment (migration 038) records the shipment
 * and its inventory movements exactly once per tracking number; the buyer of a
 * delivered order then gets one "shipped" email.
 */

export class ShipStationUnavailableError extends Error {}

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  checkout_updated_at: string | null;
  status: string;
  paid: boolean | null;
  payment_mode: string | null;
  checkout_state: string | null;
  fulfillment_method: string | null;
  fulfillment_window: string | null;
  fulfillment_fee: number | string | null;
  subtotal: number | string | null;
  total: number | string | null;
  delivery_address: string | null;
  delivery_zip: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_company: string | null;
  po_number: string | null;
  hold_reason?: string | null;
};

type LineRow = { order_id: string; description: string | null; quantity: number; unit_price: number | string | null; catalog_product_id: string | null };

const num = (value: number | string | null | undefined) => Number(value ?? 0) || 0;

/**
 * Card orders need Stripe's captured payment (an `authorized` card is not paid;
 * the counter captures it after confirming stock); net-terms orders ship once
 * confirmed. Held orders (hold_reason, migration 039) are still exported, as
 * on_hold, so an order ShipStation already imported cannot be shipped by
 * mistake while staff decide.
 */
export function readyToFulfil(order: Pick<OrderRow, "paid" | "payment_mode" | "checkout_state">): boolean {
  return Boolean(order.paid) || (order.payment_mode === "net_terms" && order.checkout_state === "confirmed");
}

/** Our own status for ShipStation. A hold outranks everything but shipped. */
export function exportStatus(order: Pick<OrderRow, "status" | "checkout_state" | "hold_reason">): ExportOrder["status"] {
  if (order.status === "shipped") return "shipped";
  if (order.hold_reason || order.checkout_state === "paid_needs_review") return "on_hold";
  return order.status === "cancelled" ? "cancelled" : "paid";
}

/** City and state for the ship-to: the branch for pickup, the route zone for local delivery, unknown for freight. */
function shipToPlace(order: Pick<OrderRow, "fulfillment_method" | "delivery_zip">): { city: string | null; state: string | null } {
  if (order.fulfillment_method === "pickup") return { city: SITE.address.city, state: SITE.address.state };
  const zone = order.fulfillment_method === "local_delivery" ? ZONES.find((entry) => entry.zip === (order.delivery_zip ?? "").trim()) : undefined;
  return zone ? { city: zone.label, state: "CA" } : { city: null, state: null };
}

const METHOD_LABEL: Record<string, string> = { pickup: "Will-call pickup (Newark)", local_delivery: "Local delivery", freight: "Freight" };

export function toExportOrder(order: OrderRow, lines: LineRow[]): ExportOrder {
  const subtotal = num(order.subtotal);
  const shipping = num(order.fulfillment_fee);
  const total = num(order.total);
  const pickup = order.fulfillment_method === "pickup";
  return {
    id: order.id,
    number: order.order_number,
    createdAt: order.created_at,
    lastModified: [order.created_at, order.checkout_updated_at].filter((value): value is string => Boolean(value)).sort().at(-1)!,
    status: exportStatus(order),
    shippingMethod: `${METHOD_LABEL[order.fulfillment_method ?? ""] ?? "Ship"}${order.fulfillment_window ? ` · ${order.fulfillment_window}` : ""}`,
    paymentMethod: order.payment_mode === "net_terms" ? "Net terms" : "Card (Stripe)",
    total,
    tax: Math.max(0, total - subtotal - shipping),
    shipping,
    internalNotes: [
      order.hold_reason && `ON HOLD: ${order.hold_reason}`,
      order.po_number && `PO ${order.po_number}`,
      order.payment_mode === "net_terms" && !order.paid && "On account: not yet paid",
      !pickup && !shipToPlace(order).city && "Address is free text: confirm city and state before buying a label",
    ].filter(Boolean).join(" · ") || null,
    customer: { email: order.buyer_email, name: order.buyer_name, company: order.buyer_company, phone: order.buyer_phone },
    shipTo: {
      name: order.buyer_name,
      company: order.buyer_company,
      // The jobsite address is one free-text field; ShipStation's address
      // check flags anything it cannot parse, rather than us guessing a city.
      address1: pickup ? `Will-call pickup, ${SITE.address.street}` : order.delivery_address,
      ...shipToPlace(order),
      postalCode: pickup ? SITE.address.zip : order.delivery_zip,
      phone: order.buyer_phone,
      country: "US",
    },
    items: lines.map((line) => {
      const sku = line.catalog_product_id ? getStorefrontSku(line.catalog_product_id) : undefined;
      const media = sku ? skuMedia(sku) : null;
      const verified = media && (media.verification === "verifiedExact" || media.verification === "verifiedFamily");
      return {
        sku: sku?.sku ?? line.description?.match(/\(([^)]+)\)\s*$/)?.[1] ?? line.catalog_product_id ?? "ITEM",
        name: line.description ?? sku?.title ?? "Item",
        quantity: line.quantity,
        unitPrice: num(line.unit_price),
        weightLbs: sku?.weightLbs ?? null,
        imageUrl: verified && media.primarySrc ? `${SITE.origin}${media.primarySrc}` : null,
      };
    }),
  };
}

export async function exportOrders(start: Date | null, end: Date | null, page: number): Promise<{ orders: ExportOrder[]; pages: number }> {
  const db = createServiceRoleSupabaseClient();
  if (!db) throw new ShipStationUnavailableError("Supabase service role is not configured.");
  const from = new Date((start ?? new Date(Date.now() - 7 * 86_400_000)).getTime() - EXPORT_WINDOW_SLACK_MS).toISOString();
  const to = new Date((end ?? new Date()).getTime() + EXPORT_WINDOW_SLACK_MS).toISOString();

  const { data, error } = await db
    .from("sales_orders")
    .select(
      "id, order_number, created_at, checkout_updated_at, status, paid, payment_mode, checkout_state, fulfillment_method, fulfillment_window, fulfillment_fee, subtotal, total, delivery_address, delivery_zip, buyer_name, buyer_email, buyer_phone, buyer_company, po_number, hold_reason"
    )
    // Quoted: a timestamp's "." and ":" must not be read as filter syntax.
    .or(`created_at.gte."${from}",checkout_updated_at.gte."${from}"`)
    .lte("created_at", to)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) throw new ShipStationUnavailableError(`Could not read orders: ${error.message}`);

  const eligible = ((data ?? []) as OrderRow[]).filter(readyToFulfil);
  const pages = Math.max(1, Math.ceil(eligible.length / EXPORT_PAGE_SIZE));
  const slice = eligible.slice((Math.max(1, page) - 1) * EXPORT_PAGE_SIZE, Math.max(1, page) * EXPORT_PAGE_SIZE);
  if (slice.length === 0) return { orders: [], pages };

  const { data: lineRows, error: lineError } = await db
    .from("order_lines")
    .select("order_id, description, quantity, unit_price, catalog_product_id")
    .in("order_id", slice.map((order) => order.id));
  if (lineError) throw new ShipStationUnavailableError(`Could not read order lines: ${lineError.message}`);
  const linesByOrder = new Map<string, LineRow[]>();
  for (const line of (lineRows ?? []) as LineRow[]) linesByOrder.set(line.order_id, [...(linesByOrder.get(line.order_id) ?? []), line]);

  return { orders: slice.map((order) => toExportOrder(order, linesByOrder.get(order.id) ?? [])), pages };
}

/** needs_review: shipped while unpaid, cancelled or on hold (migration 042); staff are alerted and the buyer is not emailed. */
export type ShipmentResult = { status: "recorded" | "duplicate" | "not_found" | "needs_review"; emailed: boolean };

export async function recordShipment(notice: ShipNotice): Promise<ShipmentResult> {
  const db = createServiceRoleSupabaseClient();
  if (!db) throw new ShipStationUnavailableError("Supabase service role is not configured.");
  const { data, error } = await db.rpc("record_external_shipment", {
    p_order_number: notice.orderNumber,
    p_carrier: notice.carrier,
    p_service: notice.service,
    p_tracking: notice.trackingNumber,
    p_shipped_at: notice.shipDate?.toISOString() ?? null,
  });
  if (error?.code === "P0002") return { status: "not_found", emailed: false };
  if (error) throw new ShipStationUnavailableError(`Could not record shipment: ${error.message}`);

  const result = data as { order_id: string; duplicate: boolean; needs_review?: boolean; method?: string; buyer_email?: string | null; buyer_name?: string | null };
  if (result.duplicate) return { status: "duplicate", emailed: false };
  if (result.needs_review) return { status: "needs_review", emailed: false };
  if (result.method === "pickup" || !result.buyer_email) return { status: "recorded", emailed: false };

  await sendShippedEmail({
    to: result.buyer_email,
    name: result.buyer_name ?? null,
    orderId: result.order_id,
    orderNumber: notice.orderNumber,
    carrier: [notice.carrier, notice.service].filter(Boolean).join(" ") || null,
    trackingNumber: notice.trackingNumber,
    trackingUrl: trackingUrl(notice.carrier, notice.trackingNumber),
  });
  return { status: "recorded", emailed: true };
}
