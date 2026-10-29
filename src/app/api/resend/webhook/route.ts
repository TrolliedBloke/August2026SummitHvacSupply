import { NextResponse } from "next/server";
import { Resend } from "resend";
import { recordDeliveryEvent, recordInboundEmail, SupportInboxUnavailableError } from "@/lib/backend/support-inbox";

/**
 * Resend webhook (docs/PIPELINE-ARCHITECTURE-PLAN.md, F3).
 *
 * Subscribe it in Resend to email.received (support inbox) and to the
 * delivery events: email.delivered, email.delivery_delayed, email.bounced,
 * email.complained, email.opened, email.clicked, email.failed,
 * email.suppressed. The signature is checked with RESEND_WEBHOOK_SECRET
 * before anything is read; unsigned or stale requests are rejected.
 *
 * Errors return 5xx so Resend retries; everything is idempotent (inbound mail
 * by provider id, delivery outcomes only move forward).
 */

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

type EventPayload = { type?: string; data?: { email_id?: string } };

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!secret || !apiKey) return new NextResponse("Webhook not configured", { status: 503 });

  const payload = await request.text();
  if (payload.length > MAX_BODY_BYTES) return new NextResponse("Payload too large", { status: 413 });

  // Resend signs with Svix-style headers; the standard-webhooks names are the same values.
  const header = (name: string) => request.headers.get(`svix-${name}`) ?? request.headers.get(`webhook-${name}`) ?? "";
  let event: EventPayload;
  try {
    event = new Resend(apiKey).webhooks.verify({
      payload,
      headers: { id: header("id"), timestamp: header("timestamp"), signature: header("signature") },
      webhookSecret: secret,
    }) as EventPayload;
  } catch {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const type = event.type ?? "";
  const emailId = event.data?.email_id;
  if (!emailId) return NextResponse.json({ ok: true, ignored: "no email id" });

  try {
    if (type === "email.received") {
      const result = await recordInboundEmail(emailId);
      return NextResponse.json({ ok: true, result });
    }
    const updated = await recordDeliveryEvent(type, emailId);
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error("[resend webhook]", type, error instanceof Error ? error.message : error);
    return new NextResponse("Temporarily unavailable", { status: error instanceof SupportInboxUnavailableError ? 503 : 500 });
  }
}
