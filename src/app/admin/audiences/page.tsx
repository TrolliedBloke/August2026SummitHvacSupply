import Link from "next/link";
import { Container } from "@/components/ui";
import { adsConfig, ADS_GATE_LABEL } from "@/lib/ads-config";
import { audienceCounts } from "@/lib/backend/audiences";
import { AUDIENCE_SEGMENTS, audienceMinimum, audiencePurpose } from "@/lib/audiences";
import { SEGMENT_LABEL, type FinderSegment } from "@/lib/finder/questions";
import { requireStaff } from "@/lib/backend/auth";

export const metadata = { title: "Ad audiences", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AudiencesPage() {
  await requireStaff("/admin/audiences");
  const config = adsConfig();
  let counts: Record<FinderSegment, number> | null = null;
  try { counts = await audienceCounts(); } catch { /* A missing migration must never enable export. */ }
  return <Container className="py-10">
    <Link href="/admin" className="inline-flex min-h-11 items-center text-sm underline">Operations dashboard</Link>
    <h1 className="mt-3 text-3xl font-medium">Ad audiences</h1>
    <p className="mt-3 max-w-3xl text-sm text-ink-2">Exports contain SHA-256 email hashes for manual upload. Each export checks current consent and opt-outs and records who downloaded it. Past purchasers are exclusions only.</p>
    {config.blockers.length > 0 && <section className="mt-6 rounded-(--r-md) border border-line p-5"><h2 className="font-medium">Export gates still closed</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{config.blockers.map((gate) => <li key={gate}>{ADS_GATE_LABEL[gate]}</li>)}</ul></section>}
    {!counts && <p role="status" className="mt-5">Audience counts are unavailable. Check the database connection and migrations.</p>}
    <p className="mt-5 text-sm text-ink-2">Counts require consent under the current notice. Consent collected under a notice that prohibited advertising sharing must be renewed after an approved notice is published.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">{AUDIENCE_SEGMENTS.map((segment) => {
      const count = counts?.[segment];
      const ready = config.enabled && count !== undefined && count >= audienceMinimum(segment);
      return <section key={segment} className="rounded-(--r-md) border border-line p-5">
        <h2 className="font-medium">{SEGMENT_LABEL[segment]}</h2>
        <p className="mt-3 text-sm">{count ?? "—"} eligible emails · minimum {audienceMinimum(segment)} · {audiencePurpose(segment)}</p>
        <form action="/admin/audiences/export" method="post" className="mt-4"><input type="hidden" name="segment" value={segment} /><button type="submit" disabled={!ready} className="min-h-11 rounded-(--r-sm) bg-brand px-4 text-sm text-brand-ink disabled:cursor-not-allowed disabled:opacity-50">Download hashed CSV</button></form>
      </section>;
    })}</div>
  </Container>;
}
