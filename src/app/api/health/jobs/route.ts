import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/backend/cron-auth";
import { createServiceRoleSupabaseClient } from "@/lib/backend/supabase";
import { raiseStaffAlert } from "@/lib/backend/alerts";
import { allHealthy, jobHealth, type JobRun } from "@/lib/ops/job-health";

/**
 * Scheduled-job health for an uptime monitor (docs/LIABILITY-REMEDIATION-PLAN.md,
 * 7.1). 200 when every job ran within its window, 503 otherwise, so a monitor
 * that pages on non-200 catches a stopped job. Each stale job also raises one
 * staff alert per day. Needs `Authorization: Bearer $CRON_SECRET`.
 *
 * Run it from OUTSIDE Supabase (an uptime service): if pg_cron or the app
 * config is what broke, a check scheduled by pg_cron would never fire.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const db = createServiceRoleSupabaseClient();
  if (!db) return NextResponse.json({ ok: false, error: "database not configured" }, { status: 503 });

  const now = new Date();
  const [{ data: beats }, { data: sync }] = await Promise.all([
    db.from("job_heartbeats").select("job, last_run_at, last_status"),
    db.from("quickbooks_sync_runs").select("started_at, ok").order("started_at", { ascending: false }).limit(1),
  ]);
  const runs: JobRun[] = (beats ?? []).map((row) => ({ job: row.job, lastRunAt: row.last_run_at, lastStatus: row.last_status }));
  // The QuickBooks sync is an edge function that logs its own runs.
  if (sync?.[0]) runs.push({ job: "quickbooks-sync", lastRunAt: sync[0].started_at, lastStatus: sync[0].ok === false ? "error" : "ok" });

  const health = jobHealth(runs, now);
  for (const job of health.filter((entry) => entry.state !== "ok")) {
    await raiseStaffAlert({
      kind: "job_failure",
      dedupeKey: `job-stale:${job.job}:${now.toISOString().slice(0, 10)}`,
      subject: `Scheduled job not running: ${job.label}`,
      body: `${job.label} is ${job.state.replace("_", " ")}${job.lastRunAt ? `; last run ${job.lastRunAt}` : ""}. Check cron.job_run_details and private.app_config (docs/RUNBOOKS.md, "A scheduled job stopped").`,
      severity: "urgent",
    });
  }
  const ok = allHealthy(health);
  return NextResponse.json({ ok, checkedAt: now.toISOString(), jobs: health }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
