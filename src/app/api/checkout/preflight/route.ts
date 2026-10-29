import { NextResponse } from "next/server";
import { z } from "zod";
import { issueCheckoutSnapshot } from "@/lib/backend/checkout-snapshot";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";

/**
 * Checkout preflight: the signed, expiring snapshot the checkout page renders
 * and submits. Private to the session (it can carry account prices), never
 * cached.
 */
const bodySchema = z.object({
  items: z.array(z.object({ skuId: z.string().min(1).max(120), qty: z.number().int().min(1).max(200) })).min(1).max(100),
  method: z.enum(["pickup", "local_delivery", "freight"]),
  zip: z.string().regex(/^\d{5}$/).nullable().optional(),
});
const PRIVATE = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "checkout-preflight"), 120, 600);
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { ...PRIVATE, "Retry-After": String(limit.retryAfterSeconds) } });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid checkout request" }, { status: 400, headers: PRIVATE });
  try {
    const snapshot = await issueCheckoutSnapshot({ items: parsed.data.items, method: parsed.data.method, zip: parsed.data.zip ?? null });
    return NextResponse.json({ ok: true, snapshot }, { headers: PRIVATE });
  } catch (error) {
    console.error("[api/checkout/preflight] failed", error);
    return NextResponse.json({ ok: false, error: "Prices could not be confirmed right now. Your cart is saved." }, { status: 503, headers: PRIVATE });
  }
}
