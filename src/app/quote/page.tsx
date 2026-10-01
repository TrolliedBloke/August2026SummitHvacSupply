"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Minus, Phone, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { Container, Eyebrow, Button } from "@/components/ui";
import { ErrorSummary, FormField, Input, Select, Textarea, focusFirstInvalid } from "@/components/form";
import { MAX_CART_QUANTITY, useQuote, type QuoteItem } from "@/components/quote-context";
import { Notice } from "@/components/state";
import { SITE } from "@/lib/site";
import { productHref } from "@/lib/storefront/catalog";
import { PROJECT_TYPES, QUOTE_FIELD_LABELS, QUOTE_RESPONSE_WINDOW, quoteDraftSchema, type CompatibilityNote, type QuoteField, type QuoteLineCheck } from "@/lib/forms/quote";
import { fieldErrorsFrom, submitForm, type FieldErrors } from "@/lib/forms/result";

const INTENT_LABEL: Record<QuoteItem["intent"], string> = {
  cart: "Ready to buy",
  availability: "Availability check",
  quote: "Price request",
  notify: "Restock alert",
};

type Receipt = { reference: string; lifecycle: "received" | "needs_information"; responseWindow: string; lineCount: number };

/**
 * The quote request as a typed draft. Lines are editable here -- quantity,
 * remove -- and checked against the catalog as they change, so a merged or
 * unknown product is visible before submit instead of failing the request.
 * Compatibility is only stated from verified catalog data; anything else is a
 * note that staff will confirm.
 */
export default function QuotePage() {
  const { items, hydrated, setQty, remove } = useQuote();
  const [values, setValues] = React.useState({ name: "", email: "", phone: "", zip: "", projectType: "", requestedDate: "", notes: "" });
  const [errors, setErrors] = React.useState<FieldErrors<QuoteField>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const [checks, setChecks] = React.useState<Record<string, QuoteLineCheck>>({});
  const [compatibility, setCompatibility] = React.useState<CompatibilityNote[]>([]);
  const requestIdRef = React.useRef<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [focusTick, setFocusTick] = React.useState(0);
  React.useEffect(() => {
    if (focusTick) focusFirstInvalid(formRef.current);
  }, [focusTick]);

  const lines = items.map((item) => ({ skuId: item.skuId, sku: item.sku, quantity: item.qty, intent: item.intent }));
  const linesKey = JSON.stringify(lines);

  // Check lines against the catalog whenever they change.
  React.useEffect(() => {
    const current = JSON.parse(linesKey) as typeof lines;
    if (current.length === 0) return;
    let cancelled = false;
    fetch("/api/quote-requests/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines: current }) })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.ok) return;
        setChecks(Object.fromEntries((payload.lines as QuoteLineCheck[]).map((line) => [line.skuId, line])));
        setCompatibility(payload.compatibility ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [linesKey]);

  function set(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field as QuoteField]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    const body = { ...values, lines };
    const checked = quoteDraftSchema.safeParse(body);
    if (!checked.success) {
      setErrors(fieldErrorsFrom<QuoteField>(checked.error));
      setFocusTick((tick) => tick + 1);
      return;
    }
    setErrors({});
    setSubmitting(true);
    requestIdRef.current ??= crypto.randomUUID();
    const result = await submitForm<Receipt & { lines: QuoteLineCheck[] }, QuoteField>("/api/quote-requests", { ...body, clientRequestId: requestIdRef.current });
    setSubmitting(false);
    if (result.ok) {
      requestIdRef.current = null;
      setReceipt(result);
      // Requested lines have been handed to the counter; buyable lines stay for checkout.
      items.filter((item) => item.intent !== "cart").forEach((item) => remove(item.skuId));
      window.scrollTo({ top: 0 });
      return;
    }
    setErrors(result.fieldErrors);
    setFormError(result.formError);
    setFocusTick((tick) => tick + 1);
  }

  const problemLines = Object.values(checks).filter((line) => line.status === "unknown" || line.status === "unavailable");
  const reviewNotes = compatibility.filter((note) => note.verdict !== "verified_compatible");
  const verifiedNotes = compatibility.filter((note) => note.verdict === "verified_compatible");

  return (
    <Container className="py-12 lg:py-16">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 max-w-2xl">
          <Eyebrow>Get a quote</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">Tell us what you need. We&apos;ll confirm pricing &amp; lead times.</h1>
          <p className="mt-3 text-ink-2">No account required. The counter checks every product, quantity and date before replying {QUOTE_RESPONSE_WINDOW}.</p>

          {receipt ? (
            <div role="status" className="mt-8 rounded-(--r-md) border border-state-success-line bg-state-success p-6">
              <CheckCircle2 className="text-state-success-ink" size={28} aria-hidden="true" />
              <h2 className="mt-3 text-xl font-semibold text-ink-1">{receipt.lifecycle === "needs_information" ? "Request received -- we may need more detail" : "Quote request received"}</h2>
              <p className="mt-2 text-ink-2">
                Reference <span className="part-number font-medium text-ink-1">{receipt.reference}</span>. Status:{" "}
                {receipt.lifecycle === "needs_information" ? "needs information" : "received"}. We reply {receipt.responseWindow}
                {receipt.lifecycle === "needs_information" ? " with the questions we need answered to quote it." : "."}
              </p>
              <p className="mt-3 text-sm text-ink-2">
                To add to or change it, reply to the confirmation email or call{" "}
                <a href={SITE.phoneHref} className="font-medium text-ink-1 underline underline-offset-4">{SITE.phone}</a> with the reference.
              </p>
              <Link href="/products" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-1 underline underline-offset-4">
                Keep browsing <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-6">
              <ErrorSummary errors={errors} labels={QUOTE_FIELD_LABELS} formError={formError} id="quote-summary" />

              <section aria-labelledby="quote-lines-title">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="quote-lines-title" className="text-lg font-semibold text-ink-1">Products on this request</h2>
                  <Link href="/products" className="text-sm text-ink-2 underline underline-offset-4">Add products</Link>
                </div>
                {!hydrated ? (
                  <div className="mt-3 h-16 animate-pulse rounded-(--r-sm) bg-skeleton" aria-label="Loading your list" />
                ) : items.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-3">None yet -- that is fine. Describe the job below, or browse products and add them.</p>
                ) : (
                  <ul id="lines" tabIndex={-1} data-invalid={errors.lines ? "true" : undefined} className="mt-3 divide-y divide-line rounded-(--r-sm) border border-line outline-none">
                    {items.map((item) => (
                      <QuoteLine key={item.skuId} item={item} check={checks[item.skuId]} onQty={(qty) => setQty(item.skuId, qty)} onRemove={() => remove(item.skuId)} />
                    ))}
                  </ul>
                )}
                {problemLines.length > 0 && (
                  <Notice tone="danger" className="mt-3" title={`${problemLines.length} ${problemLines.length === 1 ? "product needs" : "products need"} attention`}>
                    Remove it, or describe it in the project details so the counter can match it.
                  </Notice>
                )}
                {verifiedNotes.map((note) => (
                  <p key={`${note.indoorSku}-${note.outdoorSku}`} className="mt-3 flex items-start gap-2 text-sm text-ink-2">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" /> {note.message}
                  </p>
                ))}
                {reviewNotes.length > 0 && (
                  <Notice tone="info" className="mt-3" title="Compatibility will be confirmed by staff">
                    <ul className="list-disc pl-5">
                      {reviewNotes.map((note) => (
                        <li key={`${note.indoorSku}-${note.outdoorSku}`}>{note.message}</li>
                      ))}
                    </ul>
                  </Notice>
                )}
              </section>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField id="name" label={QUOTE_FIELD_LABELS.name} required error={errors.name}>
                  {(control) => <Input {...control} autoComplete="name" value={values.name} onChange={(event) => set("name", event.target.value)} />}
                </FormField>
                <FormField id="email" label={QUOTE_FIELD_LABELS.email} required error={errors.email}>
                  {(control) => <Input {...control} type="email" autoComplete="email" value={values.email} onChange={(event) => set("email", event.target.value)} />}
                </FormField>
                <FormField id="phone" label={QUOTE_FIELD_LABELS.phone} error={errors.phone} hint="Fastest if you want a call back.">
                  {(control) => <Input {...control} type="tel" autoComplete="tel" value={values.phone} onChange={(event) => set("phone", event.target.value)} />}
                </FormField>
                <FormField id="zip" label={QUOTE_FIELD_LABELS.zip} error={errors.zip} hint="For delivery and tax.">
                  {(control) => <Input {...control} inputMode="numeric" maxLength={5} value={values.zip} onChange={(event) => set("zip", event.target.value.replace(/\D/g, ""))} />}
                </FormField>
                <FormField id="projectType" label={QUOTE_FIELD_LABELS.projectType} required error={errors.projectType}>
                  {(control) => (
                    <Select id={control.id} invalid={Boolean(control["aria-invalid"])} describedBy={control["aria-describedby"]} required value={values.projectType} onChange={(value) => set("projectType", value)} placeholder="Select" options={PROJECT_TYPES} />
                  )}
                </FormField>
                <FormField id="requestedDate" label={QUOTE_FIELD_LABELS.requestedDate} error={errors.requestedDate}>
                  {(control) => <Input {...control} type="date" value={values.requestedDate} onChange={(event) => set("requestedDate", event.target.value)} />}
                </FormField>
              </div>
              <FormField
                id="notes"
                label={QUOTE_FIELD_LABELS.notes}
                required={items.length === 0}
                error={errors.notes}
                hint={items.length === 0 ? "Equipment, sizes and quantities -- or the model on the old unit's nameplate." : "Anything the counter should know: matched systems, site access, timing."}
              >
                {(control) => <Textarea {...control} rows={4} value={values.notes} onChange={(event) => set("notes", event.target.value)} />}
              </FormField>
              <Button type="submit" size="lg" className="self-start" disabled={submitting || problemLines.length > 0}>
                {submitting ? "Sending…" : "Send quote request"}
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
            </form>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-4 overflow-hidden rounded-(--r-md) border border-line bg-surface-2">
            <div className="relative aspect-[16/10]">
              <Image src="/site/generated/spec-workbench-documents.jpg" alt="Spec sheets and installation materials on a workbench" fill preload sizes="(min-width: 1024px) 380px, 100vw" className="object-cover" />
            </div>
            <p className="p-4 text-sm leading-relaxed text-ink-2">Every quote is checked against exact equipment, stock, documents and fulfillment timing before we reply.</p>
          </div>
          <a href={SITE.phoneHref} className="flex items-center gap-3 rounded-(--r-md) border border-line bg-surface-2 p-4 text-ink-1 transition-colors hover:bg-surface-1">
            <span className="grid size-10 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">
              <Phone size={18} aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-xs text-ink-3">Prefer to talk?</span>
              <span className="text-sm font-semibold">{SITE.phone}</span>
            </span>
          </a>
        </aside>
      </div>
    </Container>
  );
}

function QuoteLine({ item, check, onQty, onRemove }: { item: QuoteItem; check?: QuoteLineCheck; onQty: (qty: number) => void; onRemove: () => void }) {
  const problem = check && (check.status === "unknown" || check.status === "unavailable");
  return (
    <li className={`grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${problem ? "bg-state-danger" : ""}`}>
      <div className="min-w-0">
        <Link href={productHref(item)} className="break-words font-medium text-ink-1 hover:underline">
          {item.title}
        </Link>
        <p className="part-number break-all text-xs text-ink-3">{item.sku}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
          <span className="rounded-full border border-line bg-surface-1 px-2 py-0.5 text-ink-2">{INTENT_LABEL[item.intent]}</span>
          {check?.status === "merged" && (
            <span className="flex items-center gap-1 text-ink-2">
              <Info size={12} aria-hidden="true" /> {check.message}
            </span>
          )}
          {problem && (
            <span className="flex items-center gap-1 text-state-danger-ink">
              <AlertTriangle size={12} aria-hidden="true" /> {check?.message}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-(--r-sm) border border-control-border bg-control-bg">
          <button type="button" onClick={() => onQty(item.qty - 1)} disabled={item.qty <= 1} aria-label={`Decrease quantity of ${item.title}`} className="grid size-11 place-items-center text-ink-2 disabled:text-ink-4">
            <Minus size={14} aria-hidden="true" />
          </button>
          <label className="sr-only" htmlFor={`qty-${item.skuId}`}>
            Quantity of {item.title}
          </label>
          <input
            id={`qty-${item.skuId}`}
            inputMode="numeric"
            value={item.qty}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(next)) onQty(Math.min(MAX_CART_QUANTITY, Math.max(1, next)));
            }}
            className="tnum h-11 w-12 bg-transparent text-center text-sm outline-none"
          />
          <button type="button" onClick={() => onQty(Math.min(MAX_CART_QUANTITY, item.qty + 1))} aria-label={`Increase quantity of ${item.title}`} className="grid size-11 place-items-center text-ink-2">
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        <button type="button" onClick={onRemove} aria-label={`Remove ${item.title}`} className="grid size-11 place-items-center rounded-(--r-sm) text-ink-3 hover:bg-surface-2 hover:text-state-danger-ink">
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
