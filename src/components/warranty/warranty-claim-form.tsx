"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { ErrorSummary, FormField, Input, Textarea, focusFirstInvalid } from "@/components/form";
import { WARRANTY_FIELD_LABELS, warrantyClaimSchema, type WarrantyClaimForm } from "@/lib/forms/warranty";

type Values = Omit<WarrantyClaimForm, "clientRequestId">;
type Field = keyof Values;

const EMPTY: Values = {
  name: "",
  email: "",
  phone: "",
  orderRef: "",
  productDescription: "",
  modelNumber: "",
  serialNumber: "",
  installDate: "",
  installerName: "",
  installerLicense: "",
  issue: "",
};

/** The warranty claim form. Validates with the API's own schema before sending. */
export function WarrantyClaimForm({ initialOrder = "" }: { initialOrder?: string }) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const requestId = React.useRef<string | null>(null);
  const [values, setValues] = React.useState<Values>({ ...EMPTY, orderRef: initialOrder });
  const [errors, setErrors] = React.useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [claimNumber, setClaimNumber] = React.useState<string | null>(null);

  const set = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = warrantyClaimSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as Field] ??= issue.message;
      setErrors(next);
      setFormError(null);
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    setBusy(true);
    setFormError(null);
    requestId.current ??= crypto.randomUUID();
    const response = await fetch("/api/warranty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...parsed.data, clientRequestId: requestId.current }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setBusy(false);
    if (payload?.ok) {
      setClaimNumber(payload.claimNumber);
      return;
    }
    if (payload?.fieldErrors) setErrors(payload.fieldErrors);
    setFormError(payload?.error ?? "We couldn't record the claim. Call the counter and we'll take it by phone.");
  }

  if (claimNumber) {
    return (
      <div role="status" className="rounded-(--r-md) border border-state-success-line bg-state-success p-6">
        <CheckCircle2 className="text-state-success-ink" size={28} aria-hidden="true" />
        <h2 className="mt-3 text-xl font-semibold text-ink-1">Claim {claimNumber} received</h2>
        <p className="mt-2 text-ink-2">
          We&apos;ve emailed you a copy. Reply to it with photos of the unit&apos;s data label, the problem and any error code. The counter
          contacts you within one business day, then opens the claim with the manufacturer.
        </p>
      </div>
    );
  }

  const field = (name: Field, label: string, required: boolean, control: React.ReactNode | ((props: object) => React.ReactNode), hint?: string) => (
    <FormField id={name} label={label} required={required} error={errors[name]} hint={hint}>
      {(props) => (typeof control === "function" ? control(props) : control)}
    </FormField>
  );

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <ErrorSummary errors={errors} labels={WARRANTY_FIELD_LABELS} formError={formError} />
      <div className="grid gap-5 sm:grid-cols-2">
        {field("name", WARRANTY_FIELD_LABELS.name, true, (props) => <Input {...props} autoComplete="name" value={values.name} onChange={(e) => set("name", e.target.value)} />)}
        {field("email", WARRANTY_FIELD_LABELS.email, true, (props) => <Input {...props} type="email" autoComplete="email" value={values.email} onChange={(e) => set("email", e.target.value)} />)}
        {field("phone", WARRANTY_FIELD_LABELS.phone, true, (props) => <Input {...props} type="tel" autoComplete="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} />)}
        {field("orderRef", WARRANTY_FIELD_LABELS.orderRef, false, (props) => <Input {...props} value={values.orderRef} onChange={(e) => set("orderRef", e.target.value)} placeholder="SO-…" />, "From your confirmation email. Bought at the counter? Leave it blank.")}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {field("productDescription", WARRANTY_FIELD_LABELS.productDescription, true, (props) => <Input {...props} value={values.productDescription} onChange={(e) => set("productDescription", e.target.value)} placeholder="24k BTU mini-split outdoor unit" />)}
        {field("modelNumber", WARRANTY_FIELD_LABELS.modelNumber, true, (props) => <Input {...props} value={values.modelNumber} onChange={(e) => set("modelNumber", e.target.value)} />, "On the unit's data label.")}
        {field("serialNumber", WARRANTY_FIELD_LABELS.serialNumber, true, (props) => <Input {...props} value={values.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} />)}
        {field("installDate", WARRANTY_FIELD_LABELS.installDate, false, (props) => <Input {...props} type="date" value={values.installDate} onChange={(e) => set("installDate", e.target.value)} />)}
        {field("installerName", WARRANTY_FIELD_LABELS.installerName, false, (props) => <Input {...props} value={values.installerName} onChange={(e) => set("installerName", e.target.value)} />)}
        {field("installerLicense", WARRANTY_FIELD_LABELS.installerLicense, false, (props) => <Input {...props} value={values.installerLicense} onChange={(e) => set("installerLicense", e.target.value)} />, "Manufacturers usually ask for it.")}
      </div>
      {field("issue", WARRANTY_FIELD_LABELS.issue, true, (props) => <Textarea {...props} rows={6} value={values.issue} onChange={(e) => set("issue", e.target.value)} placeholder="What it's doing, when it started, and any error code on the display or board." />)}
      <p className="text-sm text-ink-3">After you submit, we email you a claim number. Reply to that email with photos; the form doesn&apos;t take attachments.</p>
      <button type="submit" disabled={busy} className="h-11 self-start rounded-(--r-sm) bg-brand px-5 text-sm font-medium text-brand-ink disabled:opacity-50">
        {busy ? "Sending…" : "Submit warranty claim"}
      </button>
    </form>
  );
}
