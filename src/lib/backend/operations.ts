"use server";

import { createServerSupabase } from "./supabase-ssr";
import { getSessionProfile } from "./auth";

/**
 * Operational mutations. Each calls a Postgres RPC AS THE SIGNED-IN USER, so
 * the in-database staff guard (assert_staff) and RLS both apply. The app never
 * decides authorization on its own.
 */

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const profile = await getSessionProfile();
  if (!profile) throw new Error("Not signed in");

  const supabase = await createServerSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function convertQuoteToOrder(quoteId: string): Promise<string> {
  const orderId = await rpc<string>("convert_quote_to_order", { p_quote_id: quoteId });
  void import("./email").then((m) => m.sendOrderConfirmation(orderId)).catch(() => {});
  return orderId;
}

export async function reserveOrder(orderId: string): Promise<void> {
  await rpc("reserve_order", { p_order_id: orderId });
}

export async function shipOrder(
  orderId: string,
  carrier?: string,
  tracking?: string
): Promise<string> {
  return rpc<string>("ship_order", {
    p_order_id: orderId,
    p_carrier: carrier ?? null,
    p_tracking: tracking ?? null,
  });
}

export async function receivePurchaseOrder(poId: string, warehouseId: string): Promise<string> {
  return rpc<string>("receive_purchase_order", {
    p_po_id: poId,
    p_warehouse_id: warehouseId,
  });
}

export async function adjustInventory(lotId: string, delta: number, note?: string): Promise<void> {
  await rpc("adjust_inventory", { p_lot_id: lotId, p_delta: delta, p_note: note ?? null });
}

export async function invoiceOrder(orderId: string, dueDate?: string): Promise<string> {
  const invoiceId = await rpc<string>("invoice_order", {
    p_order_id: orderId,
    p_due_date: dueDate ?? null,
  });
  // Fire-and-forget confirmation (Phase 4). Never blocks the mutation.
  void import("./email").then((m) => m.sendInvoiceEmail(invoiceId)).catch(() => {});
  return invoiceId;
}

/** Advance an order's pickup/delivery status (staff only; enforced in DB). */
export async function advanceFulfillment(
  orderId: string,
  status: string,
  pickup?: { collectedBy: string; idChecked: boolean }
): Promise<void> {
  // The database refuses unpaid, held or cancelled orders and a pickup with
  // no collector or ID check (migration 043).
  await rpc("advance_fulfillment", {
    p_order_id: orderId,
    p_status: status,
    p_collected_by: pickup?.collectedBy ?? null,
    p_id_checked: pickup?.idChecked ?? false,
  });
}

/** Manual (non-Stripe) payment, e.g. a check at the counter. */
export async function recordManualPayment(
  invoiceId: string,
  amount: number,
  method: string,
  reference?: string
): Promise<string> {
  return rpc<string>("apply_payment", {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_method: method,
    p_reference: reference ?? null,
    p_stripe_event_id: null,
  });
}
