"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/backend/auth";
import { setFlash } from "@/lib/backend/admin-flash";
import { decideReturn, openReturnForCaller, ReturnRejectedError, type ReturnDecision } from "@/lib/backend/returns";
import { updateWarrantyClaim, WarrantyUnavailableError, type WarrantyUpdate } from "@/lib/backend/warranty";

/**
 * Returns and warranty decisions (docs/LIABILITY-REMEDIATION-PLAN.md, 2.2,
 * 2.3, 2.5). Each needs a staff session, is logged with the staff member, and
 * tells the customer by email when it changes something for them.
 */

const PATH = "/admin/returns";
const text = (min: number, max: number) => z.string().trim().min(min).max(max);

async function flash(tone: "success" | "danger", message: string) {
  await setFlash(PATH, { tone, text: message });
  revalidatePath(PATH);
}

async function staff() {
  const profile = await requireStaff(PATH);
  return { userId: profile.userId, name: profile.name || profile.email || "Staff" };
}

async function failed(error: unknown) {
  const known = error instanceof ReturnRejectedError || error instanceof WarrantyUnavailableError;
  if (!known) console.error("[returns admin]", error);
  await flash("danger", known ? (error as Error).message : "That didn't go through, and nothing changed. Try again, or check the logs.");
}

const decisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), note: text(3, 1000) }),
  z.object({ action: z.literal("request_info"), message: text(5, 2000) }),
  z.object({ action: z.literal("received"), note: text(0, 1000) }),
  z.object({ action: z.literal("refund"), amount: z.coerce.number().positive().max(100_000), note: text(3, 500) }),
  z.object({ action: z.literal("decline"), reason: text(5, 1000) }),
  z.object({ action: z.literal("close"), reason: text(3, 1000) }),
]);

export async function decideReturnAction(form: FormData): Promise<void> {
  const who = await staff();
  const rmaId = z.uuid().safeParse(form.get("rmaId"));
  const decision = decisionSchema.safeParse(Object.fromEntries(form));
  if (!rmaId.success || !decision.success) return flash("danger", "Fill in the note or reason for that action (it may be emailed to the customer).");
  try {
    const rma = await decideReturn(rmaId.data, who, decision.data as ReturnDecision);
    await flash("success", `${rma} updated.`);
  } catch (error) {
    await failed(error);
  }
}

const callerSchema = z.object({
  orderNumber: text(3, 40),
  lineId: z.uuid(),
  quantity: z.coerce.number().int().min(1).max(1000),
  reason: z.enum(["wrong_item", "damaged", "defective", "changed_mind", "ordered_wrong", "job_cancelled"]),
  installed: z.enum(["yes", "no"]),
  damaged: z.enum(["yes", "no"]),
  notes: text(0, 2000),
});

export async function openCallerReturnAction(form: FormData): Promise<void> {
  const who = await staff();
  const parsed = callerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return flash("danger", "Choose the line, quantity and reason, and answer both questions.");
  const { orderNumber, lineId, quantity, reason, installed, damaged, notes } = parsed.data;
  try {
    // Staff record what the caller said; the remaining policy facts are left
    // for the review, so the RMA is opened for staff to decide.
    const result = await openReturnForCaller(who, orderNumber, {
      lineId,
      quantity,
      reason,
      facts: damaged === "yes" ? { arrivedDamagedOrWrong: true, damageNotedOnReceipt: false, daysSinceDelivery: 0 } : { arrivedDamagedOrWrong: false, installed: installed === "yes", specialOrder: false, openedRefrigerant: false, opened: true, daysSinceDelivery: 0 },
      notes: notes || undefined,
    });
    await flash("success", `Opened ${result.rmaNumber}. The customer has been emailed an acknowledgement.`);
  } catch (error) {
    await failed(error);
  }
}

const warrantySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("note"), note: text(2, 2000) }),
  z.object({ action: z.literal("request_info"), message: text(5, 2000) }),
  z.object({ action: z.literal("with_manufacturer"), note: text(3, 1000) }),
  z.object({ action: z.literal("close"), resolution: text(5, 1000) }),
]);

export async function updateWarrantyAction(form: FormData): Promise<void> {
  const who = await staff();
  const claimId = z.uuid().safeParse(form.get("claimId"));
  const update = warrantySchema.safeParse(Object.fromEntries(form));
  if (!claimId.success || !update.success) return flash("danger", "Fill in the note for that action (it may be emailed to the customer).");
  try {
    const claim = await updateWarrantyClaim(claimId.data, who, update.data as WarrantyUpdate);
    await flash("success", `${claim} updated.`);
  } catch (error) {
    await failed(error);
  }
}
