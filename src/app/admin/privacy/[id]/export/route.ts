import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/backend/auth";
import { createServiceRoleSupabaseClient } from "@/lib/backend/supabase";
import { privacyReport, PrivacyRequestError } from "@/lib/backend/privacy-requests";

/**
 * "Right to know" export: everything held about the request's email, as a
 * JSON file for staff to check and send. Staff only; the request id (not the
 * email) is in the URL, and every export is logged.
 */
export async function GET(_request: Request, { params }: RouteContext<"/admin/privacy/[id]/export">) {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "staff") return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    const { request, report } = await privacyReport(id);
    await createServiceRoleSupabaseClient()?.from("activity_log").insert({ actor_profile_id: profile.userId, event: "privacy_export", entity_type: "privacy_requests", entity_id: request.id });
    return new NextResponse(JSON.stringify({ request: { reference: request.reference, kind: request.kind, received: request.created_at }, ...report }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="summit-privacy-${request.reference}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof PrivacyRequestError) return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    throw error;
  }
}
