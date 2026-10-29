import Link from "next/link";
import { Container, Chip } from "@/components/ui";
import { Notice } from "@/components/state";
import { readFlash } from "@/lib/backend/admin-flash";
import { listPrivacyRequests, privacyReport, reportSummary, type PrivacyRequestRow } from "@/lib/backend/privacy-requests";
import { completeAction, eraseAction } from "./actions";

export const metadata = { title: "Privacy requests" };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { know: "Right to know", delete: "Deletion", correct: "Correction", opt_out: "Opt-out" };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" }) : "n/a");
const daysLeft = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000) : null);
const inputCls = "min-h-10 w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";
const buttonCls = "inline-flex min-h-10 items-center rounded-(--r-sm) border border-line bg-surface-1 px-3 text-sm font-medium text-ink-1 hover:bg-surface-2";

/**
 * California privacy requests (docs/LIABILITY-REMEDIATION-PLAN.md, 6.1).
 * Retention for orders, invoices, returns and warranty records is pending
 * counsel (C-7), so erasure here covers marketing and enquiry data only.
 */
export default async function PrivacyAdminPage({ searchParams }: PageProps<"/admin/privacy">) {
  const { request: selectedId } = (await searchParams) as { request?: string };
  const flash = await readFlash();
  let requests: PrivacyRequestRow[] = [];
  let unavailable = false;
  try {
    requests = await listPrivacyRequests();
  } catch {
    unavailable = true;
  }
  const selected = selectedId && /^[0-9a-f-]{36}$/i.test(selectedId) ? await privacyReport(selectedId).catch(() => null) : null;
  const open = requests.filter((row) => row.status !== "completed" && row.status !== "rejected");

  return (
    <Container className="py-10 lg:py-14">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">Privacy requests</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        California gives 45 days from receipt. Act only on requests the person has confirmed by email. Every report, export and erasure is logged
        under your name.
      </p>
      {flash && (
        <Notice tone={flash.tone} role={flash.tone === "danger" ? "alert" : "status"} className="mt-6">
          {flash.text}
        </Notice>
      )}
      {unavailable && (
        <Notice tone="danger" className="mt-6" title="Requests couldn't be loaded">
          The database isn&apos;t reachable from this server.
        </Notice>
      )}

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-ink-1">
          Open <Chip tone="neutral">{open.length}</Chip>
        </h2>
        <ul className="mt-3 divide-y divide-line rounded-(--r-md) border border-line bg-surface-1">
          {open.length === 0 && <li className="p-4 text-sm text-ink-3">No open requests.</li>}
          {open.map((row) => {
            const left = daysLeft(row.due_at);
            return (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 text-sm">
                  <p className="font-mono text-xs font-semibold text-ink-1">{row.reference}</p>
                  <p className="text-ink-1">
                    {KIND[row.kind]} · {row.name ?? "no name"} · {row.email}
                  </p>
                  <p className="text-xs text-ink-3">
                    Received {when(row.created_at)} · {row.verified_at ? `confirmed ${when(row.verified_at)}` : "not yet confirmed by the person"} · due {when(row.due_at)}
                    {left !== null ? ` (${left} days)` : ""}
                  </p>
                </div>
                <Link href={`/admin/privacy?request=${row.id}`} className={buttonCls}>
                  Open
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {selected && <RequestDetail request={selected.request} summary={reportSummary(selected.report)} />}

      {requests.length > open.length && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-ink-1">Closed</h2>
          <ul className="mt-3 divide-y divide-line rounded-(--r-md) border border-line bg-surface-1 text-sm">
            {requests
              .filter((row) => row.status === "completed" || row.status === "rejected")
              .slice(0, 50)
              .map((row) => (
                <li key={row.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span className="font-mono text-xs">{row.reference}</span>
                  <span className="text-ink-2">{KIND[row.kind]}</span>
                  <span className="text-ink-3">
                    {row.status} {when(row.completed_at)} by {row.completed_by ?? "?"}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </Container>
  );
}

function RequestDetail({ request, summary }: { request: PrivacyRequestRow; summary: Array<{ section: string; count: number }> }) {
  const confirmed = Boolean(request.verified_at);
  const closed = request.status === "completed" || request.status === "rejected";
  return (
    <section className="mt-10 rounded-(--r-md) border border-line bg-surface-1 p-5">
      <h2 className="font-display text-lg font-semibold text-ink-1">
        {request.reference}: {KIND[request.kind]}
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        {request.email}
        {request.details ? ` · “${request.details}”` : ""}
      </p>
      {!confirmed && (
        <Notice tone="warning" className="mt-4" title="Not confirmed">
          The person hasn&apos;t clicked the confirmation link. Don&apos;t send data or erase anything until they do; if it stays unconfirmed, close it as rejected
          (unverified) before the deadline.
        </Notice>
      )}
      <h3 className="mt-5 text-sm font-semibold text-ink-1">What we hold</h3>
      <ul className="mt-2 grid gap-1 text-sm text-ink-2 sm:grid-cols-3">
        {summary.map((row) => (
          <li key={row.section} className={row.count === 0 ? "text-ink-3" : ""}>
            {row.section.replaceAll("_", " ")}: {row.count}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-3">Chat transcripts are stored by browser session, not email, and can&apos;t be matched to a person.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a href={`/admin/privacy/${request.id}/export`} className={buttonCls}>
          Download full report (JSON)
        </a>
      </div>

      {!closed && request.kind === "delete" && confirmed && (
        <form action={eraseAction} className="mt-6 flex flex-col gap-2 rounded-(--r-sm) border border-state-danger-line p-4">
          <input type="hidden" name="requestId" value={request.id} />
          <p className="text-sm font-medium text-ink-1">Erase marketing and enquiry data</p>
          <p className="text-sm text-ink-2">
            Deletes saved carts, stock and category alerts, finder sessions and planning emails; anonymises quote, contact and homeowner requests;
            withdraws marketing consent (the email is kept so we never mail them again). Orders, invoices, returns, warranty claims, dealer
            applications and the email log are kept until counsel sets retention (C-7). This can&apos;t be undone.
          </p>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-1">
            Type the email to confirm
            <input name="typedEmail" required autoComplete="off" className={inputCls} />
          </label>
          <button type="submit" className={`${buttonCls} self-start`}>
            Erase
          </button>
        </form>
      )}

      {!closed && (
        <form action={completeAction} className="mt-6 flex flex-col gap-2 rounded-(--r-sm) border border-line p-4">
          <input type="hidden" name="requestId" value={request.id} />
          <p className="text-sm font-medium text-ink-1">Close the request (emails the person)</p>
          <textarea
            name="outcome"
            required
            minLength={10}
            rows={4}
            className={`${inputCls} py-2`}
            defaultValue={
              request.kind === "know"
                ? "We've attached a copy of the personal information we hold about you."
                : request.kind === "delete"
                  ? "We've deleted the personal information we held about you, except records we must keep by law (orders, invoices and warranty records). We've also stopped all marketing email to this address."
                  : ""
            }
          />
          <div className="flex flex-wrap gap-3">
            <button type="submit" name="status" value="completed" className={buttonCls}>
              Complete
            </button>
            <button type="submit" name="status" value="rejected" className={buttonCls}>
              Reject (e.g. unverified)
            </button>
          </div>
          {request.kind === "know" && <p className="text-xs text-ink-3">Send the downloaded report to the person yourself, by reply to their confirmation, before completing.</p>}
        </form>
      )}
    </section>
  );
}
