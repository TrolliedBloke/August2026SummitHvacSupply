"use client";

import { CheckCircle2, Phone } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui";
import { ErrorSummary, FormField, Input, Textarea, Select, focusFirstInvalid } from "@/components/form";
import { CONTACT_TOPICS, contactTopic } from "@/lib/contact-topics";
import { CONTACT_FIELD_LABELS, contactFormSchema, type ContactField } from "@/lib/forms/contact";
import { fieldErrorsFrom, submitForm, type FieldErrors } from "@/lib/forms/result";
import { SITE } from "@/lib/site";

type Prefill = { topic: string; sku: string; orderRef: string; branchId?: "newark" };
type Receipt = { reference: string; responseWindow: string; urgentPath: string | null; topic: string };

/**
 * The contact form.
 *
 * Errors are a map keyed by field plus one form-level error, validated with
 * the same schema the API uses. On a failed submit focus moves to the FIRST
 * invalid field in DOM order -- the old form focused the email box and
 * scrolled to the bottom of the page when the name was missing. Every entered
 * value survives every failure. A retry of the same draft reuses its request
 * id, so a timeout followed by a resend creates one request, not two.
 */
export function ContactForm({ prefill }: { prefill: Prefill }) {
  const [values, setValues] = React.useState({
    topic: prefill.topic,
    name: "",
    email: "",
    message: "",
    sku: prefill.sku,
    orderRef: prefill.orderRef,
    zip: "",
    urgent: false,
  });
  const [errors, setErrors] = React.useState<FieldErrors<ContactField>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const requestIdRef = React.useRef<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const successRef = React.useRef<HTMLDivElement>(null);
  // Focus moves after React commits the new error state, not on a timer: an
  // effect keyed to a counter runs even when animation frames are paused.
  const [focusRequest, setFocusRequest] = React.useState<{ target: "invalid" | "success"; tick: number } | null>(null);
  React.useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.target === "invalid") focusFirstInvalid(formRef.current);
    else successRef.current?.focus();
  }, [focusRequest]);
  const requestFocus = (target: "invalid" | "success") => setFocusRequest((current) => ({ target, tick: (current?.tick ?? 0) + 1 }));
  const topic = contactTopic(values.topic);
  const prefilled = Boolean(prefill.sku || prefill.orderRef || prefill.branchId);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key as ContactField]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function payload() {
    const fields = topic?.fields ?? [];
    return {
      topic: values.topic,
      name: values.name,
      email: values.email,
      message: values.message,
      sku: fields.includes("sku") ? values.sku : "",
      orderRef: fields.includes("orderRef") ? values.orderRef : "",
      zip: fields.includes("zip") ? values.zip : "",
      branchId: fields.includes("branchId") ? prefill.branchId : undefined,
      urgent: topic?.allowsUrgent ? values.urgent : false,
      sourceUrl: typeof window === "undefined" ? undefined : window.location.pathname,
    };
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    const body = payload();
    const checked = contactFormSchema.safeParse(body);
    if (!checked.success) {
      setErrors(fieldErrorsFrom<ContactField>(checked.error));
      requestFocus("invalid");
      return;
    }
    setErrors({});
    setSubmitting(true);
    requestIdRef.current ??= crypto.randomUUID();
    const result = await submitForm<Receipt, ContactField>("/api/contact-requests", { ...body, clientRequestId: requestIdRef.current });
    setSubmitting(false);
    if (result.ok) {
      requestIdRef.current = null;
      setReceipt(result);
      requestFocus("success");
      return;
    }
    setErrors(result.fieldErrors);
    setFormError(result.formError);
    if (Object.keys(result.fieldErrors).length) requestFocus("invalid");
  }

  if (receipt) {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="mt-8 rounded-(--r-md) border border-state-success-line bg-state-success p-6 outline-none">
        <CheckCircle2 className="text-state-success-ink" size={28} aria-hidden="true" />
        <h2 className="mt-3 text-xl font-semibold text-ink-1">Message sent</h2>
        <p className="mt-2 text-ink-2">
          Reference <span className="part-number font-medium text-ink-1">{receipt.reference}</span>. The{" "}
          {contactTopic(receipt.topic)?.queue === "orders" ? "orders desk" : "counter"} replies {receipt.responseWindow}.
        </p>
        {receipt.urgentPath && (
          <p className="mt-3 flex items-center gap-2 text-ink-1">
            <Phone size={16} aria-hidden="true" /> {receipt.urgentPath}{" "}
            <a href={SITE.phoneHref} className="font-medium underline underline-offset-4">
              {SITE.phone}
            </a>
          </p>
        )}
      </div>
    );
  }

  const labelClass = "text-base leading-5";
  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-10 flex flex-col gap-7" aria-describedby={formError ? "contact-form-error" : undefined}>
      <ErrorSummary errors={errors} labels={CONTACT_FIELD_LABELS} formError={formError} id="contact-form-error" />

      <FormField
        id="topic"
        label="I'm reaching out about"
        required
        error={errors.topic}
        labelClassName={labelClass}
        hint={topic ? `The ${topic.queue === "orders" ? "orders desk" : "counter"} replies ${topic.responseWindow}.` : undefined}
      >
        {(control) => (
          <Select
            id={control.id}
            invalid={Boolean(control["aria-invalid"])}
            describedBy={control["aria-describedby"]}
            required
            ariaLabel="I'm reaching out about"
            name="topic"
            value={values.topic}
            onChange={(value) => set("topic", value)}
            size="lg"
            placeholder="Choose a topic"
            options={CONTACT_TOPICS.map(({ value, label }) => ({ value, label }))}
          />
        )}
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="name" label="Name" required error={errors.name} labelClassName={labelClass}>
          {(control) => <Input {...control} name="name" autoComplete="name" value={values.name} onChange={(event) => set("name", event.target.value)} className="h-13" />}
        </FormField>
        <FormField id="email" label="Email" required error={errors.email} labelClassName={labelClass}>
          {(control) => (
            <Input {...control} name="email" type="email" autoComplete="email" placeholder="you@email.com" value={values.email} onChange={(event) => set("email", event.target.value)} className="h-13" />
          )}
        </FormField>
      </div>

      {topic && topic.fields.some((field) => field !== "branchId") && (
        <div className="grid gap-5 sm:grid-cols-2">
          {topic.fields.includes("sku") && (
            <FormField id="sku" label="SKU or model number" error={errors.sku} labelClassName={labelClass} hint={prefill.sku ? "Filled in from the product you were viewing." : undefined}>
              {(control) => <Input {...control} name="sku" value={values.sku} onChange={(event) => set("sku", event.target.value)} className="part-number h-13" />}
            </FormField>
          )}
          {topic.fields.includes("orderRef") && (
            <FormField id="orderRef" label="Order number" error={errors.orderRef} labelClassName={labelClass}>
              {(control) => <Input {...control} name="orderRef" placeholder="SO-…" value={values.orderRef} onChange={(event) => set("orderRef", event.target.value)} className="part-number h-13" />}
            </FormField>
          )}
          {topic.fields.includes("zip") && (
            <FormField id="zip" label="Job-site ZIP" error={errors.zip} labelClassName={labelClass}>
              {(control) => <Input {...control} name="zip" inputMode="numeric" maxLength={5} value={values.zip} onChange={(event) => set("zip", event.target.value.replace(/\D/g, ""))} className="h-13" />}
            </FormField>
          )}
        </div>
      )}
      {prefilled && prefill.branchId && topic?.fields.includes("branchId") && (
        <p className="-mt-3 text-meta text-ink-3">Branch: Newark (from the page you came from).</p>
      )}

      <FormField id="message" label="Message" required error={errors.message} labelClassName={labelClass}>
        {(control) => <Textarea {...control} name="message" rows={5} value={values.message} onChange={(event) => set("message", event.target.value)} className="min-h-[136px]" />}
      </FormField>

      {topic?.allowsUrgent && (
        <div>
          <label className="flex min-h-11 items-start gap-3 text-base text-ink-1">
            <input type="checkbox" checked={values.urgent} onChange={(event) => set("urgent", event.target.checked)} className="mt-1 size-4.5 shrink-0 accent-[var(--green)]" />
            <span>
              This affects a job today
              <span className="mt-0.5 block text-meta text-ink-3">
                Written replies are not faster. For same-day help, call {SITE.phone}.
              </span>
            </span>
          </label>
        </div>
      )}

      <Button type="submit" size="lg" className="h-14 self-start px-8 text-[18px]" disabled={submitting}>
        {submitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
