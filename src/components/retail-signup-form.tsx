"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { signUpRetail, type AuthResult } from "@/lib/backend/auth-actions";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex h-11 items-center justify-center gap-2 rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink disabled:opacity-60"><UserPlus size={16} />{pending ? "Creating account…" : "Create retail account"}</button>;
}

export function RetailSignupForm() {
  const [state, action] = React.useActionState(signUpRetail, { ok: true } satisfies AuthResult);
  return (
    <form action={action} className="mt-7 grid gap-4 rounded-(--r-md) border border-line bg-surface-1 p-6 shadow-[var(--shadow-sm)]">
      <Field label="Full name" name="name" autoComplete="name" />
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} hint="At least 8 characters" />
      {!state.ok && state.error && <p role="alert" className="rounded-(--r-sm) bg-danger-tint px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Submit />
    </form>
  );
}

function Field({ label, name, type = "text", autoComplete, minLength, hint }: { label: string; name: string; type?: string; autoComplete: string; minLength?: number; hint?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-ink-1">{label}<input name={name} type={type} autoComplete={autoComplete} minLength={minLength} required className="h-11 rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm outline-none focus:border-brand" />{hint && <span className="text-xs font-normal text-ink-3">{hint}</span>}</label>;
}
