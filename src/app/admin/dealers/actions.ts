"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { approveDealerApplication, transitionDealerApplication } from "@/lib/backend/dealer-review";
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
