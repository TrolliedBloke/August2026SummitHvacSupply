import Link from "next/link";
import { Container } from "@/components/ui";
import { referralQueue } from "@/lib/backend/referrals";
import { REFERRAL_OUTCOMES } from "@/lib/referrals";
import { introduceInstaller, recordReferralOutcome } from "./actions";

export const metadata = { title: "Installer referrals", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const control = "mt-1 block min-h-11 w-full rounded-(--r-sm) border border-line bg-surface-1 px-3 py-2";

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const queue = await referralQueue();
  return <Container className="py-10">
    <Link href="/admin" className="inline-flex min-h-11 items-center text-sm underline">Operations dashboard</Link>
    <h1 className="mt-3 text-3xl font-medium">Installer referrals</h1>
    <p className="mt-3 max-w-3xl text-ink-2">Coordinate the introduction with the homeowner and installer, then record it here. Saving does not send a message.</p>
    {notice && <p role={notice === "saved" ? "status" : "alert"} className="mt-4">{notice === "saved" ? "Referral saved." : notice === "invalid" ? "Check the fields and confirm the introduction." : "Could not save. Reload and check that the installer is still available."}</p>}
    {!queue ? <p className="mt-6">Connect the branch database to manage referrals.</p> : <>
      <h2 className="mt-8 text-xl font-medium">Open homeowner requests</h2>
      {queue.requests.filter((request) => ["received", "needs_information"].includes(request.status)).length === 0 && <p className="mt-3 text-sm">No open requests.</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{queue.requests.filter((request) => ["received", "needs_information"].includes(request.status)).map((request) => {
        const matches = queue.installers.filter((installer) => (installer.referral_zips as string[]).includes(request.zip));
        return <article key={request.id} className="rounded-(--r-md) border border-line p-5">
          <h3 className="font-medium">{request.name} · {request.reference}</h3>
          <p className="mt-2 break-words text-sm">{request.email} · {request.phone ?? "No phone"}</p>
          <p className="mt-2 text-sm">{request.zip} · {request.home_type} · ducts: {request.existing_ducts} · {request.timeline}</p>
          {request.notes && <p className="mt-2 text-sm">{request.notes}</p>}
          {!request.consent_to_contact ? <p className="mt-4 text-sm">Consent is required before an introduction.</p> : matches.length === 0 ? <p className="mt-4 text-sm">No available, verified installers cover this ZIP.</p> : <form action={introduceInstaller} className="mt-4 grid gap-3">
            <input type="hidden" name="requestId" value={request.id} />
            <label className="text-sm">Installer<select name="accountId" required className={control}>{matches.map((installer) => <option key={installer.id} value={installer.id}>{installer.name}</option>)}</select></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required className="mt-1" />The homeowner agreed to this installer and staff completed the introduction.</label>
            <button type="submit" className="min-h-11 rounded-(--r-sm) bg-brand px-4 text-sm text-brand-ink">Record introduction</button>
          </form>}
        </article>;
      })}</div>
      <h2 className="mt-8 text-xl font-medium">Introductions and outcomes</h2>
      <p className="mt-2 max-w-3xl text-sm text-ink-2">Paid account orders after an introduction are a reporting signal, not confirmed referral revenue. Each order is counted once, against that account’s most recent preceding introduction.</p>
      {queue.referrals.length === 0 && <p className="mt-3 text-sm">No introductions recorded.</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{queue.referrals.map((referral) => {
        const request = queue.requests.find((row) => row.id === referral.homeowner_request_id);
        const account = referral.accounts as unknown as { name: string } | null;
        const tally = queue.attribution.get(referral.id)!;
        return <article key={referral.id} className="rounded-(--r-md) border border-line p-5">
          <h3 className="font-medium">{request?.reference ?? "Homeowner request"} → {account?.name ?? "Installer"}</h3>
          <p className="mt-2 text-sm">{new Date(referral.introduced_at).toLocaleDateString("en-US")} · {tally.orders} paid orders · {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(tally.total)}</p>
          <form action={recordReferralOutcome} className="mt-4 grid gap-3">
            <input type="hidden" name="referralId" value={referral.id} />
            <label className="text-sm">Outcome<select name="outcome" defaultValue={referral.outcome} className={control}>{REFERRAL_OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{outcome.replaceAll("_", " ")}</option>)}</select></label>
            <label className="text-sm">Staff notes<textarea name="notes" rows={2} maxLength={1000} defaultValue={referral.notes ?? ""} className={control} /></label>
            <button type="submit" className="min-h-11 rounded-(--r-sm) border border-line px-4 text-sm">Save outcome</button>
          </form>
        </article>;
      })}</div>
    </>}
  </Container>;
}
