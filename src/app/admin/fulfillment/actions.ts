"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/backend/auth";
import { setFlash } from "@/lib/backend/admin-flash";
import { advanceFulfillment } from "@/lib/backend/operations";
import { cancelOrder, captureAuthorizedOrder, PaymentActionError, refundHeldOrder, releaseOrderHold } from "@/lib/backend/payments";

/**
 * Fulfilment decisions (docs/LIABILITY-REMEDIATION-PLAN.md, 1.1, 1.3, 1.6,
 * 3.7). Every one needs a staff session, and every money movement goes
 * through src/lib/backend/payments.ts, which audits it and emails the buyer.
 * Results come back as a one-time message on the page, never as a thrown
 * error.
 */

const PATH = "/admin/fulfillment";
const id = z.uuid();

async function done(text: string): Promise<void> {
  await setFlash(PATH, { tone: "success", text });
  revalidatePath(PATH);
}

async function refuse(text: string): Promise<void> {
  await setFlash(PATH, { tone: "danger", text });
  revalidatePath(PATH);
}

/** Our own messages (and the database's gate messages) are safe to show; anything else is logged. */
async function failed(error: unknown): Promise<void> {
  const known = error instanceof PaymentActionError || (error instanceof Error && /^(Cannot advance|Record who|Cancel the order)/.test(error.message));
  if (!known) console.error("[fulfilment action]", error);
  await refuse(known ? (error as Error).message : "That didn't go through, and nothing changed. Try again, or check the logs.");
}

async function staff() {
  const profile = await requireStaff(PATH);
  return { userId: profile.userId, name: profile.name ?? profile.email ?? "Staff" };
}

export async function captureAction(form: FormData): Promise<void> {
  const who = await staff();
  const parsed = z.object({ orderId: id, stockConfirmed: z.literal("on") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return refuse("Tick “stock is on the shelf” before charging the card.");
  try {
    await captureAuthorizedOrder(parsed.data.orderId, who);
  } catch (error) {
    return failed(error);
  }
  return done("Card charged. The buyer has been emailed.");
}

export async function cancelAction(form: FormData): Promise<void> {
  const who = await staff();
  const parsed = z.object({ orderId: id, reason: z.string().trim().min(5).max(500) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return refuse("Give the buyer a reason (at least a few words). It goes in their email.");
  try {
    await cancelOrder(parsed.data.orderId, who, parsed.data.reason);
  } catch (error) {
    return failed(error);
  }
  return done("Order cancelled. Nothing was charged, and the buyer has been emailed.");
}

export async function releaseHoldAction(form: FormData): Promise<void> {
  const who = await staff();
  const parsed = z
    .object({ orderId: id, note: z.string().trim().min(5).max(300), stockConfirmed: z.literal("on") })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return refuse("Write why it can proceed, and confirm the stock is on the shelf.");
  try {
    await releaseOrderHold(parsed.data.orderId, who, parsed.data.note);
  } catch (error) {
    return failed(error);
  }
  return done("Hold released.");
}

export async function refundHeldAction(form: FormData): Promise<void> {
  const who = await staff();
  const parsed = z.object({ orderId: id, reason: z.string().trim().min(5).max(500) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return refuse("Give the buyer a reason for the refund.");
  try {
    await refundHeldOrder(parsed.data.orderId, who, parsed.data.reason);
  } catch (error) {
    return failed(error);
  }
  return done("Refunded in full. The buyer has been emailed.");
}

export async function advanceAction(form: FormData): Promise<void> {
  await staff();
  const parsed = z
    .object({
      orderId: id,
      status: z.enum(["pending", "ready_for_pickup", "out_for_delivery", "delivered", "picked_up"]),
      collectedBy: z.string().trim().max(200).optional(),
      idChecked: z.literal("on").optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return refuse("That status change wasn't valid.");
  const { orderId, status, collectedBy, idChecked } = parsed.data;
  try {
    await advanceFulfillment(orderId, status, status === "picked_up" ? { collectedBy: collectedBy ?? "", idChecked: idChecked === "on" } : undefined);
  } catch (error) {
    return failed(error);
  }
  return done("Updated.");
}
