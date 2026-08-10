import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CheckoutConflictError, CheckoutUnavailableError, placeOrder } from "@/lib/backend/checkout";

export async function POST(request: Request) {
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
