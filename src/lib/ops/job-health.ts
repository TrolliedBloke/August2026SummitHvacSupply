/**
 * Which scheduled jobs have stopped running (docs/LIABILITY-REMEDIATION-PLAN.md,
 * 1.5 and 7.1). Pure: /api/health/jobs loads the last run of each and asks.
 *
 * Every job pg_cron starts writes a heartbeat when it finishes. A job whose
 * last run is older than its window -- or that has never run -- is stale. That
 * catches what cron's own "succeeded" status hides: a job that runs but does
 * nothing because its configuration is missing.
 */

export type JobSpec = { job: string; label: string; maxAgeMinutes: number };

export const MONITORED_JOBS: JobSpec[] = [
  { job: "payment-safety", label: "Payment safety (every 15 minutes)", maxAgeMinutes: 45 },
  { job: "lifecycle-dispatch", label: "Lifecycle emails and checkout expiry (hourly)", maxAgeMinutes: 150 },
  { job: "quickbooks-sync", label: "QuickBooks stock sync (every 15 minutes)", maxAgeMinutes: 60 },
];

export type JobRun = { job: string; lastRunAt: string | null; lastStatus: "ok" | "error" | null };
export type JobHealth = JobSpec & { lastRunAt: string | null; state: "ok" | "stale" | "failing" | "never_ran"; ageMinutes: number | null };

export function jobHealth(runs: JobRun[], now: Date, specs: JobSpec[] = MONITORED_JOBS): JobHealth[] {
  return specs.map((spec) => {
    const run = runs.find((entry) => entry.job === spec.job);
    if (!run?.lastRunAt) return { ...spec, lastRunAt: null, state: "never_ran", ageMinutes: null };
    const ageMinutes = Math.floor((now.getTime() - new Date(run.lastRunAt).getTime()) / 60_000);
    const state = ageMinutes > spec.maxAgeMinutes ? "stale" : run.lastStatus === "error" ? "failing" : "ok";
    return { ...spec, lastRunAt: run.lastRunAt, state, ageMinutes };
  });
}

export function allHealthy(health: JobHealth[]): boolean {
  return health.every((job) => job.state === "ok");
}
