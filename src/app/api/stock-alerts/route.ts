import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { subscribeCategoryAlert } from "@/lib/backend/lifecycle";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";
import { recordEvent } from "@/lib/backend/events";
import { CATALOG_CATEGORIES, type CatalogCategory } from "@/lib/storefront/catalog";
import { fieldErrorsFrom } from "@/lib/forms/result";

/** Contractor stock alerts by category and capacity (plan 4.3). */
const categories = CATALOG_CATEGORIES.map((category) => category.value) as [CatalogCategory, ...CatalogCategory[]];
const schema = z.object({
  email: z.string().trim().toLowerCase().max(254).email("Enter an email address like you@company.com."),
  category: z.enum(categories),
  btu: z.number().int().min(6_000).max(240_000).nullable().default(null),
});

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "stock-alert"), 10, 600);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  try {
    const body = schema.parse(await readJsonBody(request, BODY_LIMITS.tiny));
    await subscribeCategoryAlert(body.email, body.category, body.btu);
    await recordEvent("category_alert_subscribed", "/finder", { category: body.category, btu: body.btu });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ ok: false, error: "Check the highlighted field.", fieldErrors: fieldErrorsFrom(error) }, { status: 400 });
    if (error instanceof BodyTooLargeError) return NextResponse.json({ ok: false, error: "Request too large" }, { status: 413 });
    if (error instanceof BodyNotJsonError) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    console.error("[api/stock-alerts] failed", error);
    return NextResponse.json({ ok: false, error: "We could not save the alert. Try again, or call the counter." }, { status: 500 });
  }
}
