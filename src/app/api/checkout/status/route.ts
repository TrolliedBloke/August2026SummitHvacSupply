import { NextResponse } from "next/server";
import { getCheckoutStatus, getOrderConfirmation } from "@/lib/backend/checkout";
import { verifyOrderToken } from "@/lib/backend/order-token";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const orderId = verifyOrderToken(token);
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "Invalid confirmation link" }, { status: 400 });
  }
  const order = await getCheckoutStatus(orderId);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order status unavailable" }, { status: 404 });
  }
  const confirmation = await getOrderConfirmation(orderId);
  return NextResponse.json({ ok: true, ...order, confirmation }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
