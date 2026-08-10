import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/backend/auth";
import { getReorderItems } from "@/lib/backend/services";

export async function POST(request: Request) {
  try {
    const profile = await getSessionProfile();
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Sign in to reorder" }, { status: 401 });
    }
    const { orderId } = await request.json();
    if (typeof orderId !== "string") {
      return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 });
    }
    const result = getReorderItems(orderId, profile.role, profile.accountId);
    if (!result) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // Log the real cause server-side; never return it. Provider and
    // Postgres messages carry table, column and constraint names.
    console.error("[api/reorder] failed", error);
    return NextResponse.json(
      { ok: false, error: "Reorder failed" },
      { status: 500 }
    );
  }
}
