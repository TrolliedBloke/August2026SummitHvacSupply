import { NextResponse } from "next/server";
import { subscribeBackInStock } from "@/lib/backend/lifecycle";

export async function POST(request: Request) {
  try {
    const { email, skuId } = await request.json();
    if (typeof email !== "string" || !/.+@.+\..+/.test(email) || typeof skuId !== "string") {
      return NextResponse.json({ ok: false, error: "Valid email and SKU required" }, { status: 400 });
    }
    await subscribeBackInStock(email.trim().toLowerCase(), skuId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Log the real cause server-side; never return it. Provider and
    // Postgres messages carry table, column and constraint names.
    console.error("[api/notify-me] failed", error);
    return NextResponse.json(
      { ok: false, error: "Subscription failed" },
      { status: 500 }
    );
  }
}
