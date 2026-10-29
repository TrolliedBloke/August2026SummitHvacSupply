import "server-only";
import { adsConfig } from "@/lib/ads-config";
import { audienceMinimum, audiencePurpose, groupAudienceEmails, hashedAudienceCsv } from "@/lib/audiences";
import type { FinderSegment } from "@/lib/finder/questions";
import { requireStaff } from "./auth";
import { listAdShareableConsents, noticeVersion } from "./consent";
import { createServiceRoleSupabaseClient } from "./supabase";
import { readReportPages } from "./report-pages";

async function loadAudiences() {
  const db = createServiceRoleSupabaseClient();
  if (!db) throw new Error("Connect the database before using audiences.");
  const [consents, sessions, orders] = await Promise.all([
    listAdShareableConsents(),
    readReportPages((from, to) => db.from("finder_sessions").select("email, segment, completed_at").not("email", "is", null).not("completed_at", "is", null).order("id").range(from, to)),
    readReportPages((from, to) => db.from("sales_orders").select("buyer_email").eq("paid", true).not("buyer_email", "is", null).order("id").range(from, to)),
  ]);
  // Consent collected under an older no-sharing notice is not retroactively exportable.
  return groupAudienceEmails(consents.filter((row) => row.noticeVersion === noticeVersion()).map((row) => row.email), sessions, orders.map((row) => row.buyer_email as string));
}

export async function audienceCounts() {
  await requireStaff("/admin/audiences");
  const groups = await loadAudiences();
  return Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, values.length])) as Record<FinderSegment, number>;
}

export async function exportAudience(segment: FinderSegment): Promise<string> {
  const staff = await requireStaff("/admin/audiences");
  if (!adsConfig().enabled) throw new Error("Advertising gates are closed.");
  const groups = await loadAudiences();
  // Recheck consent immediately before export, including opt-outs during report loading.
  const current = new Set((await listAdShareableConsents()).filter((row) => row.noticeVersion === noticeVersion()).map((row) => row.email));
  const emails = groups[segment].filter((email) => current.has(email));
  if (emails.length < audienceMinimum(segment)) throw new Error("Audience is below the minimum size.");
  const db = createServiceRoleSupabaseClient();
  if (!db) throw new Error("Database unavailable.");
  const { error } = await db.from("audience_exports").insert({ segment, purpose: audiencePurpose(segment), row_count: emails.length, notice_version: noticeVersion(), exported_by: staff.userId });
  if (error) throw new Error("Could not record the export. No file was released.");
  return hashedAudienceCsv(emails);
}
