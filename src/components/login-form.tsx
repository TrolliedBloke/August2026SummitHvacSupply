"use client";

import Link from "next/link";
import * as React from "react";
import { useFormStatus } from "react-dom";
import { LogIn } from "lucide-react";
import { signIn } from "@/lib/backend/auth-actions";
import { AUTH_IDLE, type AuthResult } from "@/lib/forms/auth";
import { ErrorSummary, FormField, Input, focusFirstInvalid } from "@/components/form";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-60"
    >
      <LogIn size={16} aria-hidden="true" />
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

/**
 * Sign-in. A wrong password and an unknown address get the same message, by
 * design. After sign-in the server routes by access state, so a valid account
 * that is pending or not yet linked lands on an explanation, not back here.
 */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = React.useActionState(signIn, AUTH_IDLE as AuthResult<"email" | "password">);
  const formRef = React.useRef<HTMLFormElement>(null);
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};
  const formError = state.status === "error" ? state.formError : null;

  React.useEffect(() => {
    if (state.status !== "error") return;
    if (Object.keys(state.fieldErrors).length) focusFirstInvalid(formRef.current);
    else formRef.current?.querySelector<HTMLElement>("#login-error")?.focus();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} noValidate className="mt-7 flex flex-col gap-4 rounded-(--r-md) border border-line bg-surface-1 p-6">
      <input type="hidden" name="next" value={next} />
      {formError && (
        <p id="login-error" tabIndex={-1} role="alert" className="rounded-(--r-sm) border border-state-danger-line bg-state-danger px-3 py-2 text-sm text-state-danger-ink outline-none">
          {formError}
        </p>
      )}
      <ErrorSummary errors={fieldErrors} labels={{ email: "Email", password: "Password" }} id="login-summary" />
      <FormField id="email" label="Email" required error={fieldErrors.email}>
        {(control) => (
          <Input
            {...control}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={state.status === "error" ? state.values?.email : undefined}
            key={state.status === "error" ? `email-${state.values?.email}` : "email"}
          />
        )}
      </FormField>
      <div className="flex flex-col gap-1.5">
        <FormField id="password" label="Password" required error={fieldErrors.password}>
          {(control) => <Input {...control} name="password" type="password" autoComplete="current-password" />}
        </FormField>
        <Link href="/portal/forgot-password" className="self-end py-2 text-xs text-ink-2 underline underline-offset-4">
          Forgot password?
        </Link>
      </div>
      <SubmitButton />
      <p className="text-center text-xs text-ink-3">Retail customers and approved wholesale accounts.</p>
    </form>
  );
}
