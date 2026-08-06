"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Truck, Store, PackageCheck, ArrowRight, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { MAX_CART_QUANTITY, useQuote } from "./quote-context";
import { useFulfillment } from "./fulfillment-context";
import { ZipGate } from "./zip-gate";
import {
  fulfillmentOptions,
  fulfillmentWindows,
  type FulfillmentMethod,
} from "@/lib/backend/fulfillment";
import { estimateTax, round2 } from "@/lib/backend/pricing";
import { PURCHASE } from "@/lib/site";
import { track } from "@/lib/track";

/* One input treatment for the whole checkout — visible focus ring included
   (plain `outline-none` would defeat the global :focus-visible ring). */
const inputCls =
  "h-11 w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm text-ink-1 " +
  "placeholder:text-ink-4 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

export type PriceMap = Record<string, { dealer: number; retail: number }>;

const METHOD_ICON: Record<FulfillmentMethod, React.ReactNode> = {
  pickup: <Store size={18} strokeWidth={2.2} />,
  local_delivery: <Truck size={18} strokeWidth={2.2} />,
  freight: <PackageCheck size={18} strokeWidth={2.2} />,
};

function currency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function CheckoutClient({
  prices,
  trade,
  accountName,
}: {
  prices: PriceMap;
  trade: boolean;
  accountName: string | null;
}) {
  const router = useRouter();
  const { items, setQty, clear } = useQuote();
  const { zip } = useFulfillment();

  const [method, setMethod] = React.useState<FulfillmentMethod>("pickup");
  const [windowSlot, setWindowSlot] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [role, setRole] = React.useState("contractor");
  const [poNumber, setPoNumber] = React.useState("");
  const [buyerName, setBuyerName] = React.useState("");
  const [buyerEmail, setBuyerEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const submitLockRef = React.useRef(false);

  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  // Cart-recovery capture: once we have a plausible email, snapshot the cart
  // server-side so an abandoned checkout can get the 3-email sequence.
  // Best-effort — failures never surface to the buyer.
  const snapshotCart = React.useCallback(
    (emailValue: string) => {
      if (!/.+@.+\..+/.test(emailValue) || items.length === 0) return;
      track("cart_email_captured");
      void fetch("/api/cart-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailValue,
          items: items.map((i) => ({
            skuId: i.skuId,
            sku: i.sku,
            title: i.title,
            qty: i.qty,
            unitPrice: i.unitPrice,
          })),
        }),
      }).catch(() => {});
    },
    [items]
  );

  // Cart contents come from localStorage (client-only). Render nothing until
  // mounted so SSR (always empty) and the client don't disagree — otherwise
  // React logs a hydration mismatch and regenerates the whole tree.
  const mounted = React.useSyncExternalStore(
    React.useCallback(() => () => undefined, []),
    () => true,
    () => false
  );

  // Prices come straight from the catalog (via the server-provided price map),
  // the same source the server charges from — no client-side markup.
  const priced = items.map((i) => {
    const entry = prices[i.skuId];
    const unit = trade ? entry?.dealer ?? i.unitPrice : entry?.retail ?? i.unitPrice;
    return { ...i, unit, lineTotal: unit * i.qty };
  });
  const subtotal = round2(priced.reduce((s, l) => s + l.lineTotal, 0));

  const options = fulfillmentOptions(zip, subtotal);
  const selectedMethod = options.find((o) => o.method === method)?.available ? method : "pickup";
  const chosen = options.find((o) => o.method === selectedMethod);
  const fee = selectedMethod === "local_delivery" ? chosen?.fee ?? 0 : 0;
  // Homeowners/guests paying by card get an estimated CA tax line; trade
  // net-terms orders are taxed on the invoice, and freight is quoted separately.
  const taxable = !trade && selectedMethod !== "freight";
  const tax = taxable ? estimateTax(subtotal) : 0;
  const total = round2(subtotal + fee + tax);
  const windows = fulfillmentWindows(selectedMethod, zip);

  if (!mounted) {
    return (
      <div className="mt-8 grid gap-4" aria-busy="true" aria-label="Loading checkout">
        <div className="h-24 animate-pulse rounded-(--r-md) bg-surface-2" />
        <div className="h-64 animate-pulse rounded-(--r-md) bg-surface-2" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-10 rounded-(--r-md) border border-line bg-surface-1 p-10 text-center">
        <p className="text-ink-2">Your cart is empty.</p>
        <Link
          href="/products"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-hover"
        >
          Browse the lineup
          <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  async function placeOrder() {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            skuId: i.skuId,
            sku: i.sku,
            modelNumber: i.modelNumber,
            title: i.title,
            qty: i.qty,
          })),
          method: selectedMethod,
          zip: zip ?? undefined,
          address: selectedMethod === "local_delivery" ? address : undefined,
          company,
          phone,
          role,
          poNumber,
          window: selectedMethod !== "freight" ? windowSlot : undefined,
          buyerName,
          buyerEmail,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Checkout failed");

      // Hand the result to the confirmation page (incl. any Stripe clientSecret).
      track("checkout_completed", { total, method: selectedMethod });
      sessionStorage.setItem("summit-last-order", JSON.stringify(data));
      clear();
      router.push(`/checkout/confirmation?order=${encodeURIComponent(data.orderNumber)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  const needsAddress = selectedMethod === "local_delivery";

  // Per-field validation — surfaced inline so the buyer always knows what's
  // missing instead of staring at a dead button.
  const fieldErrors: Record<string, string | null> = {
    buyerName: buyerName.trim().length > 1 ? null : "Enter your full name.",
    buyerEmail: /.+@.+\..+/.test(buyerEmail) ? null : "Enter a valid email — your order confirmation goes here.",
    phone: phone.replace(/\D/g, "").length >= 7 ? null : "Enter a phone number we can reach you at.",
    address: !needsAddress || address.trim().length > 4 ? null : "Enter the delivery street address, city, and ZIP.",
  };
  const invalidFields = Object.entries(fieldErrors).filter(([, msg]) => msg !== null);
  const showError = (field: string) => (touched[field] ? fieldErrors[field] : null);

  function handleSubmit() {
    if (submitLockRef.current || submitting) return;
    if (invalidFields.length > 0) {
      // Mark everything touched so every inline message appears at once.
      setTouched({ buyerName: true, buyerEmail: true, phone: true, address: true });
      setError(
        invalidFields.length === 1
          ? "One field needs attention before we can place the order."
          : `${invalidFields.length} fields need attention before we can place the order.`
      );
      return;
    }
    setError(null);
    void placeOrder();
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
      {/* Left: fulfillment choices */}
      <div className="flex flex-col gap-8">
        <section>
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink-1">
            1. Where it goes
          </h2>
          <div className="mt-3">
            <ZipGate />
          </div>
          <div className="mt-4 grid gap-3">
            {options.map((opt) => (
              <button
                key={opt.method}
                type="button"
                disabled={!opt.available}
                onClick={() => setMethod(opt.method)}
                className={`flex items-center gap-4 rounded-(--r-md) border p-4 text-left transition-colors ${
                  selectedMethod === opt.method
                    ? "border-brand bg-brand-tint"
                    : opt.available
                      ? "border-line bg-surface-1 hover:border-line-strong"
                      : "border-dashed border-line bg-surface-2/40 opacity-60"
                }`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-(--r-sm) bg-surface-2 text-ink-2">
                  {METHOD_ICON[opt.method]}
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-medium text-ink-1">
                    {opt.label}
                    {opt.fee > 0 && selectedMethod === opt.method && (
                      <span className="text-sm text-ink-3">{currency(opt.fee)}</span>
                    )}
                  </span>
                  <span className="text-sm text-ink-2">{opt.detail}</span>
                  {opt.note && !opt.available && (
                    <span className="mt-0.5 block text-xs text-ink-4">{opt.note}</span>
                  )}
                </span>
                {selectedMethod === opt.method && <Check size={18} className="text-brand" strokeWidth={2.5} />}
              </button>
            ))}
          </div>

          {/* One contextual assurance, matched to the method just chosen.
              Deliberately an operational commitment rather than a testimonial
              or a star rating: at this step the open question is "what happens
              after I pay", and a stranger's quote does not answer it. Freight
              gets the cost reassurance because an unquoted LTL charge is the
              single largest unknown in this flow. */}
          <p className="mt-3 flex items-start gap-2 rounded-(--r-sm) bg-surface-2/70 px-3 py-2.5 text-sm leading-snug text-ink-2">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span>
              {selectedMethod === "pickup" &&
                "We confirm your order before it leaves the counter, and stage it under your name at Newark will-call. You get a confirmed pickup window by email."}
              {selectedMethod === "local_delivery" &&
                "We confirm your order before dispatch and send a confirmed delivery window. Someone should be on site to receive and inspect the equipment."}
              {selectedMethod === "freight" &&
                "Freight is quoted and confirmed with you before your card is charged anything beyond the item total. Inspect the pallet before signing the carrier's receipt."}
            </span>
          </p>
        </section>

        {selectedMethod !== "freight" && (
          <section>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink-1">
              2. {selectedMethod === "pickup" ? "Pickup window" : "Delivery window"}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {windows.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWindowSlot(w)}
                  className={`rounded-(--r-sm) border px-3 py-2 text-sm transition-colors ${
                    windowSlot === w
                      ? "border-brand bg-brand-tint text-ink-1"
                      : "border-line bg-surface-1 text-ink-2 hover:border-line-strong"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </section>
        )}

        {needsAddress && (
          <section>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink-1">
              Jobsite address
            </h2>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => touch("address")}
              placeholder="Street, city, ZIP"
              autoComplete="street-address"
              aria-invalid={showError("address") ? true : undefined}
              aria-describedby={showError("address") ? "err-address" : undefined}
              className={`mt-3 ${inputCls}`}
            />
            {showError("address") && (
              <p id="err-address" className="mt-1.5 text-xs font-medium text-danger">
                {fieldErrors.address}
              </p>
            )}
          </section>
        )}

        <section>
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink-1">
            3. Buyer and job details
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required error={showError("buyerName")} errorId="err-name">
              <input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                onBlur={() => touch("buyerName")}
                autoComplete="name"
                aria-invalid={showError("buyerName") ? true : undefined}
                aria-describedby={showError("buyerName") ? "err-name" : undefined}
                className={inputCls}
              />
            </Field>
            <Field label="Email" required error={showError("buyerEmail")} errorId="err-email">
              <input
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                onBlur={() => { touch("buyerEmail"); snapshotCart(buyerEmail); }}
                type="email"
                autoComplete="email"
                aria-invalid={showError("buyerEmail") ? true : undefined}
                aria-describedby={showError("buyerEmail") ? "err-email" : undefined}
                className={inputCls}
              />
            </Field>
            <Field label="Phone" required error={showError("phone")} errorId="err-phone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => touch("phone")}
                type="tel"
                autoComplete="tel"
                aria-invalid={showError("phone") ? true : undefined}
                aria-describedby={showError("phone") ? "err-phone" : undefined}
                className={inputCls}
              />
            </Field>
            <Field label="Company">
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoComplete="organization"
                className={inputCls}
              />
            </Field>
            <Field label="Buyer type">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={inputCls}
              >
                <option value="contractor">Contractor / installer</option>
                <option value="procurement">Procurement team</option>
                <option value="property_manager">Property manager</option>
                <option value="homeowner">Homeowner</option>
              </select>
            </Field>
            <Field label="PO / job number">
              <input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </section>
      </div>

      {/* Right: order summary */}
      <aside className="h-fit rounded-(--r-md) border border-line bg-surface-1 p-6 shadow-[var(--shadow-sm)]">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink-1">Order summary</h2>
        {trade && accountName && (
          <p className="mt-1 text-xs font-medium text-eco-ink">Pro pricing · {accountName}</p>
        )}
        <ul className="mt-4 flex flex-col divide-y divide-line">
          {priced.map((l) => (
            <li key={l.skuId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-1">{l.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={MAX_CART_QUANTITY}
                    value={l.qty}
                    aria-label={`Quantity for ${l.title}`}
                    onChange={(e) => {
                      // Clamp manual entry — an empty or junk value must never
                      // become NaN/0 (setQty removes lines at qty 0).
                      const n = Math.floor(Number(e.target.value));
                      setQty(
                        l.skuId,
                        Number.isFinite(n)
                          ? Math.min(MAX_CART_QUANTITY, Math.max(1, n))
                          : 1
                      );
                    }}
                    className="tnum h-11 w-16 rounded-(--r-sm) border border-control-border bg-control-bg px-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
                  />
                  <span className="text-xs text-ink-3">{l.sku} × {currency(l.unit)}</span>
                </div>
              </div>
              <span className="tnum text-sm font-semibold text-ink-1">{currency(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
          <Row label="Subtotal" value={currency(subtotal)} />
          <Row
            label={selectedMethod === "freight" ? "Freight" : selectedMethod === "pickup" ? "Pickup" : "Delivery"}
            value={selectedMethod === "freight" ? "Quoted" : fee === 0 ? "Free" : currency(fee)}
          />
          {taxable ? (
            <Row label="Estimated sales tax" value={currency(tax)} />
          ) : trade ? (
            <Row label="Sales tax" value="On invoice" />
          ) : null}
          <div className="mt-1 flex items-center justify-between border-t border-line pt-3 text-base font-semibold text-ink-1">
            <span>Total</span>
            <span className="tnum">{currency(total)}</span>
          </div>
        </dl>

        <div aria-live="polite">
          {error && (
            <p role="alert" className="mt-3 rounded-(--r-sm) bg-danger-tint px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-(--r-sm) bg-brand text-sm font-semibold text-brand-ink shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "Placing order…"
            : trade
              ? "Place order (net terms)"
              : selectedMethod === "freight"
                ? "Request order + freight quote"
                : "Continue to payment"}
          {!submitting && <ArrowRight size={16} />}
        </button>
        <p className="mt-3 text-center text-xs text-ink-4">
          {trade
              ? "Reserved for account follow-up on net terms."
            : selectedMethod === "freight"
              ? "We email a freight quote before charging."
              : "Secure card payment on the next step."}
        </p>

        {/* Trust peaks at payment — restate the guarantees right at the button. */}
        <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-xs text-ink-2">
          <li className="flex items-center gap-2">
            <Lock size={13} className="shrink-0 text-brand" />
            Secure payment powered by Stripe — card details never touch our servers
          </li>
          <li className="flex items-center gap-2">
            <RotateCcw size={13} className="shrink-0 text-brand" />
            {PURCHASE.returns}
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck size={13} className="shrink-0 text-brand" />
            {PURCHASE.guarantee} — wrong or damaged units replaced free
          </li>
        </ul>
      </aside>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  errorId,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  errorId?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-1">
      <span>{label}{required && <span className="ml-0.5 text-copper" aria-hidden>*</span>}</span>
      {children}
      {error && (
        <span id={errorId} className="text-xs font-medium text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-ink-2">
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
