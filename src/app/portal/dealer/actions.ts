"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/backend/auth";
import { createServiceRoleSupabaseClient } from "@/lib/backend/supabase";
import { referralPreferencesSchema } from "@/lib/referrals";

export async function saveReferralPreferences(form: FormData): Promise<void> {
  const profile = await requireUser("/portal/dealer");
  if (profile.role !== "dealer" || !profile.accountId) redirect("/portal");
  const parsed = referralPreferencesSchema.safeParse({ accepts: form.get("accepts") === "yes", paused: form.get("paused") === "yes", zips: String(form.get("zips") ?? "") });
  if (!parsed.success) redirect("/portal/dealer?referralNotice=invalid");
  const db = createServiceRoleSupabaseClient();
  if (!db) redirect("/portal/dealer?referralNotice=unavailable");
  const { data, error } = await db.from("accounts").update({
    accepts_homeowner_referrals: parsed.data.accepts,
    referral_zips: parsed.data.zips,
    referral_paused_at: parsed.data.paused ? new Date().toISOString() : null,
  }).eq("id", profile.accountId).eq("type", "dealer").eq("status", "active").not("license_verified_at", "is", null).select("id").maybeSingle();
  if (error || !data) redirect("/portal/dealer?referralNotice=unavailable");
  revalidatePath("/portal/dealer");
  revalidatePath("/admin/referrals");
  redirect("/portal/dealer?referralNotice=saved");
}
