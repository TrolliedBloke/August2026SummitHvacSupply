"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui";
import { ErrorSummary, FormField, Input, Select, Textarea, focusFirstInvalid } from "@/components/form";
import {
  DUCT_OPTIONS,
  HOME_TYPES,
  HOMEOWNER_FIELD_LABELS,
  HOMEOWNER_RESPONSE_WINDOW,
  homeownerRequestSchema,
  REBATE_OPTIONS,
  TIMELINES,
  type HomeownerField,
} from "@/lib/forms/homeowner";
import { fieldErrorsFrom, submitForm, type FieldErrors } from "@/lib/forms/result";
import { SITE } from "@/lib/site";

type Receipt = { reference: string; responseWindow: string; nextStep: string; serviceArea: string; duplicate: boolean };

const EMPTY = {
  zip: "",
  city: "",
  homeType: "",
  zones: "",
  existingDucts: "",
  rebateInterest: "",
  timeline: "",
  name: "",
  email: "",
  phone: "",
  notes: "",
  consent: false,
};

/**
 * The homeowner request: typed fields posted to /api/homeowner-requests, with
 * the service boundary stated before the first field -- Summit supplies
 * equipment; installation is referred, not performed -- and an honest
 * reference and response window after it.
 */
export function HomeownerRequestForm() {
  const [values, setValues] = React.useState(EMPTY);
  const [errors, setErrors] = React.useState<FieldErrors<HomeownerField>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const requestIdRef = React.useRef<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const doneRef = React.useRef<HTMLDivElement>(null);
  const [focus, setFocus] = React.useState<{ target: "invalid" | "done"; tick: number } | null>(null);
  React.useEffect(() => {
    if (!focus) return;
    if (focus.target === "invalid") focusFirstInvalid(formRef.current);
    else doneRef.current?.focus();
  }, [focus]);
  const requestFocus = (target: "invalid" | "done") => setFocus((current) => ({ target, tick: (current?.tick ?? 0) + 1 }));

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key as HomeownerField]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    const checked = homeownerRequestSchema.safeParse(values);
    if (!checked.success) {
      setErrors(fieldErrorsFrom<HomeownerField>(checked.error));
      requestFocus("invalid");
      return;
    }
    setErrors({});
    setSubmitting(true);
    requestIdRef.current ??= crypto.randomUUID();
    const result = await submitForm<Receipt, HomeownerField>("/api/homeowner-requests", { ...values, clientRequestId: requestIdRef.current });
    setSubmitting(false);
    if (result.ok) {
      requestIdRef.current = null;
      setReceipt(result);
      requestFocus("done");
      return;
    }
    setErrors(result.fieldErrors);
    setFormError(result.formError);
    if (Object.keys(result.fieldErrors).length) requestFocus("invalid");
  }

  if (receipt) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="rounded-(--r-md) border border-state-success-line bg-state-success p-6 outline-none">
        <CheckCircle2 className="text-state-success-ink" size={28} aria-hidden="true" />
        <h2 className="mt-3 text-xl font-semibold text-ink-1">{receipt.duplicate ? "We already have this request" : "Request received"}</h2>
        <p className="mt-2 text-ink-2">
          Reference <span className="part-number font-medium text-ink-1">{receipt.reference}</span>. The homeowner desk replies{" "}
          {receipt.responseWindow}.
        </p>
        <p className="mt-2 text-sm leading-6 text-ink-2">{receipt.nextStep}</p>
        <p className="mt-3 text-sm text-ink-2">
          Need to add something? Call{" "}
          <a href={SITE.phoneHref} className="font-medium text-ink-1 underline underline-offset-4">
            {SITE.phone}
          </a>{" "}
          and give the reference.
        </p>
      </div>
    );
  }

  const select = (field: "homeType" | "existingDucts" | "rebateInterest" | "timeline", options: ReadonlyArray<{ value: string; label: string }>, placeholder: string) => (
    <FormField id={field} label={HOMEOWNER_FIELD_LABELS[field]} required error={errors[field]}>
      {(control) => (
        <Select
          id={control.id}
          invalid={Boolean(control["aria-invalid"])}
          describedBy={control["aria-describedby"]}
          required
          value={values[field]}
          onChange={(value) => set(field, value)}
          placeholder={placeholder}
          options={options}
        />
      )}
    </FormField>
  );

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="rounded-(--r-md) border border-line bg-surface-1 p-6">
      <h2 className="text-xl font-semibold tracking-tight text-ink-1">Ask about one system or installer help</h2>

      {/* The service boundary, before anything is asked. */}
      <dl className="mt-4 grid gap-3 rounded-(--r-sm) bg-surface-2 p-4 text-sm leading-6 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-ink-1">What Summit does</dt>
          <dd className="text-ink-2">Supplies the equipment and helps you choose it.</dd>
        </div>
        <div>
          <dt className="font-medium text-ink-1">What Summit does not do</dt>
          <dd className="text-ink-2">Install it. We introduce qualified installers; they quote and contract with you directly.</dd>
        </div>
        <div>
          <dt className="font-medium text-ink-1">Where</dt>
          <dd className="text-ink-2">Bay Area homes on our Newark routes. Outside them we can still advise and ship.</dd>
        </div>
        <div>
          <dt className="font-medium text-ink-1">What happens next</dt>
          <dd className="text-ink-2">You get a reference now and a reply {HOMEOWNER_RESPONSE_WINDOW}. Nothing is charged.</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-ink-2">You do not need a model number or a complete project scope to start.</p>

      <div className="mt-5">
        <ErrorSummary errors={errors} labels={HOMEOWNER_FIELD_LABELS} formError={formError} id="homeowner-summary" />
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <FormField id="zip" label="ZIP code" required error={errors.zip}>
          {(control) => <Input {...control} name="zip" inputMode="numeric" maxLength={5} autoComplete="postal-code" placeholder="94536" value={values.zip} onChange={(event) => set("zip", event.target.value.replace(/\D/g, ""))} />}
        </FormField>
        <FormField id="city" label="City" required error={errors.city}>
          {(control) => <Input {...control} name="city" autoComplete="address-level2" placeholder="Fremont" value={values.city} onChange={(event) => set("city", event.target.value)} />}
        </FormField>
        {select("homeType", HOME_TYPES, "Select home type")}
        <FormField id="zones" label="Rooms or zones" required error={errors.zones}>
          {(control) => <Input {...control} name="zones" placeholder="1 room, 3 bedrooms, whole home…" value={values.zones} onChange={(event) => set("zones", event.target.value)} />}
        </FormField>
        {select("existingDucts", DUCT_OPTIONS, "Select one")}
        {select("rebateInterest", REBATE_OPTIONS, "Select one")}
        {select("timeline", TIMELINES, "Select timeline")}
        <FormField id="name" label="Name" required error={errors.name}>
          {(control) => <Input {...control} name="name" autoComplete="name" value={values.name} onChange={(event) => set("name", event.target.value)} />}
        </FormField>
        <FormField id="email" label="Email" required error={errors.email}>
          {(control) => <Input {...control} name="email" type="email" autoComplete="email" placeholder="you@email.com" value={values.email} onChange={(event) => set("email", event.target.value)} />}
        </FormField>
        <FormField id="phone" label="Phone" error={errors.phone} hint="Only if you would like a call back.">
          {(control) => <Input {...control} name="phone" type="tel" autoComplete="tel" value={values.phone} onChange={(event) => set("phone", event.target.value)} />}
        </FormField>
        <div className="sm:col-span-2">
          <FormField id="notes" label="Anything else?" error={errors.notes}>
            {(control) => (
              <Textarea {...control} name="notes" rows={4} placeholder="Comfort issue, preferred brand, an existing quote, panel concerns…" value={values.notes} onChange={(event) => set("notes", event.target.value)} />
            )}
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <label className="flex min-h-11 items-start gap-3 text-sm text-ink-1">
            <input
              id="consent"
              type="checkbox"
              checked={values.consent}
              onChange={(event) => set("consent", event.target.checked)}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? "consent-error" : undefined}
              className="mt-0.5 size-4.5 shrink-0 accent-[var(--green)]"
            />
            <span>Summit may contact me by email{values.phone ? " or phone" : ""} about this request, and share my project details with an installer I agree to be introduced to.</span>
          </label>
          {errors.consent && (
            <p id="consent-error" className="mt-1 text-sm text-state-danger-ink">
              {errors.consent}
            </p>
          )}
        </div>
      </div>
      <Button type="submit" size="lg" className="mt-6" disabled={submitting}>
        {submitting ? "Sending…" : "Send my request"}
        <ArrowRight size={18} aria-hidden="true" />
      </Button>
    </form>
  );
}
