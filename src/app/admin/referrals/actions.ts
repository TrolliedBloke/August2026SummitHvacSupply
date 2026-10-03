"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/backend/auth";
import { createServiceRoleSupabaseClient } from "@/lib/backend/supabase";
import { REFERRAL_OUTCOMES } from "@/lib/referrals";

export async function introduceInstaller(form: FormData): Promise<void> {
  const staff = await requireStaff("/admin/referrals");
  const parsed = z.object({ requestId: z.uuid(), accountId: z.uuid(), confirmed: z.literal("yes") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/admin/referrals?notice=invalid");
  const db = createServiceRoleSupabaseClient();
  if (!db) redirect("/admin/referrals?notice=unavailable");
  const { error } = await db.rpc("introduce_installer", { p_request_id: parsed.data.requestId, p_account_id: parsed.data.accountId, p_actor: staff.userId });
  if (error) redirect("/admin/referrals?notice=unavailable");
  revalidatePath("/admin/referrals");
  redirect("/admin/referrals?notice=saved");
}

export async function recordReferralOutcome(form: FormData): Promise<void> {
  const staff = await requireStaff("/admin/referrals");
  const parsed = z.object({ referralId: z.uuid(), outcome: z.enum(REFERRAL_OUTCOMES), notes: z.string().trim().max(1000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/admin/referrals?notice=invalid");
  const db = createServiceRoleSupabaseClient();
  if (!db) redirect("/admin/referrals?notice=unavailable");
  const { error } = await db.rpc("record_referral_outcome", { p_referral_id: parsed.data.referralId, p_outcome: parsed.data.outcome, p_notes: parsed.data.notes, p_actor: staff.userId });
  if (error) redirect("/admin/referrals?notice=unavailable");
  revalidatePath("/admin/referrals");
  redirect("/admin/referrals?notice=saved");
}
