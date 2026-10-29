import Link from "next/link";
import { CheckCircle2, Clock3, History, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Chip, Container } from "@/components/ui";
import { cslbLookupHref, listDealerApplicationsForReview, type DealerApplicationReview } from "@/lib/backend/dealer-review";
import { APPLICANT_COPY, canTransition, DEALER_TRANSITIONS, type DealerApplicationStatus } from "@/lib/dealer-application-state";
import { approveDealerApplicationAction, recordEpa608Action, recordLicenseCheckAction, reviewDealerApplicationAction } from "./actions";

export const metadata = { title: "Dealer application review", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<DealerApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  needs_information: "Needs information",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const CLOSED = new Set<DealerApplicationStatus>(["approved", "rejected", "withdrawn"]);

export default async function DealerApplicationsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[]; tone?: string | string[] }>;
}) {
  const params = await searchParams;
  const { connected, applications } = await listDealerApplicationsForReview();
  const open = applications.filter((application) => !CLOSED.has(application.status));
  const closed = applications.filter((application) => CLOSED.has(application.status));
  const notice = typeof params.notice === "string" ? params.notice.slice(0, 240) : null;
  const tone = params.tone === "error" ? "error" : "success";

  return (
    <Container className="py-10 lg:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink-2">Staff operations</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">Dealer application review</h1>
          <p className="mt-3 max-w-3xl text-ink-2">
            Review one canonical application, request missing information, or approve the linked identity and account in one
            transaction. Every change is checked by the database state machine and added to the audit history.
          </p>
        </div>
        <Link href="/admin" className="inline-flex min-h-11 items-center text-sm font-medium text-ink-1 underline underline-offset-4">
          Operations dashboard
        </Link>
      </div>

      {notice && (
        <div role={tone === "error" ? "alert" : "status"} className={`mt-6 rounded-(--r-sm) border px-4 py-3 text-sm ${tone === "error" ? "border-state-danger-line bg-state-danger text-state-danger-ink" : "border-state-success-line bg-state-success text-state-success-ink"}`}>
          {notice}
        </div>
      )}

      {!connected ? (
        <section className="mt-8 rounded-(--r-md) border border-dashed border-line-strong bg-surface-1 p-8 text-center">
          <ShieldCheck className="mx-auto text-ink-3" size={30} aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-ink-1">Connect the branch database to review applications</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-2">
            The public form can be previewed in seeded mode, but staff approval intentionally requires Supabase and migration 026.
            No local-only approval can create a customer account.
          </p>
        </section>
      ) : (
        <>
          <section className="mt-8" aria-labelledby="open-applications">
            <div className="flex items-center gap-3">
              <Clock3 size={20} className="text-brand" aria-hidden="true" />
              <h2 id="open-applications" className="text-xl font-semibold text-ink-1">Open applications</h2>
              <Chip>{open.length}</Chip>
            </div>
            {open.length === 0 ? (
              <p className="mt-4 rounded-(--r-md) border border-line bg-surface-1 p-6 text-sm text-ink-2">No applications need staff action.</p>
            ) : (
              <div className="mt-4 grid gap-5">
                {open.map((application) => <ApplicationCard key={application.id} application={application} />)}
              </div>
            )}
          </section>

          {closed.length > 0 && (
            <section className="mt-10" aria-labelledby="closed-applications">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-eco" aria-hidden="true" />
                <h2 id="closed-applications" className="text-xl font-semibold text-ink-1">Completed applications</h2>
                <Chip>{closed.length}</Chip>
              </div>
              <div className="mt-4 grid gap-4">
                {closed.map((application) => <ApplicationCard key={application.id} application={application} readOnly />)}
              </div>
            </section>
          )}
        </>
      )}
    </Container>
  );
}

function ApplicationCard({ application, readOnly = false }: { application: DealerApplicationReview; readOnly?: boolean }) {
  const transitions = DEALER_TRANSITIONS[application.status].filter((status) => status !== "approved");
  const approvable = canTransition(application.status, "approved") && application.status !== "approved";
  const needsLicenseCheck = Boolean(application.licenseApplicable && !application.licenseVerifiedAt);
  return (
    <article className="rounded-(--r-md) border border-line bg-surface-1 p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-ink-1">{application.company}</h3>
            <Chip tone={application.status === "approved" ? "eco" : application.status === "needs_information" ? "copper" : "neutral"}>{STATUS_LABEL[application.status]}</Chip>
          </div>
          <p className="mt-1 text-sm text-ink-3">
            <span className="part-number">{application.reference}</span> · submitted {formatDate(application.createdAt)}
          </p>
          <p className="mt-2 text-sm text-ink-2">Applicant sees: “{APPLICANT_COPY[application.status]}”</p>
        </div>
        <a href={`mailto:${application.email}`} className="inline-flex min-h-11 items-center text-sm font-medium text-ink-1 underline underline-offset-4">
          Email applicant
        </a>
      </div>

      <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Contact" value={`${application.contactName} · ${application.email} · ${application.phone}`} />
        <Detail label="Business" value={[application.entityType, application.businessType].filter(Boolean).join(" · ") || "Not provided"} />
        <Detail label="License" value={application.licenseApplicable ? [application.licenseState, application.licenseNumber].filter(Boolean).join(" ") : "Marked not applicable"} />
        <Detail label="Tax / resale" value={[application.taxIdLast4 ? `Tax ID ending ${application.taxIdLast4}` : null, application.resaleCertificateNumber].filter(Boolean).join(" · ") || "No resale certificate"} />
        <Detail label="Service area" value={application.serviceArea ?? "Not provided"} />
        <Detail label="Monthly volume" value={application.monthlyVolume ?? "Not provided"} />
        <Detail label="Brands" value={application.brands ?? "Not specified"} />
        <Detail label="Current reason" value={application.reason ?? "No reason recorded"} />
      </dl>
      {application.notes && <p className="mt-4 rounded-(--r-sm) bg-surface-2 p-3 text-sm leading-6 text-ink-2"><strong className="font-medium text-ink-1">Applicant notes:</strong> {application.notes}</p>}

      <section className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2" aria-label="Credential verification">
        <div>
          <h4 className="font-medium">Contractor license</h4>
          <p className="mt-2 text-sm">{application.licenseVerifiedAt ? `${application.licenseClassification} · checked ${formatDate(application.licenseVerifiedAt)}` : "No license check recorded."}</p>
          {application.licenseState?.toLowerCase() === "ca" && application.licenseNumber && <a className="inline-flex min-h-11 items-center text-sm underline underline-offset-4" href={cslbLookupHref(application.licenseNumber)} target="_blank" rel="noopener noreferrer">Check license with CSLB (opens a new tab)</a>}
          {application.licenseApplicable && (!readOnly || application.status === "approved") && <form action={recordLicenseCheckAction} className="mt-3 grid gap-3">
            <input type="hidden" name="applicationId" value={application.id} />
            <label className="text-sm">License classification<input name="classification" required maxLength={4} placeholder="C-20" defaultValue={application.licenseClassification ?? ""} className="mt-1 block h-11 w-full rounded-(--r-sm) border border-line px-3" /></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required className="mt-1" />I checked the license and classification with the issuing board.</label>
            <button className="min-h-11 rounded-(--r-sm) border border-line px-4 text-sm" type="submit">Record license check</button>
          </form>}
        </div>
        <div>
          <h4 className="font-medium">EPA 608 certificate</h4>
          <p className="mt-2 break-words text-sm">{application.epa608Type?.replaceAll("_", " ") ?? "Not supplied"}{application.epa608Number ? ` · ${application.epa608Number}` : ""}{application.epa608SightedAt ? ` · card sighted ${formatDate(application.epa608SightedAt)}` : " · card not yet sighted"}</p>
          {(!readOnly || application.status === "approved") && <form action={recordEpa608Action} className="mt-3 grid gap-3">
            <input type="hidden" name="applicationId" value={application.id} />
            <label className="text-sm">Certification type<select name="type" required defaultValue={application.epa608Type ?? ""} className="mt-1 block h-11 w-full rounded-(--r-sm) border border-line px-3"><option value="" disabled>Select a type</option><option value="type_i">Type I</option><option value="type_ii">Type II</option><option value="type_iii">Type III</option><option value="universal">Universal</option></select></label>
            <label className="text-sm">Certificate number<input name="certificateNumber" required minLength={4} maxLength={40} defaultValue={application.epa608Number ?? ""} className="mt-1 block h-11 w-full rounded-(--r-sm) border border-line px-3" /></label>
            <button type="submit" className="min-h-11 rounded-(--r-sm) border border-line px-4 text-sm">Record card as sighted</button>
          </form>}
        </div>
      </section>

      {!readOnly && (transitions.length > 0 || approvable) && (
        <div className="mt-6 grid gap-4 border-t border-line pt-5 lg:grid-cols-2">
          {transitions.length > 0 && (
            <form action={reviewDealerApplicationAction} className="rounded-(--r-sm) border border-line p-4">
              <input type="hidden" name="applicationId" value={application.id} />
              <label htmlFor={`decision-${application.id}`} className="text-sm font-medium text-ink-1">Review decision</label>
              <select id={`decision-${application.id}`} name="decision" required className="mt-2 h-11 w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm text-ink-1">
                {transitions.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
              </select>
              <label htmlFor={`reason-${application.id}`} className="mt-3 block text-sm font-medium text-ink-1">Audit note</label>
              <textarea id={`reason-${application.id}`} name="reason" required minLength={3} maxLength={240} rows={2} className="mt-2 w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3 py-2 text-sm text-ink-1" />
              <button type="submit" className="mt-3 inline-flex min-h-11 items-center rounded-(--r-sm) border border-line-strong px-4 text-sm font-medium text-ink-1 hover:bg-surface-2">Save review state</button>
            </form>
          )}
          {approvable && (
            <form action={approveDealerApplicationAction} className="rounded-(--r-sm) border border-state-success-line bg-state-success p-4">
              <input type="hidden" name="applicationId" value={application.id} />
              <label htmlFor={`tier-${application.id}`} className="text-sm font-medium text-ink-1">Approved price tier</label>
              <select id={`tier-${application.id}`} name="priceTier" required defaultValue="standard" className="mt-2 h-11 w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm text-ink-1">
                <option value="standard">Standard trade</option>
                <option value="preferred">Preferred trade</option>
                <option value="volume">Volume trade</option>
              </select>
              <p className="mt-3 text-sm leading-6 text-ink-2">Approval links the existing sign-in when present and updates account access atomically.</p>
              {needsLicenseCheck && <p className="mt-3 text-sm" id={`license-block-${application.id}`}>Record the license check before approving this application.</p>}
              <button type="submit" disabled={needsLicenseCheck} aria-describedby={needsLicenseCheck ? `license-block-${application.id}` : undefined} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50">
                <UserRoundCheck size={17} aria-hidden="true" /> Approve account
              </button>
            </form>
          )}
        </div>
      )}

      <details className="mt-5 border-t border-line pt-4">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-ink-1"><History size={16} aria-hidden="true" /> Audit history ({application.events.length})</summary>
        {application.events.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">No transition events were returned.</p>
        ) : (
          <ol className="mt-2 space-y-2 text-sm text-ink-2">
            {application.events.map((event) => (
              <li key={event.id} className="rounded-(--r-sm) bg-surface-2 p-3">
                <span className="font-medium text-ink-1">{event.fromStatus ? `${STATUS_LABEL[event.fromStatus]} → ` : ""}{STATUS_LABEL[event.toStatus]}</span>
                {event.reason ? ` · ${event.reason}` : ""}
                <span className="mt-1 block text-xs text-ink-3">{formatDate(event.createdAt)} · actor {event.actor}</span>
              </li>
            ))}
          </ol>
        )}
      </details>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</dt><dd className="mt-1 break-words text-sm leading-6 text-ink-1">{value}</dd></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
