"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { approveDealerApplication, recordEpa608Sighting, recordLicenseVerification, transitionDealerApplication } from "@/lib/backend/dealer-review";
import type { DealerApplicationStatus } from "@/lib/dealer-application-state";

const STATUS_VALUES = ["draft", "submitted", "needs_information", "under_review", "approved", "rejected", "withdrawn"] as const;
const PRICE_TIERS = ["standard", "preferred", "volume"] as const;

const reviewActionSchema = z.object({
  applicationId: z.uuid(),
  decision: z.enum(STATUS_VALUES),
  reason: z.string().trim().min(3).max(240),
});

const approvalActionSchema = z.object({
  applicationId: z.uuid(),
  priceTier: z.enum(PRICE_TIERS),
});

function returnToQueue(message: string, tone: "success" | "error"): never {
  revalidatePath("/admin/dealers");
  redirect(`/admin/dealers?notice=${encodeURIComponent(message)}&tone=${tone}`);
}

export async function reviewDealerApplicationAction(formData: FormData): Promise<void> {
  const parsed = reviewActionSchema.safeParse({
    applicationId: String(formData.get("applicationId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success || parsed.data.decision === "approved") {
    returnToQueue("Choose an allowed review state and enter an audit note.", "error");
  }
  try {
    await transitionDealerApplication(
      parsed.data.applicationId,
      parsed.data.decision as DealerApplicationStatus,
      parsed.data.reason
    );
  } catch {
    returnToQueue("The application changed or the update could not be saved. Reload the queue and try again.", "error");
  }
  returnToQueue("Application status updated and recorded in its audit history.", "success");
}

export async function approveDealerApplicationAction(formData: FormData): Promise<void> {
  const parsed = approvalActionSchema.safeParse({
    applicationId: String(formData.get("applicationId") ?? ""),
    priceTier: String(formData.get("priceTier") ?? ""),
  });
  if (!parsed.success) returnToQueue("Choose a valid price tier before approval.", "error");
  try {
    await approveDealerApplication(parsed.data.applicationId, parsed.data.priceTier);
  } catch {
    returnToQueue("Approval could not be completed. Reload the queue and verify the application state.", "error");
  }
  returnToQueue("Application approved; the account, membership, price tier, and audit event were updated together.", "success");
}

const licenseCheckSchema = z.object({
  applicationId: z.uuid(),
  classification: z.string().trim().toUpperCase().regex(/^[A-Z]-?[0-9]{0,2}$/, "Use the board's class code, e.g. C-20, C-38 or B."),
  confirmed: z.literal("yes"),
});

export async function recordLicenseCheckAction(formData: FormData): Promise<void> {
  const parsed = licenseCheckSchema.safeParse({
    applicationId: String(formData.get("applicationId") ?? ""),
    classification: String(formData.get("classification") ?? ""),
    confirmed: String(formData.get("confirmed") ?? ""),
  });
  if (!parsed.success) returnToQueue("Enter the license class (for example C-20) and confirm you checked it with the board.", "error");
  try {
    await recordLicenseVerification(parsed.data.applicationId, parsed.data.classification);
  } catch {
    returnToQueue("The license check could not be recorded. Reload the queue and try again.", "error");
  }
  returnToQueue("License check recorded in the audit history.", "success");
}

const epa608Schema = z.object({
  applicationId: z.uuid(),
  type: z.enum(["type_i", "type_ii", "type_iii", "universal"]),
  certificateNumber: z.string().trim().min(4).max(40),
});

export async function recordEpa608Action(formData: FormData): Promise<void> {
  const parsed = epa608Schema.safeParse({
    applicationId: String(formData.get("applicationId") ?? ""),
    type: String(formData.get("type") ?? ""),
    certificateNumber: String(formData.get("certificateNumber") ?? ""),
  });
  if (!parsed.success) returnToQueue("Choose the certification type and enter the certificate number from the card.", "error");
  try {
    await recordEpa608Sighting(parsed.data.applicationId, parsed.data.type, parsed.data.certificateNumber);
  } catch {
    returnToQueue("The EPA 608 sighting could not be recorded. Reload the queue and try again.", "error");
  }
  returnToQueue("EPA 608 card recorded as sighted.", "success");
}
