import "server-only";
import { Resend } from "resend";
import { createServiceRoleSupabaseClient } from "./supabase";
import { makeReference } from "@/lib/forms/result";
import { SITE } from "@/lib/site";
import {
  deliveryStatusFor,
  htmlToText,
  isAutomated,
  MAX_INBOUND_MESSAGE,
  parseSender,
  routeInbound,
  shouldReplaceDelivery,
  stripQuotedReply,
} from "@/lib/support/inbound";

/**
 * Resend webhook handling (docs/PIPELINE-ARCHITECTURE-PLAN.md, F3).
 *
 * email.received -> a contact_requests row (channel 'email'), which the
 * auto-task trigger (migration 038) turns into a staff task and the customer
 * view shows under the sender. Each provider message is stored once.
 *
 * email.delivered / bounced / opened / ... -> email_messages.delivery_status
 * for the send with that provider id, so the customer view shows whether an
 * email arrived.
 */

export class SupportInboxUnavailableError extends Error {}

/** Mail from these domains is ours (our own sends, forwards, loops). */
function ownDomains(): string[] {
  const fromDomain = (process.env.EMAIL_FROM ?? "").match(/@([^>\s]+)/)?.[1];
  const siteDomain = new URL(SITE.origin).hostname.replace(/^www\./, "");
  return Array.from(new Set([fromDomain, siteDomain].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase())));
}

export type InboundResult = "stored" | "duplicate" | "ignored_automated" | "ignored_unparseable";

export async function recordInboundEmail(emailId: string): Promise<InboundResult> {
  const key = process.env.RESEND_API_KEY;
  const db = createServiceRoleSupabaseClient();
  if (!key || !db) throw new SupportInboxUnavailableError("RESEND_API_KEY and the Supabase service role are required.");

  const { data: existing } = await db.from("contact_requests").select("id").eq("external_id", emailId).maybeSingle();
  if (existing) return "duplicate";

  // The webhook carries no body; the receiving API has it.
  const { data: email, error } = await new Resend(key).emails.receiving.get(emailId);
  if (error || !email) throw new SupportInboxUnavailableError(`Could not fetch inbound email: ${error?.name ?? "empty"}`);

  const sender = parseSender(email.from);
  if (!sender) return "ignored_unparseable";
  if (isAutomated(sender, email.headers, ownDomains())) return "ignored_automated";

  const body = stripQuotedReply(email.text ?? (email.html ? htmlToText(email.html) : ""));
  const subject = (email.subject ?? "").trim() || "(no subject)";
  const routing = routeInbound(subject, body);
  const message = `${subject}\n\n${body}`.slice(0, MAX_INBOUND_MESSAGE);

  const { error: insertError } = await db.from("contact_requests").insert({
    reference: makeReference("E"),
    topic: routing.topic,
    queue: routing.queue,
    order_ref: routing.orderRef,
    name: sender.name ?? sender.email,
    email: sender.email,
    message,
    status: "new",
    channel: "email",
    external_id: emailId,
  });
  // Two deliveries of the same webhook racing: the unique index decides.
  if (insertError?.code === "23505") return "duplicate";
  if (insertError) throw new SupportInboxUnavailableError(`Could not store inbound email: ${insertError.message}`);
  return "stored";
}

export async function recordDeliveryEvent(eventType: string, providerId: string): Promise<boolean> {
  const status = deliveryStatusFor(eventType);
  if (!status) return false;
  const db = createServiceRoleSupabaseClient();
  if (!db) throw new SupportInboxUnavailableError("Supabase service role is not configured.");
  const { data: rows } = await db.from("email_messages").select("id, delivery_status").eq("provider_id", providerId);
  const targets = (rows ?? []).filter((row) => shouldReplaceDelivery(row.delivery_status as string | null, status)).map((row) => row.id as string);
  if (targets.length === 0) return false;
  const { error } = await db.from("email_messages").update({ delivery_status: status, delivery_updated_at: new Date().toISOString() }).in("id", targets);
  if (error) throw new SupportInboxUnavailableError(`Could not record delivery: ${error.message}`);
  return true;
}
