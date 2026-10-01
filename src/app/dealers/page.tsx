"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ArrowRight, ArrowLeft, CheckCircle2, ClipboardList } from "lucide-react";
import * as React from "react";
import { Container, Button } from "@/components/ui";
import { TestimonialSlot } from "@/components/testimonial-slot";
import { CONTRACTOR_TESTIMONIALS } from "@/lib/testimonials";
import { ErrorSummary, FormField, Input, Select, Textarea, focusFirstInvalid } from "@/components/form";
import { SITE } from "@/lib/site";
import {
  BUSINESS_TYPES,
  DEALER_CHECKLIST,
  DEALER_FIELD_LABELS,
  DEALER_REVIEW_SLA,
  DEALER_STEPS,
  dealerFormSchema,
  ENTITY_TYPES,
  SERVICE_STATES,
  VOLUMES,
  type DealerField,
} from "@/lib/forms/dealer";
import { fieldErrorsFrom, submitForm, type FieldErrors } from "@/lib/forms/result";

/* The draft survives step changes AND a refresh: it lives in React state and
   is mirrored to sessionStorage (this tab only, cleared on success, ignored
   after 24 hours). It never holds anything beyond what the form shows -- the
   tax field is the last four digits only. */
const DRAFT_KEY = "summit-dealer-draft-v1";
const DRAFT_TTL_MS = 24 * 60 * 60_000;

type Draft = Record<DealerField, string> & { idempotencyKey: string };
const EMPTY: Omit<Draft, "idempotencyKey"> = {
  company: "",
  entityType: "",
  contactName: "",
  email: "",
  phone: "",
  businessType: "",
  licenseApplicable: "",
  licenseNumber: "",
  licenseState: "",
  taxIdLast4: "",
  buysForResale: "",
  resaleCertificateNumber: "",
  serviceArea: "",
  monthlyVolume: "",
  brands: "",
  notes: "",
};

function readDraft(): { draft: Draft; step: number } | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; step: number; draft: Draft };
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) return null;
    return { draft: { ...EMPTY, ...parsed.draft }, step: Math.min(3, Math.max(1, parsed.step)) };
  } catch {
    return null;
  }
}

type Receipt = { reference: string; duplicate: boolean; responseWindow: string };

export default function DealersPage() {
  const [step, setStep] = React.useState(1);
  const [draft, setDraft] = React.useState<Draft>({ ...EMPTY, idempotencyKey: "" });
  const [restored, setRestored] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors<DealerField>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [focusTick, setFocusTick] = React.useState(0);

  // Restore after mount (sessionStorage is client-only), then keep it in sync.
  React.useEffect(() => {
    const saved = readDraft();
    queueMicrotask(() => {
      if (saved) {
        setDraft(saved.draft.idempotencyKey ? saved.draft : { ...saved.draft, idempotencyKey: crypto.randomUUID() });
        setStep(saved.step);
      } else {
        setDraft((current) => ({ ...current, idempotencyKey: crypto.randomUUID() }));
      }
      setRestored(true);
    });
  }, []);
  React.useEffect(() => {
    if (!restored || receipt) return;
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), step, draft }));
    } catch {
      /* storage unavailable: the in-memory draft still survives step changes */
    }
  }, [draft, step, restored, receipt]);
  React.useEffect(() => {
    if (focusTick) focusFirstInvalid(formRef.current);
  }, [focusTick]);

  function set(field: DealerField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function payload() {
    const entries = Object.entries(draft).filter(([, value]) => value !== "");
    return Object.fromEntries(entries);
  }

  /** Validate with the full schema, keeping only this step's (and earlier steps') problems. */
  function validateThrough(lastStep: number): FieldErrors<DealerField> {
    const checked = dealerFormSchema.safeParse(payload());
    if (checked.success) return {};
    const all = fieldErrorsFrom<DealerField>(checked.error);
    const fields = new Set(DEALER_STEPS.filter((entry) => entry.id <= lastStep).flatMap((entry) => entry.fields));
    return Object.fromEntries(Object.entries(all).filter(([field]) => fields.has(field as DealerField))) as FieldErrors<DealerField>;
  }

  function next() {
    const found = validateThrough(step);
    setErrors(found);
    if (Object.keys(found).length) {
      setFocusTick((tick) => tick + 1);
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    const found = validateThrough(3);
    if (Object.keys(found).length) {
      setErrors(found);
      const firstStep = DEALER_STEPS.find((entry) => entry.fields.some((field) => found[field]))?.id ?? 3;
      setStep(firstStep);
      setFocusTick((tick) => tick + 1);
      return;
    }
    setSubmitting(true);
    const result = await submitForm<Receipt, DealerField>("/api/dealer-applications", payload());
    setSubmitting(false);
    if (result.ok) {
      setReceipt(result);
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    setErrors(result.fieldErrors);
    setFormError(result.formError);
    const firstStep = DEALER_STEPS.find((entry) => entry.fields.some((field) => result.fieldErrors[field]))?.id;
    if (firstStep) {
      setStep(firstStep);
      setFocusTick((tick) => tick + 1);
    }
  }

  const licensed = BUSINESS_TYPES.find((type) => type.value === draft.businessType)?.licensed;
  const field = (name: DealerField, render: (control: Parameters<Parameters<typeof FormField>[0]["children"]>[0]) => React.ReactNode, options: { required?: boolean; hint?: string } = {}) => (
    <FormField id={name} label={DEALER_FIELD_LABELS[name]} required={options.required ?? true} hint={options.hint} error={errors[name]}>
      {render}
    </FormField>
  );
  const select = (name: DealerField, options: ReadonlyArray<{ value: string; label: string }>, placeholder = "Select") =>
    field(name, (control) => (
      <Select id={control.id} invalid={Boolean(control["aria-invalid"])} describedBy={control["aria-describedby"]} required value={draft[name]} onChange={(value) => set(name, value)} placeholder={placeholder} options={options} />
    ));
  const yesNo = (name: "licenseApplicable" | "buysForResale", yes: string, no: string) => (
    // aria-invalid is not valid on a radio; the group's description carries the error.
    <fieldset id={name} tabIndex={-1} className="border-0 p-0 outline-none" data-invalid={errors[name] ? "true" : undefined} aria-describedby={errors[name] ? `${name}-error` : undefined}>
      <legend className="p-0 text-sm font-medium text-ink-1">
        {DEALER_FIELD_LABELS[name]}
        <span className="ml-0.5 text-ink-3" aria-hidden="true">*</span>
      </legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {[
          ["yes", yes],
          ["no", no],
        ].map(([value, label]) => (
          <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--r-sm) border border-line px-3 py-2 text-sm text-ink-1 has-[:checked]:border-brand has-[:checked]:bg-brand-tint">
            <input
              type="radio"
              name={name}
              value={value}
              checked={draft[name] === value}
              onChange={() => set(name, value)}
              className="accent-[var(--green)]"
            />
            {label}
          </label>
        ))}
      </div>
      {errors[name] && (
        <p id={`${name}-error`} className="mt-1.5 text-sm text-state-danger-ink">
          {errors[name]}
        </p>
      )}
    </fieldset>
  );

  return (
    <>
      <section className="border-b border-line bg-[var(--ink-panel)] py-14 text-white">
        <Container className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-medium text-white">Become a dealer</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Open a contractor account.</h1>
            <p className="mt-3 max-w-xl text-white/75">
              Account pricing, Bay Area stock, spec and rebate support, and repeat ordering. About five minutes; staff review
              every application and reply {DEALER_REVIEW_SLA}.
            </p>
          </div>
          <div className="relative min-h-[250px] overflow-hidden rounded-(--r-md) border border-white/10 bg-white/5">
            <Image src="/site/generated/contractor-will-call-counter.jpg" alt="HVAC contractor reviewing a will-call pickup order at a supply counter" fill preload sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
        </Container>
      </section>

      <TestimonialSlot items={CONTRACTOR_TESTIMONIALS} className="mx-auto w-full max-w-[var(--page-max)] px-5 pt-12" />

      <Container className="py-12 lg:py-16">
        <div className="mx-auto max-w-xl">
          {receipt ? (
            <div role="status" className="rounded-(--r-md) border border-state-success-line bg-state-success p-8 text-center">
              <CheckCircle2 className="mx-auto text-state-success-ink" size={36} aria-hidden="true" />
              <h2 className="mt-4 text-2xl font-semibold text-ink-1">{receipt.duplicate ? "You already have an application with us" : "Application received"}</h2>
              <p className="mt-2 text-ink-2">
                {receipt.duplicate
                  ? "We continued your existing application instead of starting a second one. Staff will email you about its status."
                  : `Staff review it and reply ${receipt.responseWindow}. Until then you can shop at list prices.`}
              </p>
              {receipt.reference && !receipt.duplicate && (
                <p className="mt-3 text-sm text-ink-2">
                  Reference <span className="part-number font-medium text-ink-1">{receipt.reference}</span>
                </p>
              )}
              <p className="mt-4 text-sm text-ink-2">
                <Link href="/account/create" className="font-medium text-ink-1 underline underline-offset-4">
                  Create a sign-in with the same email
                </Link>{" "}
                to see your application status any time.
              </p>
              <p className="mt-4 text-sm text-ink-3">
                Questions? Call <a href={SITE.phoneHref} className="font-medium text-ink-1">{SITE.phone}</a>.
              </p>
            </div>
          ) : (
            <>
              <section aria-labelledby="dealer-checklist" className="rounded-(--r-md) border border-line bg-surface-1 p-5">
                <h2 id="dealer-checklist" className="flex items-center gap-2 text-base font-semibold text-ink-1">
                  <ClipboardList size={18} aria-hidden="true" /> Before you start, have ready
                </h2>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
                  {DEALER_CHECKLIST.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-ink-2">Review timing: {DEALER_REVIEW_SLA}. Your answers are saved on this device until you submit.</p>
              </section>

              <ol className="mt-8 flex items-center gap-2" aria-label="Application steps">
                {DEALER_STEPS.map((entry, index) => {
                  const active = step === entry.id;
                  const complete = step > entry.id;
                  return (
                    <React.Fragment key={entry.id}>
                      <li className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
                        <span className={`grid size-9 place-items-center rounded-full border text-sm font-semibold ${complete ? "border-transparent bg-brand text-white" : active ? "border-brand bg-brand-tint text-brand" : "border-line bg-surface-2 text-ink-3"}`}>
                          {complete ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : entry.id}
                        </span>
                        <span className={`text-sm font-medium ${active || complete ? "text-ink-1" : "text-ink-3"} ${active ? "" : "hidden sm:block"}`}>
                          {entry.label}
                          <span className="sr-only">{complete ? ", complete" : active ? ", current step" : ""}</span>
                        </span>
                      </li>
                      {index < DEALER_STEPS.length - 1 && <li aria-hidden="true" className={`h-px flex-1 ${step > entry.id ? "bg-brand" : "bg-line"}`} />}
                    </React.Fragment>
                  );
                })}
              </ol>

              <form ref={formRef} onSubmit={submit} noValidate className="mt-6 rounded-(--r-md) border border-line bg-surface-1 p-6">
                <h2 className="mb-5 text-lg font-semibold text-ink-1">
                  Step {step} of 3: {DEALER_STEPS[step - 1].label}
                </h2>
                <div className="mb-5">
                  <ErrorSummary errors={errors} labels={DEALER_FIELD_LABELS} formError={formError} id="dealer-summary" />
                </div>

                {step === 1 && (
                  <div className="flex flex-col gap-5">
                    {field("company", (control) => <Input {...control} autoComplete="organization" value={draft.company} onChange={(event) => set("company", event.target.value)} />)}
                    {select("entityType", ENTITY_TYPES)}
                    {field("contactName", (control) => <Input {...control} autoComplete="name" value={draft.contactName} onChange={(event) => set("contactName", event.target.value)} />)}
                    <div className="grid gap-5 sm:grid-cols-2">
                      {field("email", (control) => <Input {...control} type="email" autoComplete="email" value={draft.email} onChange={(event) => set("email", event.target.value)} />)}
                      {field("phone", (control) => <Input {...control} type="tel" autoComplete="tel" value={draft.phone} onChange={(event) => set("phone", event.target.value)} />)}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="flex flex-col gap-5">
                    {select("businessType", BUSINESS_TYPES)}
                    {yesNo("licenseApplicable", "My work requires a contractor license", "No license applies to my business")}
                    {draft.licenseApplicable === "yes" && (
                      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
                        {field("licenseNumber", (control) => <Input {...control} value={draft.licenseNumber} onChange={(event) => set("licenseNumber", event.target.value)} />, { hint: "C-20, C-38 or equivalent" })}
                        {select("licenseState", SERVICE_STATES.filter((state) => state.value !== "multi"))}
                      </div>
                    )}
                    {licensed === false && draft.licenseApplicable === "" && (
                      <p className="-mt-2 text-meta text-ink-3">Resellers who do not install usually choose “No license applies”.</p>
                    )}
                    {field("taxIdLast4", (control) => <Input {...control} inputMode="numeric" maxLength={4} value={draft.taxIdLast4} onChange={(event) => set("taxIdLast4", event.target.value.replace(/\D/g, ""))} className="w-32" />, {
                      hint: "Only the last four digits. Staff confirm the full number with you directly.",
                    })}
                    {yesNo("buysForResale", "Yes, I resell equipment", "No, I install what I buy")}
                    {draft.buysForResale === "yes" &&
                      field("resaleCertificateNumber", (control) => <Input {...control} value={draft.resaleCertificateNumber} onChange={(event) => set("resaleCertificateNumber", event.target.value)} />, {
                        hint: "California seller's permit or your state's resale certificate.",
                      })}
                    {select("serviceArea", SERVICE_STATES, "Select your main state")}
                  </div>
                )}

                {step === 3 && (
                  <div className="flex flex-col gap-5">
                    {select("monthlyVolume", VOLUMES, "Units per month")}
                    {field("brands", (control) => <Input {...control} placeholder="e.g. Mitsubishi, Daikin, Fujitsu" value={draft.brands} onChange={(event) => set("brands", event.target.value)} />, { required: false })}
                    {field("notes", (control) => <Textarea {...control} rows={3} value={draft.notes} onChange={(event) => set("notes", event.target.value)} />, { required: false })}
                  </div>
                )}

                <div className="mt-7 flex items-center justify-between gap-3">
                  {step > 1 ? (
                    <Button type="button" variant="ghost" onClick={() => setStep((current) => Math.max(1, current - 1))}>
                      <ArrowLeft size={16} aria-hidden="true" /> Back
                    </Button>
                  ) : (
                    <span />
                  )}
                  {step < 3 ? (
                    <Button type="button" onClick={next}>
                      Continue <ArrowRight size={16} aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Submitting…" : "Submit application"} <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </Container>
    </>
  );
}
