import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorefrontSkus } from "@/lib/storefront/catalog";
import { applyLiveInventoryAll, getLiveInventory } from "@/lib/storefront/live-inventory";
import { resolveRows } from "@/lib/storefront/identifier-resolution";
import { QUICK_ORDER_ROW_LIMIT } from "@/lib/quick-order";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";
import { BODY_LIMITS, BodyNotJsonError, BodyTooLargeError, readJsonBody } from "@/lib/backend/request-body";

/**
 * Batch resolver for quick order and CSV import: every row in one request, in
 * input order, by exact canonical match. Replaces one /api/search call per row,
 * which also auto-selected the first fuzzy result.
 */
const bodySchema = z.object({
  rows: z
    .array(z.object({ line: z.number().int().min(1).max(100_000), sku: z.string().max(120) }))
    .min(1)
    .max(QUICK_ORDER_ROW_LIMIT),
});

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "quick-order-resolve"), 60, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many lookups. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  try {
    const body = bodySchema.safeParse(await readJsonBody(request, BODY_LIMITS.batch));
    if (!body.success) {
      return NextResponse.json({ ok: false, error: `Send between 1 and ${QUICK_ORDER_ROW_LIMIT} rows.` }, { status: 400 });
    }
    const pool = applyLiveInventoryAll(getStorefrontSkus(), await getLiveInventory());
    return NextResponse.json({ ok: true, rows: resolveRows(body.data.rows, pool) });
  } catch (error) {
    if (error instanceof BodyTooLargeError) return NextResponse.json({ ok: false, error: "Request too large" }, { status: 413 });
    if (error instanceof BodyNotJsonError) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    console.error("[api/quick-order/resolve] failed", error);
    return NextResponse.json({ ok: false, error: "Lookup failed. Try again." }, { status: 500 });
  }
}
