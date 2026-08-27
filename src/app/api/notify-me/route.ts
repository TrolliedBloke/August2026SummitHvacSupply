import { NextResponse } from "next/server";
import { subscribeBackInStock } from "@/lib/backend/lifecycle";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";

/**
 * Public and unauthenticated. It stores an email address against a SKU and
 * later causes Summit's domain to send mail to it, which is the same exposure
 * cart-snapshots has and is rate limited for -- an unthrottled caller here can
 * enrol arbitrary addresses for future mail.
 *
 * 10 per 10 minutes covers a shopper subscribing across a browsing session.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "notify-me"), 10, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const body = await readJsonBody<{ email?: unknown; skuId?: unknown }>(
      request,
      BODY_LIMITS.tiny
    );
    const { email, skuId } = body;

    // Bound both fields. Without a length check a caller could store a very
    // long string in either column even though the payload itself is small.
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !/.+@.+\..+/.test(email) ||
      typeof skuId !== "string" ||
      skuId.length < 1 ||
      skuId.length > 120
    ) {
      return NextResponse.json({ ok: false, error: "Valid email and SKU required" }, { status: 400 });
    }

    await subscribeBackInStock(email.trim().toLowerCase(), skuId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json({ ok: false, error: "Request too large" }, { status: 413 });
    }
    if (error instanceof BodyNotJsonError) {
      return NextResponse.json({ ok: false, error: "Valid email and SKU required" }, { status: 400 });
    }
    // Log the real cause server-side; never return it. Provider and
    // Postgres messages carry table, column and constraint names.
    console.error("[api/notify-me] failed", error);
    return NextResponse.json({ ok: false, error: "Subscription failed" }, { status: 500 });
  }
}
