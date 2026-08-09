"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { LogIn } from "lucide-react";
import { signIn, type AuthResult } from "@/lib/backend/auth-actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-hover disabled:opacity-60"
    >
      <LogIn size={16} />
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const initial: AuthResult = { ok: true };
  const [state, formAction] = React.useActionState(signIn, initial);

  return (
    <form action={formAction} className="mt-7 flex flex-col gap-4 rounded-(--r-md) border border-line bg-surface-1 p-6 shadow-[var(--shadow-sm)]">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-11 rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm text-ink-1 outline-none placeholder:text-ink-4 focus:border-brand"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="h-11 rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm text-ink-1 outline-none placeholder:text-ink-4 focus:border-brand"
        />
      </div>

      {!state.ok && state.error && (
        <p role="alert" className="rounded-(--r-sm) border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <SubmitButton />
      <p className="text-center text-xs text-ink-4">
        Retail customers and approved wholesale accounts.
      </p>
    </form>
  );
}
