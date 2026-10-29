"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/backend/auth";
import { setFlash } from "@/lib/backend/admin-flash";
import { completePrivacyRequest, erasePersonalData, PrivacyRequestError } from "@/lib/backend/privacy-requests";

const PATH = "/admin/privacy";

async function flash(tone: "success" | "danger", text: string) {
  await setFlash(PATH, { tone, text });
  revalidatePath(PATH);
}

async function staff() {
  const profile = await requireStaff(PATH);
  return { userId: profile.userId, name: profile.name || profile.email || "Staff" };
}

async function failed(error: unknown) {
  if (!(error instanceof PrivacyRequestError)) console.error("[privacy admin]", error);
  await flash("danger", error instanceof PrivacyRequestError ? error.message : "That didn't go through, and nothing changed.");
}

export async function eraseAction(form: FormData): Promise<void> {
  const who = await staff();
  const parsed = z.object({ requestId: z.uuid(), typedEmail: z.string().trim().min(3).max(254) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return flash("danger", "Type the person's email to confirm the erasure.");
  try {
    const counts = await erasePersonalData(parsed.data.requestId, who, parsed.data.typedEmail);
    const summary = Object.entries(counts).filter(([, n]) => Number(n) > 0).map(([key, n]) => `${key.replaceAll("_", " ")}: ${n}`).join(", ");
    await flash("success", `Erased. ${summary || "No marketing or enquiry records were found."} Record the outcome and complete the request.`);
  } catch (error) {
    await failed(error);
  }
}

export async function completeAction(form: FormData): Promise<void> {
  const who = await staff();
  const parsed = z.object({ requestId: z.uuid(), status: z.enum(["completed", "rejected"]), outcome: z.string().trim().min(10).max(3000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return flash("danger", "Write the outcome the person will receive (at least a sentence).");
  try {
    const reference = await completePrivacyRequest(parsed.data.requestId, who, { status: parsed.data.status, outcome: parsed.data.outcome });
    await flash("success", `${reference} ${parsed.data.status}. The person has been emailed.`);
  } catch (error) {
    await failed(error);
  }
}
