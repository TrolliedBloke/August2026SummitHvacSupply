import { NextResponse } from "next/server";
import { z } from "zod";
import { requestGuestReturnLink, ReturnRejectedError } from "@/lib/backend/returns";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";

const schema = z.object({ orderNumber: z.string().trim().min(3).max(40), email: z.string().trim().email().max(254) });

/**
 * Emails a return link to the order's address when the order number and
 * email match. The answer is the same either way, so it reveals nothing.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "return-link"), 5, 600);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests. Try again in a few minutes, or call the counter." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter the order number and the email you ordered with." }, { status: 400 });
  try {
    await requestGuestReturnLink(parsed.data.orderNumber, parsed.data.email);
  } catch (error) {
    if (error instanceof ReturnRejectedError) return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    console.error("[api/returns/guest-link] failed", error);
    return NextResponse.json({ ok: false, error: "We couldn't send the link. Call the counter." }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
