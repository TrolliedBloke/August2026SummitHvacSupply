import Link from "next/link";
import { Container, Chip } from "@/components/ui";
import { Notice } from "@/components/state";
import { LiveRefresh } from "@/components/admin/live-refresh";
import { readFlash } from "@/lib/backend/admin-flash";
import { createServerSupabase } from "@/lib/backend/supabase-ssr";
import { jobHealth, type JobRun } from "@/lib/ops/job-health";
import { resolveAlertAction } from "./actions";

export const metadata = { title: "Alerts" };
export const dynamic = "force-dynamic";

type AlertRow = { id: string; kind: string; subject: string; body: string | null; severity: string; created_at: string; emailed_at: string | null; related_type: string | null };

/** Where each kind of alert is acted on. */
const WHERE: Record<string, string> = {
  payment_reconciliation: "/admin/fulfillment",
  paid_needs_review: "/admin/fulfillment",
  authorization_expiring: "/admin/fulfillment",
  authorization_cancelled: "/admin/fulfillment",
  order_hold: "/admin/fulfillment",
  shipped_without_payment: "/admin/fulfillment",
  shipped_after_cancellation: "/admin/fulfillment",
  shipped_while_on_hold: "/admin/fulfillment",
  return_requested: "/admin/returns",
  warranty_claim: "/admin/returns",
  privacy_request: "/admin/privacy",
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never");

export default async function AlertsPage() {
  const supabase = await createServerSupabase();
  const flash = await readFlash();
  let alerts: AlertRow[] = [];
  let runs: JobRun[] = [];
  if (supabase) {
    const [{ data: open }, { data: beats }, { data: sync }] = await Promise.all([
      supabase.from("staff_alerts").select("id, kind, subject, body, severity, created_at, emailed_at, related_type").is("resolved_at", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("job_heartbeats").select("job, last_run_at, last_status"),
      supabase.from("quickbooks_sync_runs").select("started_at, ok").order("started_at", { ascending: false }).limit(1),
    ]);
    alerts = (open as AlertRow[] | null) ?? [];
    runs = (beats ?? []).map((row) => ({ job: row.job, lastRunAt: row.last_run_at, lastStatus: row.last_status }));
    if (sync?.[0]) runs.push({ job: "quickbooks-sync", lastRunAt: sync[0].started_at, lastStatus: sync[0].ok === false ? "error" : "ok" });
  }
  const jobs = jobHealth(runs, new Date());

  return (
    <Container className="py-10 lg:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">Alerts</h1>
          <p className="mt-2 max-w-2xl text-ink-2">
            Problems the site found on its own: payments that don&apos;t match, orders on hold, new returns, claims and privacy requests, and scheduled
            jobs that stopped. Each is also emailed to the ops inbox once (OPS_ALERT_EMAIL).
          </p>
        </div>
        <LiveRefresh />
      </div>
      {flash && (
        <Notice tone={flash.tone} role={flash.tone === "danger" ? "alert" : "status"} className="mt-6">
          {flash.text}
        </Notice>
      )}

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink-1">Scheduled jobs</h2>
        <ul className="mt-3 divide-y divide-line rounded-(--r-md) border border-line bg-surface-1 text-sm">
          {jobs.map((job) => (
            <li key={job.job} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="text-ink-1">{job.label}</span>
              <span className="flex items-center gap-2 text-ink-3">
                Last run {when(job.lastRunAt)}
                <Chip tone={job.state === "ok" ? "neutral" : "brand"}>{job.state === "ok" ? "Running" : job.state.replace("_", " ")}</Chip>
              </span>
            </li>
          ))}
        </ul>
        {jobs.some((job) => job.state !== "ok") && (
          <Notice tone="warning" className="mt-3" title="A scheduled job isn't running">
            Most often private.app_config is empty, so pg_cron calls nothing. See docs/RUNBOOKS.md, &quot;A scheduled job stopped&quot;.
          </Notice>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink-1">
          Open alerts <Chip tone="neutral">{alerts.length}</Chip>
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {alerts.length === 0 && <p className="text-sm text-ink-3">Nothing open.</p>}
          {alerts.map((alert) => (
            <article key={alert.id} className={`rounded-(--r-md) border bg-surface-1 p-4 ${alert.severity === "urgent" ? "border-state-danger-line" : "border-line"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-ink-1">
                  {alert.severity === "urgent" && <span className="mr-2 text-state-danger-ink">Urgent</span>}
                  {alert.subject}
                </p>
                <span className="text-xs text-ink-3">
                  {when(alert.created_at)} · {alert.emailed_at ? "emailed" : "not emailed (set OPS_ALERT_EMAIL)"}
                </span>
              </div>
              {alert.body && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">{alert.body}</p>}
              <div className="mt-3 flex flex-wrap gap-3">
                {WHERE[alert.kind] && (
                  <Link href={WHERE[alert.kind]} className="inline-flex min-h-10 items-center rounded-(--r-sm) border border-line bg-surface-1 px-3 text-sm font-medium text-ink-1 hover:bg-surface-2">
                    Go to it
                  </Link>
                )}
                <form action={resolveAlertAction}>
                  <input type="hidden" name="alertId" value={alert.id} />
                  <button type="submit" className="inline-flex min-h-10 items-center rounded-(--r-sm) border border-line bg-surface-1 px-3 text-sm font-medium text-ink-1 hover:bg-surface-2">
                    Mark handled
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>
    </Container>
  );
}
