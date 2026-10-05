"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { ErrorSummary, FormField, Input, Textarea, focusFirstInvalid } from "@/components/form";
import { PRIVACY_REQUEST_KINDS, privacyRequestSchema } from "@/lib/forms/privacy";

type Values = { kind: string; email: string; name: string; details: string };
type Field = keyof Values;
const LABELS: Record<Field, string> = { kind: "Request", email: "Email", name: "Name", details: "Details" };

export function PrivacyRequestForm() {
  const formRef = React.useRef<HTMLFormElement>(null);
  const requestId = React.useRef<string | null>(null);
  const [values, setValues] = React.useState<Values>({ kind: "", email: "", name: "", details: "" });
  const [errors, setErrors] = React.useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [reference, setReference] = React.useState<string | null>(null);
  const set = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = privacyRequestSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as Field] ??= issue.message;
      setErrors(next);
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    setBusy(true);
    setFormError(null);
    requestId.current ??= crypto.randomUUID();
    const response = await fetch("/api/privacy/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...parsed.data, clientRequestId: requestId.current }) }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setBusy(false);
    if (payload?.ok) return setReference(payload.reference);
    if (payload?.fieldErrors) setErrors(payload.fieldErrors);
    setFormError(payload?.error ?? "We couldn't record the request. Email or call us and we'll log it by hand.");
  }

  if (reference) {
    return (
      <div role="status" className="rounded-(--r-md) border border-state-success-line bg-state-success p-6">
        <CheckCircle2 className="text-state-success-ink" size={28} aria-hidden="true" />
        <h2 className="mt-3 text-xl font-semibold text-ink-1">Check your email to confirm</h2>
        <p className="mt-2 text-ink-2">
          Request {reference} is logged. We&apos;ve emailed a confirmation link to that address; we act on the request once it&apos;s confirmed, and
          respond within 45 days.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <ErrorSummary errors={errors} labels={LABELS} formError={formError} />
      <fieldset id="kind" aria-invalid={errors.kind ? true : undefined} className="flex flex-col gap-2 border-0 p-0">
        <legend className="p-0 text-sm font-medium text-ink-1">What would you like us to do?</legend>
        {PRIVACY_REQUEST_KINDS.map((kind) => (
          <label key={kind.value} className="flex min-h-11 items-center gap-2.5 rounded-(--r-sm) border border-line bg-surface-1 px-3 text-sm text-ink-1">
            <input type="radio" name="kind" value={kind.value} checked={values.kind === kind.value} onChange={() => set("kind", kind.value)} className="size-4.5 accent-[var(--green)]" />
            {kind.label}
          </label>
        ))}
        {errors.kind && <p className="text-sm text-state-danger-ink">{errors.kind}</p>}
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="email" label="Email the request is about" required error={errors.email} hint="We send the confirmation link here.">
          {(props) => <Input {...props} type="email" autoComplete="email" value={values.email} onChange={(e) => set("email", e.target.value)} />}
        </FormField>
        <FormField id="name" label="Name" error={errors.name}>
          {(props) => <Input {...props} autoComplete="name" value={values.name} onChange={(e) => set("name", e.target.value)} />}
        </FormField>
      </div>
      <FormField id="details" label="Details" error={errors.details} hint="For a correction, tell us what's wrong. Agents acting for someone: say so here.">
        {(props) => <Textarea {...props} rows={4} value={values.details} onChange={(e) => set("details", e.target.value)} />}
      </FormField>
      <button type="submit" disabled={busy} className="h-11 self-start rounded-(--r-sm) bg-brand px-5 text-sm font-medium text-brand-ink disabled:opacity-50">
        {busy ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
