import { NextResponse } from "next/server";
import { catalogHealth } from "@/lib/catalog/reconciliation";
import { complianceSummary } from "@/lib/catalog/compliance";

export async function GET() {
  const health = catalogHealth();
  // California eligibility is reported, not gated on: a low count is the
  // honest state of the research, not an outage.
  return NextResponse.json({ ...health, californiaResidential: complianceSummary() }, { status: health.healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
