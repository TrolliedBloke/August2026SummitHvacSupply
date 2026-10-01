import { dealerFormSchema } from "@/lib/forms/dealer";
import { makeReference } from "@/lib/forms/result";
import { createServiceRoleSupabaseClient } from "./supabase";
import { createServerSupabase } from "./supabase-ssr";
import { rememberedResult, rememberResult } from "./idempotency";
import { DEALER_REVIEW_SLA } from "@/lib/forms/dealer";

export type DealerReceipt = {
  reference: string;
  status: "submitted";
  duplicate: boolean;
  responseWindow: string;
  mode: "supabase" | "seeded";
};

const seededOpen = new Map<string, DealerReceipt>();

/**
 * Submit a trade application.
 *
 * - The same idempotency key returns the first receipt (a retry after a
 *   timeout creates one application, not two).
 * - An address or business that already has an open application is routed to
 *   that application -- `duplicate: true` -- instead of creating a second one.
 * - A signed-in applicant is linked by user id, so approval later links the
 *   same identity (see approve_dealer_application in migration 026).
 */
export async function submitDealerApplication(input: unknown): Promise<DealerReceipt> {
  const parsed = dealerFormSchema.parse(input);
  const replay = rememberedResult<DealerReceipt>("dealer", parsed.idempotencyKey);
  if (replay) return replay;

  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) {
    const key = parsed.email;
    const existing = seededOpen.get(key);
    const receipt = existing
      ? { ...existing, duplicate: true }
      : { reference: makeReference("D"), status: "submitted" as const, duplicate: false, responseWindow: DEALER_REVIEW_SLA, mode: "seeded" as const };
    if (!existing) seededOpen.set(key, receipt);
    rememberResult("dealer", parsed.idempotencyKey, receipt);
    return receipt;
  }

  if (parsed.idempotencyKey) {
    const { data } = await supabase.from("dealer_applications").select("reference").eq("idempotency_key", parsed.idempotencyKey).maybeSingle();
    if (data) {
      const receipt: DealerReceipt = { reference: String(data.reference), status: "submitted", duplicate: false, responseWindow: DEALER_REVIEW_SLA, mode: "supabase" };
      rememberResult("dealer", parsed.idempotencyKey, receipt);
      return receipt;
    }
  }
  const OPEN = ["submitted", "needs_information", "under_review"];
  const { data: byEmail } = await supabase
    .from("dealer_applications")
    .select("reference")
    .eq("normalized_email", parsed.email)
    .in("status", OPEN)
    .limit(1)
    .maybeSingle();
  const { data: byCompany } = byEmail
    ? { data: null }
    : await supabase.from("dealer_applications").select("reference").ilike("company", parsed.company).in("status", OPEN).limit(1).maybeSingle();
  const open = byEmail ?? byCompany;
  if (open) {
    return { reference: String(open.reference ?? ""), status: "submitted", duplicate: true, responseWindow: DEALER_REVIEW_SLA, mode: "supabase" };
  }

  const session = await createServerSupabase();
  const userId = session ? (await session.auth.getUser()).data.user?.id ?? null : null;
  const reference = makeReference("D");
  const { data: inserted, error } = await supabase
    .from("dealer_applications")
    .insert({
      reference,
      idempotency_key: parsed.idempotencyKey ?? null,
      status: "submitted",
      user_id: userId,
      company: parsed.company,
      entity_type: parsed.entityType,
      contact_name: parsed.contactName,
      email: parsed.email,
      phone: parsed.phone,
      business_type: parsed.businessType,
      license_applicable: parsed.licenseApplicable === "yes",
      license_number: parsed.licenseApplicable === "yes" ? parsed.licenseNumber : null,
      license_state: parsed.licenseApplicable === "yes" ? parsed.licenseState : null,
      tax_id_last4: parsed.taxIdLast4,
      resale_certificate_number: parsed.buysForResale === "yes" ? parsed.resaleCertificateNumber : null,
      service_area: parsed.serviceArea,
      monthly_volume: parsed.monthlyVolume,
      brands: parsed.brands || null,
      notes: parsed.notes || null,
    })
    .select("id")
    .single();
  if (error || !inserted) throw new Error(error?.message ?? "dealer application insert failed");
  await supabase.from("dealer_application_events").insert({ application_id: inserted.id, from_status: null, to_status: "submitted", actor: userId ?? "applicant" });
  const receipt: DealerReceipt = { reference, status: "submitted", duplicate: false, responseWindow: DEALER_REVIEW_SLA, mode: "supabase" };
  rememberResult("dealer", parsed.idempotencyKey, receipt);
  return receipt;
}
