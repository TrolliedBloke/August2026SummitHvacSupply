"use client";

import { CheckCircle2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui";
import { FormField, Input } from "@/components/form";
import { submitForm } from "@/lib/forms/result";
import { browserOptedOut } from "@/lib/privacy-cookies";

/**
 * Record the opt-out on this browser, and optionally against an email so it
 * follows the person to any list Summit holds. The email is optional: the
 * browser opt-out alone must work without handing over anything.
 */
export function OptOutForm() {
  const [status, setStatus] = React.useState<{ gpc: boolean; optedOut: boolean } | null>(null);
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ withEmail: boolean } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const doneRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
    queueMicrotask(() => setStatus({ gpc, optedOut: browserOptedOut(document.cookie, false) }));
  }, []);
  React.useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setFormError(null);
    setSubmitting(true);
    const result = await submitForm<{ withEmail: boolean }, "email">("/api/privacy/opt-out", { email });
    setSubmitting(false);
    if (result.ok) {
      window.dispatchEvent(new Event("summit-privacy-change"));
      setDone({ withEmail: result.withEmail });
      setStatus((current) => (current ? { ...current, optedOut: true } : current));
      return;
    }
    setError(result.fieldErrors.email ?? null);
    setFormError(result.fieldErrors.email ? null : result.formError);
  }

  return (
    <div className="mt-8 rounded-(--r-md) border border-line bg-surface-1 p-6">
      <h2 className="text-lead font-medium text-ink-1">This browser</h2>
      <p className="mt-2 text-sm leading-6 text-ink-2" aria-live="polite">
        {status === null
          ? "Checking this browser's settings…"
          : status.gpc
            ? "Global Privacy Control is on. Summit treats this browser as opted out already."
            : status.optedOut
              ? "This browser is opted out."
              : "No opt-out is recorded on this browser yet."}
      </p>

      {done ? (
        <div ref={doneRef} tabIndex={-1} role="status" className="mt-5 flex gap-3 rounded-(--r-sm) border border-state-success-line bg-state-success p-4 outline-none">
          <CheckCircle2 className="mt-0.5 shrink-0 text-state-success-ink" size={20} aria-hidden="true" />
          <p className="text-sm leading-6 text-ink-1">
            Your opt-out is recorded on this browser{done.withEmail ? " and against your email address" : ""}. It stays in effect
            until you tell us otherwise.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-4">
          <FormField id="opt-out-email" label="Email address" hint="Add it to apply the opt-out to any list that holds your email." error={error}>
            {(control) => (
              <Input {...control} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            )}
          </FormField>
          {formError && (
            <p role="alert" className="text-sm text-state-danger-ink">
              {formError}
            </p>
          )}
          <div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Recording…" : "Opt out"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
