import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CheckoutConflictError, placeOrder } from "@/lib/backend/checkout";

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
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
