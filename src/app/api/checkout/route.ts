import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CheckoutConflictError, CheckoutReviewRequiredError, CheckoutUnavailableError, placeOrder } from "@/lib/backend/checkout";
import { clientKey, rateLimit } from "@/lib/backend/rate-limit";

export async function POST(request: Request) {
  // Each attempt can reserve stock and create a PaymentIntent. Retries of one
  // order reuse its idempotency key, so a buyer never needs more than a few.
  const limit = rateLimit(clientKey(request, "checkout"), 10, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many checkout attempts. Wait a few minutes, or call the counter.", retryable: true },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }
  try {
    const payload = await request.json();
    const result = await placeOrder(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid checkout", issues: error.issues },
        { status: 400 }
      );
    }
    // The current snapshot travels with the 409 so the page can show exactly
    // which lines, fees or totals changed and ask the buyer to confirm.
    if (error instanceof CheckoutReviewRequiredError) {
      return NextResponse.json(
        { ok: false, code: error.code, error: error.message, snapshot: error.snapshot },
        { status: 409, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    if (error instanceof CheckoutConflictError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    // 503, not 500: nothing was written and the client may safely retry the
    // same idempotency key.
    if (error instanceof CheckoutUnavailableError) {
      return NextResponse.json({ ok: false, error: error.message, retryable: true }, { status: 503 });
    }
    // Everything else is unexpected. Log the real cause server-side and return
    // a fixed string -- the previous code echoed `error.message`, publishing raw
    // Postgres and Stripe errors (constraint names, column names) to the client.
    console.error("[checkout] unhandled failure", error);
    return NextResponse.json(
      { ok: false, error: "Checkout could not be completed. No charge was made." },
      { status: 500 }
    );
  }
}
