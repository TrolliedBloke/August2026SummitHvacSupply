import { NextResponse } from "next/server";
import { submitReview } from "@/lib/backend/reviews";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";

/**
 * Public, unauthenticated: the day-14 review request email links straight here
 * with no login. That makes it a way to write rows into product_reviews, so it
 * is rate limited. It is not an injection risk beyond that -- submitReview
 * stores everything as 'pending', and nothing is published until a human
 * approves it and the row carries a verified order.
 */
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "review"), 5, 300);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const payload = await request.json();
    const result = await submitReview({
      skuId: typeof payload.skuId === "string" && payload.skuId ? payload.skuId : undefined,
      seriesSlug: typeof payload.seriesSlug === "string" && payload.seriesSlug ? payload.seriesSlug : undefined,
      authorName: String(payload.authorName ?? ""),
      city: typeof payload.city === "string" ? payload.city : undefined,
      audience: payload.audience === "contractor" || payload.audience === "property_manager"
        ? payload.audience
        : "homeowner",
      rating: Number(payload.rating),
      title: typeof payload.title === "string" ? payload.title : undefined,
      body: String(payload.body ?? ""),
      orderNumber: typeof payload.orderNumber === "string" ? payload.orderNumber : undefined,
      consentPublish: payload.consentPublish === true,
    });
    // submitReview returns its own user-safe validation messages.
    if (!result.ok) return NextResponse.json(result, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Never echo the underlying error: this handler talks to the database.
    console.error("[api/reviews] failed", error);
    return NextResponse.json({ ok: false, error: "Could not save your review." }, { status: 500 });
  }
}
