import { homeownerRequestSchema, HOMEOWNER_RESPONSE_WINDOW } from "@/lib/forms/homeowner";
import { makeReference } from "@/lib/forms/result";
import { resolveFulfillmentAnswer } from "./fulfillment";
import { createServiceRoleSupabaseClient } from "./supabase";
import { rememberedResult, rememberResult } from "./idempotency";
import { assertSeededAllowed } from "./seeded";

export type HomeownerReceipt = {
  id: string;
  reference: string;
  status: "received";
  serviceArea: "route" | "outside_route" | "unknown";
  responseWindow: string;
  nextStep: string;
  duplicate: boolean;
  mode: "supabase" | "seeded";
};

const DUPLICATE_WINDOW_MS = 24 * 60 * 60_000;
const recent = new Map<string, { at: number; receipt: HomeownerReceipt }>();

/**
 * Store a homeowner request as typed fields, routed to the homeowner desk with
 * a reference and a `received` lifecycle event. A resend of the same draft
 * (same client request id) or the same person and ZIP within a day returns the
 * existing request instead of creating a second one.
 */
export async function createHomeownerRequest(input: unknown): Promise<HomeownerReceipt> {
  const parsed = homeownerRequestSchema.parse(input);
  const replay = rememberedResult<HomeownerReceipt>("homeowner", parsed.clientRequestId);
  if (replay) return replay;

  const answer = resolveFulfillmentAnswer(parsed.zip);
  const serviceArea = answer.kind === "eligible" ? "route" : answer.kind === "ineligible" ? "outside_route" : "unknown";
  const nextStep =
    serviceArea === "route"
      ? "We review your details, suggest the equipment lane, and introduce a qualified installer who works your area."
      : "You are outside our delivery routes. We can still advise on equipment and freight or will-call, but installer introductions may not be available.";
  const dedupeKey = `${parsed.email}|${parsed.zip}`;

  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    // Two plain filters rather than one .or() string: an email address can
    // contain characters that PostgREST's filter grammar would misread.
    const byKey = parsed.clientRequestId
      ? await supabase.from("homeowner_requests").select("id, reference, service_area").eq("client_request_id", parsed.clientRequestId).maybeSingle()
      : { data: null };
    const byPerson = byKey.data
      ? { data: null }
      : await supabase
          .from("homeowner_requests")
          .select("id, reference, service_area")
          .eq("email", parsed.email)
          .eq("zip", parsed.zip)
          .gte("created_at", since)
          .limit(1)
          .maybeSingle();
    const existing = byKey.data ?? byPerson.data;
    if (existing) {
      const receipt: HomeownerReceipt = {
        id: String(existing.id),
        reference: String(existing.reference),
        status: "received",
        serviceArea: existing.service_area as HomeownerReceipt["serviceArea"],
        responseWindow: HOMEOWNER_RESPONSE_WINDOW,
        nextStep,
        duplicate: true,
        mode: "supabase",
      };
      rememberResult("homeowner", parsed.clientRequestId, receipt);
      return receipt;
    }
    const reference = makeReference("H");
    const { data, error } = await supabase
      .from("homeowner_requests")
      .insert({
        reference,
        client_request_id: parsed.clientRequestId ?? null,
        zip: parsed.zip,
        city: parsed.city,
        home_type: parsed.homeType,
        zones: parsed.zones,
        existing_ducts: parsed.existingDucts,
        rebate_interest: parsed.rebateInterest,
        timeline: parsed.timeline,
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone || null,
        consent_to_contact: parsed.consent,
        service_area: serviceArea,
        notes: parsed.notes || null,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "homeowner request insert failed");
    await supabase.from("homeowner_request_events").insert({ request_id: data.id, from_status: null, to_status: "received", actor: "system" });
    const receipt: HomeownerReceipt = { id: String(data.id), reference, status: "received", serviceArea, responseWindow: HOMEOWNER_RESPONSE_WINDOW, nextStep, duplicate: false, mode: "supabase" };
    rememberResult("homeowner", parsed.clientRequestId, receipt);
    return receipt;
  }

  const prior = recent.get(dedupeKey);
  if (prior && Date.now() - prior.at < DUPLICATE_WINDOW_MS) return { ...prior.receipt, duplicate: true };
  assertSeededAllowed("homeowner request");
  const receipt: HomeownerReceipt = {
    id: `homeowner-${Date.now()}`,
    reference: makeReference("H"),
    status: "received",
    serviceArea,
    responseWindow: HOMEOWNER_RESPONSE_WINDOW,
    nextStep,
    duplicate: false,
    mode: "seeded",
  };
  recent.set(dedupeKey, { at: Date.now(), receipt });
  rememberResult("homeowner", parsed.clientRequestId, receipt);
  return receipt;
}
