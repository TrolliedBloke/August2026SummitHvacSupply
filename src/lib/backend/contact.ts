import { contactFormSchema, type ContactForm } from "@/lib/forms/contact";
import { contactTopic } from "@/lib/contact-topics";
import { makeReference } from "@/lib/forms/result";
import { getStorefrontSku } from "@/lib/storefront/catalog";
import { createServiceRoleSupabaseClient } from "./supabase";
import { rememberedResult, rememberResult } from "./idempotency";

export type ContactReceipt = {
  id: string;
  reference: string;
  topic: string;
  queue: string;
  responseWindow: string;
  urgentPath: string | null;
  mode: "supabase" | "seeded";
};

/**
 * Store one contact request with its structured context and routing.
 *
 * - The SKU is resolved to the catalog's canonical SKU, or dropped.
 * - A retry with the same client request id returns the first receipt.
 * - Urgent is only accepted on topics that support it, and its "fast path" is
 *   the phone -- never a promise of a faster written reply.
 *
 * Public form writes use the SERVICE ROLE so migration 017 can revoke anon
 * INSERT: this function is the only way in.
 */
export async function createContactRequest(input: unknown): Promise<ContactReceipt> {
  const parsed: ContactForm = contactFormSchema.parse(input);
  const previous = rememberedResult<ContactReceipt>("contact", parsed.clientRequestId);
  if (previous) return previous;

  const topic = contactTopic(parsed.topic)!;
  const sku = parsed.sku ? getStorefrontSku(parsed.sku)?.sku ?? null : null;
  const urgent = Boolean(parsed.urgent && topic.allowsUrgent);
  const reference = makeReference("C");
  const sourceUrl = parsed.sourceUrl?.startsWith("/") ? parsed.sourceUrl.slice(0, 300) : null;
  const receipt: Omit<ContactReceipt, "id" | "mode"> = {
    reference,
    topic: topic.value,
    queue: topic.queue,
    responseWindow: topic.responseWindow,
    urgentPath: urgent ? "Call the counter for anything that cannot wait." : null,
  };

  const supabase = createServiceRoleSupabaseClient();
  if (supabase) {
    if (parsed.clientRequestId) {
      const { data: existing } = await supabase
        .from("contact_requests")
        .select("id, reference")
        .eq("client_request_id", parsed.clientRequestId)
        .maybeSingle();
      if (existing) {
        const replay = { ...receipt, id: String(existing.id), reference: String(existing.reference ?? reference), mode: "supabase" as const };
        rememberResult("contact", parsed.clientRequestId, replay);
        return replay;
      }
    }
    const id = crypto.randomUUID();
    const structured = {
      id,
      topic: topic.value,
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      message: parsed.message,
      reference,
      queue: topic.queue,
      urgency: urgent ? "urgent" : "standard",
      sku,
      order_ref: parsed.orderRef || null,
      branch_id: parsed.branchId ?? null,
      zip: parsed.zip || null,
      source_url: sourceUrl,
      client_request_id: parsed.clientRequestId ?? null,
    };
    let { error } = await supabase.from("contact_requests").insert(structured);
    // Structured context columns arrive with migration 027. Until it runs,
    // keep accepting requests with the context folded into the message rather
    // than failing the customer's submission.
    if (error && (error.code === "42703" || error.code === "PGRST204")) {
      const context = [sku && `SKU: ${sku}`, parsed.orderRef && `Order: ${parsed.orderRef}`, parsed.zip && `ZIP: ${parsed.zip}`, `Ref: ${reference}`]
        .filter(Boolean)
        .join("\n");
      ({ error } = await supabase.from("contact_requests").insert({
        id,
        topic: topic.value,
        name: parsed.name,
        email: parsed.email.toLowerCase(),
        message: `${parsed.message}\n\n${context}`,
      }));
    }
    if (error) throw new Error(error.message);
    const stored = { ...receipt, id, mode: "supabase" as const };
    rememberResult("contact", parsed.clientRequestId, stored);
    return stored;
  }

  const seeded = { ...receipt, id: `contact-${Date.now()}`, mode: "seeded" as const };
  rememberResult("contact", parsed.clientRequestId, seeded);
  return seeded;
}
