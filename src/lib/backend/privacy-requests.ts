import "server-only";
import { createServiceRoleSupabaseClient } from "./supabase";
import { sendEmail, sendRequiredEmail } from "./email";
import { emailShell } from "./lifecycle";
import { raiseStaffAlert, resolveStaffAlert } from "./alerts";
import { createScopedToken, verifyScopedToken } from "./order-token";
import { makeReference } from "@/lib/forms/result";
import { privacyRequestSchema } from "@/lib/forms/privacy";
import { SITE } from "@/lib/site";

/**
 * California privacy requests (docs/LIABILITY-REMEDIATION-PLAN.md, phase 6).
 *
 * Intake: a logged request (privacy_requests, which opens a staff task through
 * the migration 039 trigger, due in 45 days) and a link emailed to the address
 * the request is about. Clicking it is the identity check: only the owner of
 * the mailbox can confirm, and staff act only on confirmed requests.
 *
 * Staff: a report of everything held (public.privacy_report, exact match in
 * SQL), a JSON export for "right to know", and erasure of marketing and
 * enquiry data (public.erase_personal_data). Orders, invoices, returns and
 * warranty records are kept until counsel answers C-7.
 */

export class PrivacyRequestError extends Error {}

const VERIFY_PURPOSE = "privacy-verify";
const VERIFY_TTL_MS = 7 * 86_400_000;
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? SITE.origin;
const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
const KIND_LABEL: Record<string, string> = { know: "know what we hold", delete: "delete your information", correct: "correct your information", opt_out: "opt out" };

function db() {
  const client = createServiceRoleSupabaseClient();
  if (!client) throw new PrivacyRequestError("We couldn't record the request. Email or call us and we'll log it by hand.");
  return client;
}

export async function submitPrivacyRequest(input: unknown): Promise<{ reference: string }> {
  const request = privacyRequestSchema.parse(input);
  const client = db();
  if (request.clientRequestId) {
    const { data } = await client.from("privacy_requests").select("reference").eq("client_request_id", request.clientRequestId).maybeSingle();
    if (data) return { reference: data.reference };
  }
  const reference = makeReference("P");
  const { data, error } = await client
    .from("privacy_requests")
    .insert({ reference, email: request.email.toLowerCase(), name: request.name || null, kind: request.kind, details: request.details || null, status: "verifying", client_request_id: request.clientRequestId ?? null })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505" && request.clientRequestId) {
      const { data: existing } = await client.from("privacy_requests").select("reference").eq("client_request_id", request.clientRequestId).maybeSingle();
      if (existing) return { reference: existing.reference };
    }
    throw new Error(error?.message ?? "privacy request insert failed");
  }

  const link = `${siteUrl()}/privacy/request/verify/${createScopedToken(VERIFY_PURPOSE, data.id, VERIFY_TTL_MS)}`;
  // Required: without the email nobody can confirm, so the request would stall unseen.
  try {
    await sendRequiredEmail(
      request.email,
      `Confirm your privacy request ${reference}`,
      emailShell(`<h2 style="font-size:20px;margin:8px 0">Confirm your privacy request</h2>
        <p style="line-height:1.6">We received a request to ${KIND_LABEL[request.kind]} for this email address (reference ${reference}). To protect your information, we act on it only after you confirm it's yours.</p>
        <p style="margin:24px 0"><a href="${link}" style="background:#1f6f43;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Confirm my request</a></p>
        <p style="line-height:1.6">The link works for 7 days. We respond within 45 days of receiving the request. If you didn't make it, ignore this email and nothing happens.</p>`),
      `privacy-verify-${data.id}`,
      { kind: "privacy_verification", relatedType: "privacy_request", relatedId: reference }
    );
  } catch {
    await raiseStaffAlert({ kind: "privacy_request", dedupeKey: `privacy-email:${reference}`, subject: `Privacy request ${reference}: confirmation email failed`, body: `The confirmation email for ${reference} could not be sent. Contact the person another way to verify it; the 45-day clock is running.`, severity: "urgent", relatedType: "privacy_request", relatedId: data.id });
  }
  await raiseStaffAlert({ kind: "privacy_request", dedupeKey: `privacy:${reference}`, subject: `Privacy request ${reference} (${request.kind})`, body: `A request to ${KIND_LABEL[request.kind]} was received. It's waiting for the person to confirm by email; due within 45 days. Work it in Admin → Privacy requests.`, relatedType: "privacy_request", relatedId: data.id });
  return { reference };
}

export async function verifyPrivacyRequest(token: string): Promise<{ reference: string; kind: string } | null> {
  const id = verifyScopedToken(VERIFY_PURPOSE, token);
  if (!id) return null;
  const client = db();
  const { data } = await client.from("privacy_requests").select("id, reference, kind, status, verified_at").eq("id", id).maybeSingle();
  if (!data) return null;
  if (!data.verified_at) {
    await client.from("privacy_requests").update({ verified_at: new Date().toISOString(), status: data.status === "verifying" || data.status === "received" ? "in_progress" : data.status }).eq("id", data.id);
  }
  return { reference: data.reference, kind: data.kind };
}

/** The confirm page reads this before the person presses "confirm". */
export function privacyTokenIsValid(token: string): boolean {
  return verifyScopedToken(VERIFY_PURPOSE, token) !== null;
}

/* Staff ------------------------------------------------------------------------------------------ */

export type PrivacyRequestRow = {
  id: string;
  reference: string;
  email: string;
  name: string | null;
  kind: "know" | "delete" | "correct" | "opt_out";
  details: string | null;
  status: "received" | "verifying" | "in_progress" | "completed" | "rejected";
  due_at: string | null;
  verified_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  outcome: string | null;
  created_at: string;
};

const COLUMNS = "id, reference, email, name, kind, details, status, due_at, verified_at, completed_at, completed_by, outcome, created_at";

export async function listPrivacyRequests(): Promise<PrivacyRequestRow[]> {
  const { data } = await db().from("privacy_requests").select(COLUMNS).order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as PrivacyRequestRow[];
}

export async function getPrivacyRequest(id: string): Promise<PrivacyRequestRow | null> {
  const { data } = await db().from("privacy_requests").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as PrivacyRequestRow | null) ?? null;
}

export type PrivacyReport = Record<string, unknown> & { email: string; generated_at: string };

export async function privacyReport(requestId: string): Promise<{ request: PrivacyRequestRow; report: PrivacyReport }> {
  const request = await getPrivacyRequest(requestId);
  if (!request) throw new PrivacyRequestError("Request not found.");
  const { data, error } = await db().rpc("privacy_report", { p_email: request.email });
  if (error) throw new PrivacyRequestError(`Couldn't build the report: ${error.message}`);
  return { request, report: data as PrivacyReport };
}

/** Counts per section, for the staff page summary. */
export function reportSummary(report: PrivacyReport): Array<{ section: string; count: number }> {
  return Object.entries(report)
    .filter(([key, value]) => Array.isArray(value) && key !== "not_searchable")
    .map(([section, value]) => ({ section, count: (value as unknown[]).length }));
}

type Staff = { userId: string; name: string };

export async function erasePersonalData(requestId: string, staff: Staff, typedEmail: string): Promise<Record<string, number>> {
  const request = await getPrivacyRequest(requestId);
  if (!request) throw new PrivacyRequestError("Request not found.");
  if (request.kind !== "delete") throw new PrivacyRequestError("Only a deletion request can erase data.");
  if (!request.verified_at) throw new PrivacyRequestError("The person hasn't confirmed this request yet. Erasing needs a confirmed request.");
  if (typedEmail.trim().toLowerCase() !== request.email.trim().toLowerCase()) throw new PrivacyRequestError("The email you typed doesn't match the request. Nothing was erased.");
  const { data, error } = await db().rpc("erase_personal_data", { p_email: request.email, p_request_id: request.id, p_by: staff.name });
  if (error) throw new PrivacyRequestError(`Erasure failed and nothing changed: ${error.message}`);
  return data as Record<string, number>;
}

export async function completePrivacyRequest(requestId: string, staff: Staff, result: { status: "completed" | "rejected"; outcome: string }): Promise<string> {
  const request = await getPrivacyRequest(requestId);
  if (!request) throw new PrivacyRequestError("Request not found.");
  const client = db();
  await client.from("privacy_requests").update({ status: result.status, outcome: result.outcome, completed_at: new Date().toISOString(), completed_by: staff.name }).eq("id", request.id);
  await client.from("activity_log").insert({ actor_profile_id: staff.userId || null, event: `privacy_${result.status}`, entity_type: "privacy_requests", entity_id: request.id });
  await sendEmail(
    request.email,
    `Your privacy request ${request.reference}`,
    emailShell(`<h2 style="font-size:20px;margin:8px 0">Your privacy request ${escape(request.reference)} is ${result.status === "completed" ? "complete" : "closed"}.</h2>
      <p style="line-height:1.6">${escape(result.outcome).replace(/\n/g, "<br>")}</p>
      <p style="line-height:1.6">Questions? Reply to this email or call ${SITE.phone}.</p>`),
    { kind: "privacy_outcome", relatedType: "privacy_request", relatedId: request.reference }
  );
  await resolveStaffAlert(`privacy:${request.reference}`, staff.name);
  await resolveStaffAlert(`privacy-due:${request.id}`, staff.name);
  return request.reference;
}

/** Open requests within 10 days of the 45-day deadline alert once. */
export async function alertOnPrivacyDeadlines(now = new Date()): Promise<number> {
  const client = createServiceRoleSupabaseClient();
  if (!client) return 0;
  const soon = new Date(now.getTime() + 10 * 86_400_000).toISOString();
  const { data } = await client.from("privacy_requests").select("id, reference, kind, due_at, verified_at").in("status", ["received", "verifying", "in_progress"]).lte("due_at", soon).limit(100);
  let raised = 0;
  for (const row of data ?? []) {
    if (
      await raiseStaffAlert({
        kind: "privacy_request",
        dedupeKey: `privacy-due:${row.id}`,
        subject: `Privacy request ${row.reference} is due ${row.due_at ? new Date(row.due_at).toLocaleDateString("en-US") : "soon"}`,
        body: `${row.reference} (${row.kind}) is still open${row.verified_at ? "" : " and unconfirmed by the person"}. California requires a response within 45 days of receipt.`,
        severity: "urgent",
        relatedType: "privacy_request",
        relatedId: row.id,
      })
    )
      raised += 1;
  }
  return raised;
}
