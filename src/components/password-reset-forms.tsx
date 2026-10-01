"use client";

import * as React from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { requestPasswordReset, completePasswordReset } from "@/lib/backend/auth-actions";
import { AUTH_IDLE, forgotPasswordSchema, resetPasswordSchema, type AuthResult, type ResetField } from "@/lib/forms/auth";
import { fieldErrorsFrom } from "@/lib/forms/result";
import { ErrorSummary, FormField, Input, focusFirstInvalid } from "@/components/form";
import { PasswordRules } from "@/components/password-rules";

const button =
  "mt-2 inline-flex h-11 w-full items-center justify-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-60";

function Submit({ idle, busy, disabled }: { idle: string; busy: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={button}>
      {pending ? busy : idle}
    </button>
  );
}

function useCountdown(seconds: number | undefined, key: unknown) {
  const [remaining, setRemaining] = React.useState(0);
  const [seen, setSeen] = React.useState<unknown>(null);
  if (key !== seen) {
    setSeen(key);
    setRemaining(seconds ?? 0);
  }
  React.useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);
  return remaining;
}

/**
 * Forgot password. The confirmation is identical whether or not the address
 * has an account. The form stays on the page with the address in it, so a
 * typo can be corrected and resent after a visible cooldown.
 */
export function ForgotPasswordForm() {
  const [state, action] = React.useActionState(requestPasswordReset, AUTH_IDLE as AuthResult<"email">);
  const [email, setEmail] = React.useState("");
  const [clientError, setClientError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const sent = state.status === "success";
  const cooldown = useCountdown(sent ? 60 : state.status === "error" ? state.retryAfterSeconds : 0, state);
  const error = clientError ?? (state.status === "error" ? state.fieldErrors.email ?? null : null);
  const formError = state.status === "error" ? state.formError : null;

  React.useEffect(() => {
    if (error) focusFirstInvalid(formRef.current);
  }, [error]);

  return (
    <div className="flex flex-col gap-4">
      {sent && (
        <div role="status" className="rounded-(--r-md) border border-state-success-line bg-state-success p-5">
          <p className="flex items-center gap-2 font-medium text-ink-1">
            <CheckCircle2 size={18} className="text-state-success-ink" aria-hidden="true" /> Check your email
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-2">
            If an account exists for <span className="font-medium text-ink-1">{state.message}</span>, a reset link is on its way. It
            expires after an hour, and a newer request replaces it. Wrong address? Correct it below and send again.
          </p>
        </div>
      )}
      <form
        ref={formRef}
        action={action}
        noValidate
        onSubmit={(event) => {
          const checked = forgotPasswordSchema.safeParse({ email });
          if (!checked.success) {
            event.preventDefault();
            setClientError(fieldErrorsFrom<"email">(checked.error).email ?? "Enter a valid email address.");
          } else setClientError(null);
        }}
        className="rounded-(--r-md) border border-line bg-surface-1 p-5"
      >
        {formError && <ErrorSummary errors={{}} labels={{}} formError={formError} id="forgot-summary" />}
        <FormField id="email" label="Email address" required error={error}>
          {(control) => <Input {...control} name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />}
        </FormField>
        <Submit idle={sent ? (cooldown > 0 ? `Send again in ${cooldown}s` : "Send another link") : cooldown > 0 ? `Try again in ${cooldown}s` : "Send reset link"} busy="Sending…" disabled={cooldown > 0} />
        <Link href="/portal/login" className="mt-4 inline-flex min-h-11 items-center text-sm text-ink-2 underline underline-offset-4">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}

/**
 * New password, shown only when the server has already confirmed a valid
 * recovery session (see the reset page). Uses the same policy as signup.
 */
export function ResetPasswordForm() {
  const [state, action] = React.useActionState(completePasswordReset, AUTH_IDLE as AuthResult<ResetField>);
  const [values, setValues] = React.useState({ password: "", confirm: "" });
  const [clientErrors, setClientErrors] = React.useState<Partial<Record<ResetField, string>>>({});
  const formRef = React.useRef<HTMLFormElement>(null);
  const [focusTick, setFocusTick] = React.useState(0);
  React.useEffect(() => {
    if (focusTick) focusFirstInvalid(formRef.current);
  }, [focusTick]);

  if (state.status === "success") {
    return (
      <div role="status" className="rounded-(--r-md) border border-state-success-line bg-state-success p-5">
        <p className="flex items-center gap-2 font-medium text-ink-1">
          <CheckCircle2 size={18} className="text-state-success-ink" aria-hidden="true" /> Password updated
        </p>
        <p className="mt-2 text-sm leading-6 text-ink-2">
          Every device was signed out, including this one. Sign in with the new password.
        </p>
        <Link href="/portal/login" className="mt-4 inline-flex min-h-11 items-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink">
          Sign in
        </Link>
      </div>
    );
  }

  const serverErrors = state.status === "error" ? state.fieldErrors : {};
  const errors = { ...serverErrors, ...clientErrors };
  const formError = state.status === "error" ? state.formError : null;
  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      onSubmit={(event) => {
        const checked = resetPasswordSchema.safeParse(values);
        if (!checked.success) {
          event.preventDefault();
          setClientErrors(fieldErrorsFrom<ResetField>(checked.error));
          setFocusTick((tick) => tick + 1);
        } else setClientErrors({});
      }}
      className="flex flex-col gap-4 rounded-(--r-md) border border-line bg-surface-1 p-5"
    >
      <ErrorSummary errors={errors} labels={{ password: "New password", confirm: "Confirm new password" }} formError={formError} id="reset-summary" />
      {formError && (
        <Link href="/portal/forgot-password" className="-mt-2 text-sm font-medium text-ink-1 underline underline-offset-4">
          Request a new reset link
        </Link>
      )}
      <FormField id="password" label="New password" required error={errors.password}>
        {(control) => (
          <>
            <Input
              {...control}
              aria-describedby={[control["aria-describedby"], "reset-password-rules"].filter(Boolean).join(" ")}
              name="password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
            />
            <PasswordRules id="reset-password-rules" password={values.password} />
          </>
        )}
      </FormField>
      <FormField id="confirm" label="Confirm new password" required error={errors.confirm}>
        {(control) => (
          <Input
            {...control}
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={values.confirm}
            onChange={(event) => setValues((current) => ({ ...current, confirm: event.target.value }))}
          />
        )}
      </FormField>
      <Submit idle="Update password" busy="Updating…" />
    </form>
  );
}
