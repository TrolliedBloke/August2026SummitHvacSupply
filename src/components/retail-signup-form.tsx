"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { signUpRetail } from "@/lib/backend/auth-actions";
import { AUTH_IDLE, signupSchema, type AuthResult, type SignupField } from "@/lib/forms/auth";
import { fieldErrorsFrom } from "@/lib/forms/result";
import { ErrorSummary, FormField, Input, focusFirstInvalid } from "@/components/form";
import { PasswordRules } from "@/components/password-rules";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-60">
      <UserPlus size={16} aria-hidden="true" />
      {pending ? "Creating account…" : "Create retail account"}
    </button>
  );
}

const LABELS: Record<SignupField, string> = { name: "Full name", email: "Email", password: "Password" };

/**
 * Retail signup on the shared schema (lib/forms/auth.ts). Problems the browser
 * can see are caught before any request, with the password still in the field.
 * Problems only the server can see come back as typed field or form errors with
 * the name and email restored; the password is deliberately not echoed back.
 */
export function RetailSignupForm() {
  const [state, action] = React.useActionState(signUpRetail, AUTH_IDLE as AuthResult<SignupField>);
  const [clientErrors, setClientErrors] = React.useState<Partial<Record<SignupField, string>>>({});
  const [values, setValues] = React.useState({ name: "", email: "", password: "" });
  const [restored, setRestored] = React.useState<AuthResult<SignupField> | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [focusTick, setFocusTick] = React.useState(0);

  // Restore non-secret values after a server-side failure.
  if (state !== restored) {
    setRestored(state);
    if (state.status === "error" && state.values) {
      setValues((current) => ({ name: state.values?.name ?? current.name, email: state.values?.email ?? current.email, password: "" }));
      setClientErrors({});
      setFocusTick((tick) => tick + 1);
    }
  }

  React.useEffect(() => {
    if (focusTick) focusFirstInvalid(formRef.current);
  }, [focusTick]);

  const serverErrors = state.status === "error" ? state.fieldErrors : {};
  const errors = { ...serverErrors, ...clientErrors };
  const formError = state.status === "error" ? state.formError : null;

  function update(field: SignupField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (clientErrors[field]) setClientErrors((current) => ({ ...current, [field]: undefined }));
  }

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      onSubmit={(event) => {
        const checked = signupSchema.safeParse(values);
        if (!checked.success) {
          event.preventDefault();
          setClientErrors(fieldErrorsFrom<SignupField>(checked.error));
          setFocusTick((tick) => tick + 1);
        } else {
          setClientErrors({});
        }
      }}
      className="mt-7 grid gap-4 rounded-(--r-md) border border-line bg-surface-1 p-6"
    >
      <ErrorSummary errors={errors} labels={LABELS} formError={formError} id="signup-summary" />
      <FormField id="name" label={LABELS.name} required error={errors.name}>
        {(control) => <Input {...control} name="name" autoComplete="name" value={values.name} onChange={(event) => update("name", event.target.value)} />}
      </FormField>
      <FormField id="email" label={LABELS.email} required error={errors.email}>
        {(control) => <Input {...control} name="email" type="email" autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} />}
      </FormField>
      <FormField id="password" label={LABELS.password} required error={errors.password}>
        {(control) => (
          <>
            <Input
              {...control}
              aria-describedby={[control["aria-describedby"], "password-rules"].filter(Boolean).join(" ")}
              name="password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => update("password", event.target.value)}
            />
            <PasswordRules id="password-rules" password={values.password} email={values.email} />
          </>
        )}
      </FormField>
      <Submit />
    </form>
  );
}
