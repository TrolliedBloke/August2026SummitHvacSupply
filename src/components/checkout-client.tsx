"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Truck, Store, PackageCheck, ArrowRight, Lock, RotateCcw, ShieldCheck, Loader2 } from "lucide-react";
import { MAX_CART_QUANTITY, useQuote } from "./quote-context";
import { useFulfillment } from "./fulfillment-context";
import { ZipGate } from "./zip-gate";
import { CustomSelect } from "./custom-select";
import { Notice } from "./state";
import type { FulfillmentMethod } from "@/lib/backend/fulfillment";
import { diffSnapshots, type CheckoutSnapshot, type SnapshotDiff } from "@/lib/checkout-snapshot-types";
import { PURCHASE } from "@/lib/site";
import { track } from "@/lib/track";

/* One input treatment for the whole checkout -- visible focus ring included. */
const inputCls =
  "h-11 w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm text-ink-1 " +
  "placeholder:text-ink-4 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 " +
  "aria-[invalid=true]:border-state-danger-ink aria-[invalid=true]:focus:ring-state-danger-ink/20";

const METHOD_ICON: Record<FulfillmentMethod, React.ReactNode> = {
  pickup: <Store size={18} strokeWidth={2.2} aria-hidden="true" />,
  local_delivery: <Truck size={18} strokeWidth={2.2} aria-hidden="true" />,
  freight: <PackageCheck size={18} strokeWidth={2.2} aria-hidden="true" />,
};

/* Contact and delivery details survive a refresh or a failed submit. Session
   storage only, versioned, and never payment data -- card entry happens in
   Stripe's own field on the next step. */
const DRAFT_KEY = "summit-checkout-draft-v1";
type Draft = { method: FulfillmentMethod; windowSlot: string; address: string; company: string; phone: string; role: string; poNumber: string; buyerName: string; buyerEmail: string; pickupName: string };
const EMPTY_DRAFT: Draft = { method: "pickup", windowSlot: "", address: "", company: "", phone: "", role: "contractor", poNumber: "", buyerName: "", buyerEmail: "", pickupName: "" };

function currency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

type SnapshotState = { status: "loading" } | { status: "ready"; snapshot: CheckoutSnapshot } | { status: "error"; message: string };

/**
 * Checkout renders the server's signed snapshot and nothing else: unit prices
 * by the session's authorization, stock, fulfillment methods and windows,
 * fee, tax and total. The order is submitted with that snapshot's token; if
 * anything moved in between, the server answers 409 with the current snapshot,
 * the differences are shown line by line, and the buyer confirms before
 * retrying. A fulfillment method that disappears is never swapped silently.
 */
export function CheckoutClient() {
  const router = useRouter();
  const { items, hydrated, setQty, clear } = useQuote();
  const { zip } = useFulfillment();
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [draftLoaded, setDraftLoaded] = React.useState(false);
  const [snapshotState, setSnapshotState] = React.useState<SnapshotState>({ status: "loading" });
  const [refresh, setRefresh] = React.useState(0);
  const [diffs, setDiffs] = React.useState<SnapshotDiff[] | null>(null);
  const [acknowledged, setAcknowledged] = React.useState(false);
  /** Versions of the compliance acknowledgements the buyer ticked. */
  const [acceptedTerms, setAcceptedTerms] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const submitLockRef = React.useRef(false);
  const idempotencyKeyRef = React.useRef<string | null>(null);

  const cartLines = items.filter((item) => item.intent === "cart");
  const requestLines = items.filter((item) => item.intent !== "cart");
  const linesKey = JSON.stringify(cartLines.map((item) => [item.skuId, item.qty]));

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      const saved = raw ? (JSON.parse(raw) as { version: number; draft: Draft }) : null;
      queueMicrotask(() => {
        if (saved?.version === 1) setDraft({ ...EMPTY_DRAFT, ...saved.draft });
        setDraftLoaded(true);
      });
    } catch {
      queueMicrotask(() => setDraftLoaded(true));
    }
  }, []);
  React.useEffect(() => {
    if (!draftLoaded) return;
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, draft }));
    } catch {
      /* in-memory draft still survives failed submits */
    }
  }, [draft, draftLoaded]);

  // Preflight whenever the lines, ZIP or method change.
  React.useEffect(() => {
    const lines = JSON.parse(linesKey) as Array<[string, number]>;
    if (!hydrated || lines.length === 0) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch("/api/checkout/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ items: lines.map(([skuId, qty]) => ({ skuId, qty })), method: draft.method, zip: zip && /^\d{5}$/.test(zip) ? zip : null }),
      })
        .then(async (response) => ({ ok: response.ok, payload: await response.json() }))
        .then(({ ok, payload }) => {
          if (cancelled) return;
          if (!ok || !payload.ok) throw new Error(payload?.error);
          setSnapshotState({ status: "ready", snapshot: payload.snapshot });
        })
        .catch((cause: unknown) => {
          if (!cancelled) setSnapshotState({ status: "error", message: cause instanceof Error && cause.message ? cause.message : "Prices could not be confirmed right now." });
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [linesKey, zip, draft.method, hydrated, refresh]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const snapshot = snapshotState.status === "ready" ? snapshotState.snapshot : null;
  const methodEntry = snapshot?.methods.find((entry) => entry.method === draft.method);
  const windows = methodEntry?.windows ?? [];
  const needsAddress = draft.method === "local_delivery";
  const lineErrors = snapshot?.lines.filter((line) => line.error) ?? [];

  if (!hydrated) {
    return (
      <div className="mt-8 grid gap-4" aria-busy="true" aria-label="Loading checkout">
        <div className="h-24 animate-pulse rounded-(--r-md) bg-skeleton" />
        <div className="h-64 animate-pulse rounded-(--r-md) bg-skeleton" />
      </div>
    );
  }

  if (cartLines.length === 0) {
    return (
      <div className="mt-10 rounded-(--r-md) border border-line bg-surface-1 p-10 text-center">
        <p className="text-ink-2">{requestLines.length ? "Nothing in your cart is ready for checkout yet." : "Your cart is empty."}</p>
        {requestLines.length > 0 && (
          <Link href="/quote" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-1 underline underline-offset-4">
            Send {requestLines.length} {requestLines.length === 1 ? "item" : "items"} to the counter for a quote <ArrowRight size={15} aria-hidden="true" />
          </Link>
        )}
        <Link href="/products" className="mt-4 block text-sm font-semibold text-brand hover:text-brand-hover">
          Browse the lineup
        </Link>
      </div>
    );
  }

  const fieldErrors: Record<string, string | null> = {
    buyerName: draft.buyerName.trim().length > 1 ? null : "Enter your full name.",
    buyerEmail: /.+@.+\..+/.test(draft.buyerEmail) ? null : "Enter a valid email. Your order confirmation goes here.",
    phone: draft.phone.replace(/\D/g, "").length >= 7 ? null : "Enter a phone number we can reach you at.",
    address: !needsAddress || draft.address.trim().length > 4 ? null : "Enter the delivery street address, city, and ZIP.",
    window: draft.method === "freight" || windows.some((window) => window.id === draft.windowSlot) ? null : "Choose an available fulfillment window.",
  };
  const invalidFields = Object.entries(fieldErrors).filter(([, message]) => message !== null);
  const showError = (field: string) => (touched[field] ? fieldErrors[field] : null);
  const requiredTerms = snapshot?.acknowledgements ?? [];
  const termsMissing = requiredTerms.some((term) => !acceptedTerms.includes(term.version));
  const blocked = !snapshot || lineErrors.length > 0 || !snapshot.methodAvailable || (snapshot.payment === "card" && snapshot.tax.status === "unavailable") || (diffs !== null && !acknowledged) || termsMissing;

  async function placeOrder(current: CheckoutSnapshot) {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      idempotencyKeyRef.current ??= crypto.randomUUID();
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          snapshotToken: current.token,
          items: cartLines.map((item) => ({ skuId: item.skuId, sku: item.sku, modelNumber: item.modelNumber || item.sku, title: item.title, qty: item.qty })),
          method: draft.method,
          zip: zip ?? undefined,
          address: needsAddress ? draft.address : undefined,
          company: draft.company,
          phone: draft.phone,
          role: draft.role,
          poNumber: draft.poNumber,
          window: draft.method !== "freight" ? draft.windowSlot : undefined,
          buyerName: draft.buyerName,
          buyerEmail: draft.buyerEmail,
          pickupName: draft.method === "pickup" && draft.pickupName.trim() ? draft.pickupName.trim() : undefined,
          acknowledgements: acceptedTerms.filter((version) => current.acknowledgements.some((term) => term.version === version)),
        }),
      });
      const data = await response.json();
      if (response.status === 409 && data.snapshot) {
        // Reconcile: show what changed, require acknowledgment, and use a new
        // idempotency key for the corrected order.
        setDiffs(diffSnapshots(current, data.snapshot));
        setAcknowledged(false);
        setSnapshotState({ status: "ready", snapshot: data.snapshot });
        idempotencyKeyRef.current = null;
        setError(data.error ?? "Your order changed since you reviewed it.");
        return;
      }
      if (!data.ok) throw new Error(data.error ?? "Checkout failed");

      track(data.checkoutState === "confirmed" ? "checkout_completed" : "payment_pending", { total: current.total, method: draft.method });
      sessionStorage.setItem("summit-last-order", JSON.stringify(data));
      if (data.checkoutState === "confirmed") {
        clear();
        sessionStorage.removeItem(DRAFT_KEY);
      }
      router.push(`/checkout/confirmation?token=${encodeURIComponent(data.confirmationToken)}`);
    } catch (cause) {
      // Network or server failure: the same idempotency key is kept, so a retry cannot place a second order.
      setError(cause instanceof Error ? cause.message : "Checkout failed. Nothing was charged; try again.");
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  function handleSubmit() {
    if (submitLockRef.current || submitting || !snapshot) return;
    if (invalidFields.length > 0) {
      setTouched({ buyerName: true, buyerEmail: true, phone: true, address: true, window: true });
      setError(invalidFields.length === 1 ? "One field needs attention before we can place the order." : `${invalidFields.length} fields need attention before we can place the order.`);
      return;
    }
    setError(null);
    void placeOrder(snapshot);
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
      <div className="flex min-w-0 flex-col gap-8">
        {requestLines.length > 0 && (
          <Notice tone="info" title={`${requestLines.length} ${requestLines.length === 1 ? "item needs" : "items need"} a quote first`}>
            {requestLines.length === 1 ? "It stays" : "They stay"} in your cart and {requestLines.length === 1 ? "is" : "are"} not part of this order.{" "}
            <Link href="/quote" className="font-medium text-ink-1 underline underline-offset-4">Request a quote</Link>
          </Notice>
        )}
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-ink-1">1. Where it goes</h2>
          <div className="mt-3">
            <ZipGate />
          </div>
          <fieldset className="mt-4 grid gap-3 border-0 p-0">
            <legend className="sr-only">Fulfillment method</legend>
            {(snapshot?.methods ?? []).map((option) => (
              <label
                key={option.method}
                className={`flex cursor-pointer items-center gap-4 rounded-(--r-md) border p-4 text-left transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${
                  draft.method === option.method ? "border-brand bg-brand-tint" : option.available ? "border-line bg-surface-1 hover:border-line-strong" : "cursor-not-allowed border-dashed border-line bg-surface-2/40 opacity-70"
                }`}
              >
                <input
                  type="radio"
                  name="fulfillment-method"
                  value={option.method}
                  checked={draft.method === option.method}
                  disabled={!option.available && draft.method !== option.method}
                  onChange={() => {
                    set("method", option.method);
                    set("windowSlot", "");
                  }}
                  className="sr-only"
                />
                <span className="grid size-10 shrink-0 place-items-center rounded-(--r-sm) bg-surface-2 text-ink-2">{METHOD_ICON[option.method]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium text-ink-1">
                    {option.label}
                    {option.fee !== null && option.fee > 0 && <span className="text-sm text-ink-3">{currency(option.fee)}</span>}
                  </span>
                  <span className="block text-sm text-ink-2">{option.available ? option.detail : "Not available for this ZIP."}</span>
                </span>
                {draft.method === option.method && <Check size={18} className="text-brand" strokeWidth={2.5} aria-hidden="true" />}
              </label>
            ))}
          </fieldset>
          {snapshot && !snapshot.methodAvailable && (
            <Notice tone="warning" role="alert" className="mt-3" title="Your chosen option is not available any more">
              Choose one of the available options above to continue. We never switch it for you.
            </Notice>
          )}
          <p className="mt-3 flex items-start gap-2 rounded-(--r-sm) bg-surface-2/70 px-3 py-2.5 text-sm leading-snug text-ink-2">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span>
              {draft.method === "pickup" && "We confirm your order before it leaves the counter and stage it under your name at Newark will-call. Bring photo ID; we check it before releasing the order."}
              {draft.method === "local_delivery" && "We confirm your order before dispatch and send a confirmed delivery window. Someone should be on site to inspect the equipment and note any damage before signing."}
              {draft.method === "freight" && "Freight is quoted and confirmed with you before your card is charged anything beyond the item total."}
            </span>
          </p>
        </section>

        {draft.method !== "freight" && (
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-ink-1">2. {draft.method === "pickup" ? "Pickup window" : "Delivery window"}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {windows.map((window) => (
                <button
                  key={window.id}
                  type="button"
                  aria-pressed={draft.windowSlot === window.id}
                  onClick={() => {
                    set("windowSlot", window.id);
                    setTouched((current) => ({ ...current, window: true }));
                  }}
                  className={`min-h-11 rounded-(--r-sm) border px-3 py-2 text-sm transition-colors ${draft.windowSlot === window.id ? "border-brand bg-brand-tint text-ink-1" : "border-line bg-surface-1 text-ink-2 hover:border-line-strong"}`}
                >
                  {window.label}
                </button>
              ))}
              {snapshot && windows.length === 0 && <p className="text-sm text-ink-3">No windows are open for this option right now.</p>}
            </div>
            {showError("window") && <p className="mt-2 text-xs font-medium text-state-danger-ink">{fieldErrors.window}</p>}
          </section>
        )}

        {needsAddress && (
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-ink-1">Jobsite address</h2>
            <label htmlFor="checkout-address" className="sr-only">Jobsite address</label>
            <input
              id="checkout-address"
              value={draft.address}
              onChange={(event) => set("address", event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, address: true }))}
              placeholder="Street, city, ZIP"
              autoComplete="street-address"
              aria-invalid={showError("address") ? true : undefined}
              aria-describedby={showError("address") ? "err-address" : undefined}
              className={`mt-3 ${inputCls}`}
            />
            {showError("address") && <p id="err-address" className="mt-1.5 text-xs font-medium text-state-danger-ink">{fieldErrors.address}</p>}
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-ink-1">3. Buyer and job details</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TextField id="buyerName" label="Full name" required autoComplete="name" value={draft.buyerName} onChange={(value) => set("buyerName", value)} error={showError("buyerName")} onBlur={() => setTouched((current) => ({ ...current, buyerName: true }))} />
            <TextField id="buyerEmail" label="Email" required type="email" autoComplete="email" value={draft.buyerEmail} onChange={(value) => set("buyerEmail", value)} error={showError("buyerEmail")} onBlur={() => setTouched((current) => ({ ...current, buyerEmail: true }))} />
            <TextField id="phone" label="Phone" required type="tel" autoComplete="tel" value={draft.phone} onChange={(value) => set("phone", value)} error={showError("phone")} onBlur={() => setTouched((current) => ({ ...current, phone: true }))} />
            <TextField id="company" label="Company" autoComplete="organization" value={draft.company} onChange={(value) => set("company", value)} />
            <div className="flex flex-col gap-1.5 text-sm font-medium text-ink-1">
              <label htmlFor="buyer-type">Buyer type</label>
              <CustomSelect
                id="buyer-type"
                value={draft.role}
                onChange={(value) => set("role", value)}
                options={[
                  { value: "contractor", label: "Contractor / installer" },
                  { value: "procurement", label: "Procurement team" },
                  { value: "property_manager", label: "Property manager" },
                  { value: "homeowner", label: "Homeowner" },
                ]}
              />
            </div>
            <TextField id="poNumber" label="PO / job number" value={draft.poNumber} onChange={(value) => set("poNumber", value)} />
            {draft.method === "pickup" && (
              <TextField id="pickupName" label="Someone else collecting? Their name" autoComplete="off" value={draft.pickupName} onChange={(value) => set("pickupName", value)} />
            )}
          </div>
        </section>

        {requiredTerms.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold tracking-tight text-ink-1">4. Installation and warranty</h2>
            <div className="mt-3 flex flex-col gap-2">
              {requiredTerms.map((term) => (
                <label key={term.version} className="flex min-h-11 items-start gap-2.5 rounded-(--r-sm) border border-line bg-surface-1 px-3 py-2.5 text-sm leading-snug text-ink-1">
                  <input
                    type="checkbox"
                    checked={acceptedTerms.includes(term.version)}
                    onChange={(event) =>
                      setAcceptedTerms((current) => (event.target.checked ? [...current, term.version] : current.filter((version) => version !== term.version)))
                    }
                    className="mt-0.5 size-4.5 shrink-0 accent-[var(--green)]"
                  />
                  <span>{term.text}</span>
                </label>
              ))}
            </div>
          </section>
        )}
        {snapshot?.reviewRequired && (
          <Notice tone="info" title="Our team reviews this order before it is released">
            Something in it needs a quick check with you first. You are not charged until it is released, and we contact you if anything changes.
          </Notice>
        )}
      </div>

      <aside className="h-fit min-w-0 rounded-(--r-md) border border-line bg-surface-1 p-6">
        <h2 className="text-lg font-semibold tracking-tight text-ink-1">Order summary</h2>
        {snapshot?.account.label && <p className="mt-1 text-xs font-medium text-state-success-ink">Account pricing · {snapshot.account.label}</p>}

        {snapshotState.status === "loading" && (
          <p className="mt-4 flex items-center gap-2 text-sm text-ink-3" role="status">
            <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Confirming current prices and stock…
          </p>
        )}
        {snapshotState.status === "error" && (
          <Notice
            tone="warning"
            className="mt-4"
            title="Prices could not be confirmed"
            action={
              <button type="button" onClick={() => setRefresh((value) => value + 1)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-1 underline underline-offset-4">
                <RotateCcw size={14} aria-hidden="true" /> Try again
              </button>
            }
          >
            {snapshotState.message} Checkout is paused until they are.
          </Notice>
        )}

        {diffs && diffs.length > 0 && (
          <div className="mt-4 rounded-(--r-sm) border border-state-warning-line bg-state-warning p-3" role="alert">
            <p className="text-sm font-medium text-state-warning-ink">Your order changed since you reviewed it</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-1">
              {diffs.map((diff, index) => (
                <li key={`${diff.kind}-${diff.skuId ?? index}`}>
                  {diff.label}: <span className="text-ink-3 line-through">{diff.before}</span> → <span className="font-medium">{diff.after}</span>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex min-h-11 items-start gap-2 text-sm text-ink-1">
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 size-4.5 accent-[var(--green)]" />
              I have reviewed these changes
            </label>
          </div>
        )}

        <ul className="mt-4 flex flex-col divide-y divide-line">
          {cartLines.map((item) => {
            const line = snapshot?.lines.find((entry) => entry.skuId === item.skuId);
            return (
              <li key={item.skuId} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-sm font-medium text-ink-1">{item.title}</p>
                  <span className="tnum shrink-0 text-sm font-semibold text-ink-1">{line?.lineTotal != null ? currency(line.lineTotal) : "—"}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`qty-${item.skuId}`}>Quantity for {item.title}</label>
                  <input
                    id={`qty-${item.skuId}`}
                    type="number"
                    min={1}
                    max={MAX_CART_QUANTITY}
                    value={item.qty}
                    onChange={(event) => {
                      const n = Math.floor(Number(event.target.value));
                      setQty(item.skuId, Number.isFinite(n) ? Math.min(MAX_CART_QUANTITY, Math.max(1, n)) : 1);
                    }}
                    className="tnum h-11 w-16 rounded-(--r-sm) border border-control-border bg-control-bg px-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
                  />
                  <span className="text-xs text-ink-3">
                    {item.sku} × {line?.unitPrice != null ? currency(line.unitPrice) : "—"}
                    {line?.provenance ? ` · ${line.provenance}` : ""}
                  </span>
                </div>
                {line?.error && <p className="mt-1 text-xs font-medium text-state-danger-ink">{line.error.message}</p>}
              </li>
            );
          })}
        </ul>

        {snapshot && (
          <dl className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
            <Row label="Subtotal" value={currency(snapshot.subtotal)} />
            <Row label={draft.method === "freight" ? "Freight" : draft.method === "pickup" ? "Pickup" : "Delivery"} value={draft.method === "freight" ? "Quoted" : snapshot.fee === 0 ? "Free" : currency(snapshot.fee)} />
            <Row
              label={snapshot.tax.status === "estimated" ? "Estimated sales tax" : "Sales tax"}
              value={snapshot.tax.status === "estimated" ? currency(snapshot.tax.amount) : snapshot.tax.status === "invoice" ? "On invoice" : snapshot.tax.status === "quoted" ? "Quoted with freight" : "Quoted for this address"}
            />
            <div className="mt-1 flex items-center justify-between border-t border-line pt-3 text-base font-semibold text-ink-1">
              <dt>Total</dt>
              <dd className="tnum">{currency(snapshot.total)}</dd>
            </div>
            <p className="text-xs text-ink-3">Confirmed by the server at {new Date(snapshot.issuedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.</p>
          </dl>
        )}

        <div aria-live="polite">
          {snapshot?.payment === "card" && snapshot.tax.status === "unavailable" && (
            <p className="mt-3 rounded-(--r-sm) bg-state-warning px-3 py-2 text-sm text-state-warning-ink">
              We can&apos;t calculate sales tax for this delivery address online yet. Choose will-call pickup, or{" "}
              <Link href="/quote" className="font-medium underline underline-offset-4">request a quote</Link> and we&apos;ll confirm the tax with you.
            </p>
          )}
          {termsMissing && !error && <p className="mt-3 text-sm text-ink-2">Tick the installation and warranty terms in step 4 to continue.</p>}
          {error && (
            <p role="alert" className="mt-3 rounded-(--r-sm) bg-state-danger px-3 py-2 text-sm font-medium text-state-danger-ink">
              {error}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || blocked}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-(--r-sm) bg-brand text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Placing order…" : snapshot?.payment === "net_terms" ? "Place order (net terms)" : draft.method === "freight" ? "Request order + freight quote" : "Continue to payment"}
          {!submitting && <ArrowRight size={16} aria-hidden="true" />}
        </button>
        <p className="mt-3 text-center text-xs text-ink-3">
          {snapshot?.payment === "net_terms" ? "Invoiced to your account on net terms." : draft.method === "freight" ? "We email a freight quote before charging." : "Your card is authorized on the next step and charged only when the counter confirms your items."}
        </p>

        <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-xs text-ink-2">
          <li className="flex items-center gap-2">
            <Lock size={13} className="shrink-0 text-brand" aria-hidden="true" />
            Secure payment powered by Stripe. Card details never touch our servers
          </li>
          <li className="flex items-center gap-2">
            <RotateCcw size={13} className="shrink-0 text-brand" aria-hidden="true" />
            {PURCHASE.returns}
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck size={13} className="shrink-0 text-brand" aria-hidden="true" />
            {PURCHASE.guarantee}. Wrong or damaged units replaced free
          </li>
        </ul>
      </aside>
    </div>
  );
}

function TextField({
  id,
  label,
  required,
  error,
  value,
  onChange,
  onBlur,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string | null;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium text-ink-1">
      <label htmlFor={`checkout-${id}`}>
        {label}
        {required && <span className="ml-0.5 text-ink-3" aria-hidden="true">*</span>}
      </label>
      <input
        id={`checkout-${id}`}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `checkout-${id}-error` : undefined}
        className={inputCls}
      />
      {error && (
        <span id={`checkout-${id}-error`} className="text-xs font-medium text-state-danger-ink">
          {error}
        </span>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-ink-2">
      <dt>{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}
