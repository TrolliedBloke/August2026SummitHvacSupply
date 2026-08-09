import { NextResponse } from "next/server";
import { catalogHealth } from "@/lib/catalog/reconciliation";

export async function GET() {
  const health = catalogHealth();
  return NextResponse.json(health, { status: health.healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
