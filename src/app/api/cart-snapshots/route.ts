import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { saveCartSnapshot } from "@/lib/backend/lifecycle";
import { cartSnapshotSchema } from "@/lib/backend/schemas";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";

/**
 * Public, unauthenticated: the browser posts the cart so the abandoned-cart
 * sequence can pick it up. That makes it a way to make Summit's domain send
 * mail to an address of the caller's choosing, so it is both rate limited and
 * strictly validated, and the stored contents are re-derived server-side from
 * the catalog (see saveCartSnapshot).
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "cart-snapshot"), 10, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const payload = await request.json();
    const { email, items } = cartSnapshotSchema.parse(payload);
    await saveCartSnapshot(
      email.trim().toLowerCase(),
      items.map((item) => ({ skuId: item.skuId, qty: item.qty }))
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid cart snapshot" }, { status: 400 });
    }
    // Never echo the underlying error: this handler talks to the database and
    // its messages carry table and constraint names.
    console.error("[cart-snapshots] failed", error);
    return NextResponse.json({ ok: false, error: "Snapshot failed" }, { status: 500 });
  }
}
