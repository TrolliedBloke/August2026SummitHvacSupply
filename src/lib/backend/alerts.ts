import "server-only";
import { createServiceRoleSupabaseClient } from "./supabase";
import { sendEmail } from "./email";

/**
 * Staff alerts (docs/LIABILITY-REMEDIATION-PLAN.md, 7.1).
 *
 * One row per distinct problem in staff_alerts, keyed by `dedupeKey`, so a
 * job that runs every 15 minutes emails a problem once rather than every run.
 * The email goes to OPS_ALERT_EMAIL; without it the alert is still stored and
 * shown in the admin. Raising an alert never throws: it is called from the
 * same paths whose failure it reports.
 */

export type AlertInput = {
  kind:
    | "payment_reconciliation"
    | "paid_needs_review"
    | "authorization_expiring"
    | "authorization_cancelled"
    | "order_hold"
    | "confirmation_email_failed"
    | "return_requested"
    | "warranty_claim"
    | "privacy_request"
    | "webhook_failure"
    | "job_failure";
  dedupeKey: string;
  subject: string;
  body: string;
  severity?: "normal" | "urgent";
  relatedType?: string;
  relatedId?: string;
};

const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);

/** True when this call created the alert (and emailed it). */
export async function raiseStaffAlert(alert: AlertInput): Promise<boolean> {
  const db = createServiceRoleSupabaseClient();
  if (!db) {
    console.error(`[staff alert, no database] ${alert.kind}: ${alert.subject}`);
    return false;
  }
  try {
    const { data, error } = await db
      .from("staff_alerts")
      .upsert(
        {
          kind: alert.kind,
          dedupe_key: alert.dedupeKey,
          subject: alert.subject.slice(0, 200),
          body: alert.body.slice(0, 4000),
          severity: alert.severity ?? "normal",
          related_type: alert.relatedType ?? null,
          related_id: alert.relatedId ?? null,
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true }
      )
      .select("id");
    if (error) {
      console.error("[staff alert] could not store:", error.message);
      return false;
    }
    if (!data || data.length === 0) return false; // already raised

    const to = process.env.OPS_ALERT_EMAIL;
    if (to) {
      await sendEmail(
        to,
        `${alert.severity === "urgent" ? "[URGENT] " : ""}${alert.subject}`,
        `<p>${escape(alert.body).replace(/\n/g, "<br>")}</p><p style="color:#6f6e69;font-size:12px">Summit staff alert · ${escape(alert.kind)} · open the admin to act on it.</p>`,
        { kind: "staff_alert", relatedType: alert.relatedType, relatedId: alert.relatedId }
      );
      await db.from("staff_alerts").update({ emailed_at: new Date().toISOString() }).eq("id", data[0].id);
    }
    return true;
  } catch (error) {
    console.error("[staff alert] failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

export async function resolveStaffAlert(dedupeKey: string, by: string): Promise<void> {
  const db = createServiceRoleSupabaseClient();
  if (!db) return;
  await db.from("staff_alerts").update({ resolved_at: new Date().toISOString(), resolved_by: by }).eq("dedupe_key", dedupeKey).is("resolved_at", null);
}

/** Proof a background job ran; /api/health/jobs reports stale ones. */
export async function recordHeartbeat(job: string, status: "ok" | "error", detail: Record<string, unknown> = {}): Promise<void> {
  const db = createServiceRoleSupabaseClient();
  if (!db) return;
  try {
    await db.from("job_heartbeats").upsert({ job, last_run_at: new Date().toISOString(), last_status: status, detail }, { onConflict: "job" });
  } catch {
    /* a heartbeat must never fail the job it reports on */
  }
}
