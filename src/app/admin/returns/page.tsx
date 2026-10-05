import { RotateCcw, ShieldCheck, PhoneCall } from "lucide-react";
import { Container, Chip } from "@/components/ui";
import { Notice } from "@/components/state";
import { LiveRefresh } from "@/components/admin/live-refresh";
import { readFlash } from "@/lib/backend/admin-flash";
import { listReturns, orderLinesForStaff, suggestedRefund, type RmaRow } from "@/lib/backend/returns";
import { listWarrantyClaims, type WarrantyRow } from "@/lib/backend/warranty";
import { returnsRulesAreConfirmed } from "@/lib/returns-policy";
import { decideReturnAction, openCallerReturnAction, updateWarrantyAction } from "./actions";

export const metadata = { title: "Returns & warranty" };
export const dynamic = "force-dynamic";

const OUTCOME_LABEL: Record<string, string> = {
  full_refund: "Likely full refund",
  refund_less_restocking: "Likely refund less restocking",
  not_returnable: "Likely not returnable",
  damage_claim: "Damage claim",
  late_damage_claim: "Late damage claim",
  warranty: "Warranty",
};

const STATUS_TONE: Record<string, "brand" | "copper" | "eco" | "neutral"> = { open: "copper", waiting: "brand", approved: "eco", closed: "neutral" };
const WARRANTY_STATUS: Record<string, string> = { open: "New", waiting: "Waiting on customer", approved: "With manufacturer", closed: "Closed" };

const currency = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }) : "n/a");
const age = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

const inputCls = "min-h-10 w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";
const buttonCls = "inline-flex min-h-10 items-center rounded-(--r-sm) border border-line bg-surface-1 px-3 text-sm font-medium text-ink-1 hover:bg-surface-2";

export default async function ReturnsAdminPage({ searchParams }: PageProps<"/admin/returns">) {
  const { order } = (await searchParams) as { order?: string };
  const flash = await readFlash();
  let returns: Awaited<ReturnType<typeof listReturns>> = [];
  let claims: WarrantyRow[] = [];
  let unavailable = false;
  try {
    [returns, claims] = await Promise.all([listReturns(), listWarrantyClaims()]);
  } catch {
    unavailable = true;
  }
  const caller = order && /^[A-Za-z0-9-]{3,40}$/.test(order) ? await orderLinesForStaff(order).catch(() => null) : null;
  const openReturns = returns.filter((rma) => rma.status !== "closed");
  const openClaims = claims.filter((claim) => claim.status !== "closed");

  return (
    <Container className="py-10 lg:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">Returns &amp; warranty</h1>
          <p className="mt-2 max-w-2xl text-ink-2">
            Every return and warranty claim lands here and in your task list. Actions are logged under your name; anything that changes the
            outcome emails the customer.
          </p>
        </div>
        <LiveRefresh />
      </div>

      {flash && (
        <Notice tone={flash.tone} role={flash.tone === "danger" ? "alert" : "status"} className="mt-6">
          {flash.text}
        </Notice>
      )}
      {!returnsRulesAreConfirmed() && (
        <Notice tone="warning" className="mt-6" title="Return rules are not confirmed by operations yet">
          Customers aren&apos;t shown a preliminary outcome; you decide the terms for each return. The restocking-fee suggestion below uses the
          draft rules.
        </Notice>
      )}
      {unavailable && (
        <Notice tone="danger" className="mt-6" title="Returns couldn't be loaded">
          The database isn&apos;t reachable from this server.
        </Notice>
      )}

      <Section icon={<RotateCcw size={16} aria-hidden="true" />} title="Open returns" count={openReturns.length}>
        {openReturns.length === 0 && <p className="text-sm text-ink-3">No open returns.</p>}
        {openReturns.map((rma) => (
          <ReturnCard key={rma.id} rma={rma} />
        ))}
      </Section>

      <Section icon={<ShieldCheck size={16} aria-hidden="true" />} title="Open warranty claims" count={openClaims.length}>
        {openClaims.length === 0 && <p className="text-sm text-ink-3">No open warranty claims.</p>}
        {openClaims.map((claim) => (
          <WarrantyCard key={claim.id} claim={claim} />
        ))}
      </Section>

      <Section icon={<PhoneCall size={16} aria-hidden="true" />} title="Open a return for a caller" count={null}>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-1">
            Order number
            <input name="order" defaultValue={order ?? ""} maxLength={40} className={`${inputCls} w-48`} placeholder="SO-…" />
          </label>
          <button type="submit" className={buttonCls}>
            Find order
          </button>
        </form>
        {order && !caller && <p className="text-sm text-state-danger-ink">No order {order}.</p>}
        {caller && (
          <form action={openCallerReturnAction} className="grid gap-3 rounded-(--r-md) border border-line bg-surface-1 p-4 sm:grid-cols-2">
            <input type="hidden" name="orderNumber" value={caller.orderNumber} />
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-1 sm:col-span-2">
              Line
              <select name="lineId" required className={inputCls}>
                {caller.lines.map((line) => (
                  <option key={line.lineId} value={line.lineId} disabled={Boolean(line.openRma) || line.returnable === 0}>
                    {line.description} ({line.returnable} returnable{line.openRma ? `, ${line.openRma} open` : ""})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-1">
              Quantity
              <input name="quantity" type="number" min={1} defaultValue={1} required className={inputCls} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-1">
              Reason
              <select name="reason" required className={inputCls}>
                <option value="wrong_item">Wrong item received</option>
                <option value="damaged">Damaged in transit</option>
                <option value="defective">Dead on arrival / defective</option>
                <option value="changed_mind">No longer needed</option>
                <option value="ordered_wrong">Ordered the wrong item</option>
                <option value="job_cancelled">Job cancelled</option>
              </select>
            </label>
            <fieldset className="flex flex-col gap-1 text-sm text-ink-1">
              <legend className="font-medium">Arrived damaged or wrong?</legend>
              <span className="flex gap-4">
                <label className="flex items-center gap-1.5"><input type="radio" name="damaged" value="yes" required /> Yes</label>
                <label className="flex items-center gap-1.5"><input type="radio" name="damaged" value="no" /> No</label>
              </span>
            </fieldset>
            <fieldset className="flex flex-col gap-1 text-sm text-ink-1">
              <legend className="font-medium">Installed?</legend>
              <span className="flex gap-4">
                <label className="flex items-center gap-1.5"><input type="radio" name="installed" value="yes" required /> Yes</label>
                <label className="flex items-center gap-1.5"><input type="radio" name="installed" value="no" /> No</label>
              </span>
            </fieldset>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-1 sm:col-span-2">
              What the caller said
              <textarea name="notes" rows={2} maxLength={2000} className={`${inputCls} py-2`} />
            </label>
            <button type="submit" className={`${buttonCls} self-start`}>
              Open return
            </button>
          </form>
        )}
      </Section>

      {(returns.length > openReturns.length || claims.length > openClaims.length) && (
        <Section icon={null} title="Recently closed" count={returns.length - openReturns.length + claims.length - openClaims.length}>
          <ul className="divide-y divide-line rounded-(--r-md) border border-line bg-surface-1 text-sm">
            {returns
              .filter((rma) => rma.status === "closed")
              .slice(0, 25)
              .map((rma) => (
                <li key={rma.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span className="font-mono text-xs">{rma.rma_number}</span>
                  <span className="text-ink-2">{rma.line_description}</span>
                  <span className="text-ink-3">
                    {rma.decision ?? "closed"}
                    {rma.refund_amount ? ` · refunded ${currency(Number(rma.refund_amount))}` : ""} · {when(rma.closed_at)}
                  </span>
                </li>
              ))}
            {claims
              .filter((claim) => claim.status === "closed")
              .slice(0, 25)
              .map((claim) => (
                <li key={claim.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                  <span className="font-mono text-xs">{claim.claim_number}</span>
                  <span className="text-ink-2">{claim.model_number}</span>
                  <span className="text-ink-3">warranty · {when(claim.created_at)}</span>
                </li>
              ))}
          </ul>
        </Section>
      )}
    </Container>
  );
}

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number | null; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2">
        {icon && <span className="grid size-8 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">{icon}</span>}
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink-1">{title}</h2>
        {count !== null && <Chip tone="neutral">{count}</Chip>}
      </div>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function ActionForm({ id, idName, action, value, label, field, placeholder, extra, formAction }: { id: string; idName: string; action: string; value?: string; label: string; field: string; placeholder: string; extra?: React.ReactNode; formAction: (form: FormData) => Promise<void> }) {
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-(--r-sm) border border-line p-3">
      <input type="hidden" name={idName} value={id} />
      <input type="hidden" name="action" value={action} />
      {extra}
      <input name={field} defaultValue={value} maxLength={2000} className={inputCls} placeholder={placeholder} aria-label={`${label}: ${placeholder}`} />
      <button type="submit" className={`${buttonCls} self-start`}>
        {label}
      </button>
    </form>
  );
}

function ReturnCard({ rma }: { rma: RmaRow & { order_number: string | null; line_description: string | null; unit_price: number | null } }) {
  const suggestion = rma.unit_price !== null ? suggestedRefund(rma.unit_price, rma.quantity ?? 1, rma.preliminary_outcome) : null;
  return (
    <article className="rounded-(--r-md) border border-line bg-surface-1 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-ink-1">
            {rma.rma_number} · order {rma.order_number ?? "?"}
          </p>
          <p className="text-sm text-ink-1">
            {rma.quantity ?? 1} × {rma.line_description ?? "item"}
          </p>
          <p className="text-xs text-ink-3">
            {rma.requester_name ?? "Customer"} · {rma.requester_email ?? "no email"} · via {(rma.channel ?? "portal").replace("_", " ")} · {age(rma.created_at)}d old
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={STATUS_TONE[rma.status] ?? "neutral"}>{rma.status}</Chip>
          {rma.preliminary_outcome && <Chip tone="neutral">{OUTCOME_LABEL[rma.preliminary_outcome] ?? rma.preliminary_outcome}</Chip>}
          {rma.received_at && <Chip tone="eco">Received {when(rma.received_at)}</Chip>}
          {rma.refund_amount !== null && <Chip tone="eco">Refunded {currency(Number(rma.refund_amount))}</Chip>}
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Reason: {rma.reason.replaceAll("_", " ")}
        {rma.facts ? ` · ${Object.entries(rma.facts).map(([key, value]) => `${key}: ${String(value)}`).join(", ")}` : ""}
      </p>
      {rma.staff_notes && <pre className="mt-2 whitespace-pre-wrap rounded-(--r-sm) bg-surface-2 p-2 font-sans text-xs text-ink-2">{rma.staff_notes}</pre>}
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {rma.status !== "approved" && <ActionForm formAction={decideReturnAction} id={rma.id} idName="rmaId" action="approve" field="note" label="Approve return" placeholder="Terms, e.g. bring to counter; 15% restocking" />}
        <ActionForm formAction={decideReturnAction} id={rma.id} idName="rmaId" action="request_info" field="message" label="Ask the customer" placeholder="What we need (emailed)" />
        {!rma.received_at && <ActionForm formAction={decideReturnAction} id={rma.id} idName="rmaId" action="received" field="note" label="Received & inspected" placeholder="Condition notes" />}
        {rma.refund_amount === null && (
          <ActionForm
            formAction={decideReturnAction}
            id={rma.id}
            idName="rmaId"
            action="refund"
            field="note"
            label="Refund"
            placeholder="Note for the record"
            extra={<input name="amount" type="number" step="0.01" min="0.01" defaultValue={suggestion ?? undefined} required className={inputCls} aria-label="Refund amount in dollars" />}
          />
        )}
        <ActionForm formAction={decideReturnAction} id={rma.id} idName="rmaId" action="decline" field="reason" label="Decline" placeholder="Why (emailed)" />
        <ActionForm formAction={decideReturnAction} id={rma.id} idName="rmaId" action="close" field="reason" label="Close" placeholder="Outcome for the record" />
      </div>
    </article>
  );
}

function WarrantyCard({ claim }: { claim: WarrantyRow }) {
  return (
    <article className="rounded-(--r-md) border border-line bg-surface-1 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-ink-1">
            {claim.claim_number}
            {claim.order_ref ? ` · order ${claim.order_ref}${claim.order_id ? "" : " (not matched)"}` : " · counter sale or no order"}
          </p>
          <p className="text-sm text-ink-1">
            {claim.product_description} · model {claim.model_number} · serial {claim.serial_number}
          </p>
          <p className="text-xs text-ink-3">
            {claim.claimant_name} · {claim.claimant_email} · {claim.claimant_phone} · {age(claim.created_at)}d old
          </p>
          <p className="text-xs text-ink-3">
            Installed {claim.install_date ?? "?"} by {claim.installer_name ?? "?"}
            {claim.installer_license ? ` (license ${claim.installer_license})` : ""}
          </p>
        </div>
        <Chip tone={STATUS_TONE[claim.status] ?? "neutral"}>{WARRANTY_STATUS[claim.status] ?? claim.status}</Chip>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">{claim.issue}</p>
      {claim.staff_notes && <pre className="mt-2 whitespace-pre-wrap rounded-(--r-sm) bg-surface-2 p-2 font-sans text-xs text-ink-2">{claim.staff_notes}</pre>}
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <ActionForm formAction={updateWarrantyAction} id={claim.id} idName="claimId" action="note" field="note" label="Add note" placeholder="Internal only" />
        <ActionForm formAction={updateWarrantyAction} id={claim.id} idName="claimId" action="request_info" field="message" label="Ask the customer" placeholder="Photos, registration… (emailed)" />
        {claim.status !== "approved" && <ActionForm formAction={updateWarrantyAction} id={claim.id} idName="claimId" action="with_manufacturer" field="note" label="Sent to manufacturer" placeholder="Claim # with them (emailed)" />}
        <ActionForm formAction={updateWarrantyAction} id={claim.id} idName="claimId" action="close" field="resolution" label="Close" placeholder="Resolution (emailed)" />
      </div>
    </article>
  );
}
