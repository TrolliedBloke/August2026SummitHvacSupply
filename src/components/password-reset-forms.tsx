"use client";

import * as React from "react";
import Link from "next/link";
import { requestPasswordReset, completePasswordReset } from "@/lib/backend/auth-actions";

const field =
  "mt-1 w-full rounded-(--r-sm) border border-line bg-surface-1 px-3 py-2 text-ink-1 outline-none focus:border-line-strong";
const button =
  "mt-4 w-full rounded-(--r-sm) bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-60";

export function ForgotPasswordForm() {
  const [state, action, pending] = React.useActionState(requestPasswordReset, { ok: false });

  // Identical confirmation whether or not the address has an account. The
  // server behaves the same way; this only mirrors it.
  if (state.ok) {
    return (
      <div className="rounded-(--r-md) border border-line bg-surface-1 p-5">
        <p className="font-medium text-ink-1">Check your email</p>
        <p className="mt-2 text-sm leading-6 text-ink-2">
          If an account exists for that address, we have sent a link to reset the password. The
          link expires shortly, and requesting another replaces it.
        </p>
        <Link href="/portal/login" className="mt-4 inline-block text-sm underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-(--r-md) border border-line bg-surface-1 p-5">
      <label htmlFor="email" className="block text-sm font-medium text-ink-1">
        Email address
      </label>
      <input id="email" name="email" type="email" autoComplete="email" required className={field} />
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <Link href="/portal/login" className="mt-4 inline-block text-sm text-ink-2 underline">
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = React.useActionState(completePasswordReset, { ok: false });

  if (state.ok) {
    return (
      <div className="rounded-(--r-md) border border-line bg-surface-1 p-5">
        <p className="font-medium text-ink-1">Password updated</p>
        <p className="mt-2 text-sm leading-6 text-ink-2">
          Your previous password no longer works. Sign in with the new one.
        </p>
        <Link href="/portal/login" className="mt-4 inline-block text-sm underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-(--r-md) border border-line bg-surface-1 p-5">
      <label htmlFor="password" className="block text-sm font-medium text-ink-1">
        New password
      </label>
      <input
        id="password" name="password" type="password" autoComplete="new-password"
        minLength={8} required className={field}
      />
      <label htmlFor="confirm" className="mt-4 block text-sm font-medium text-ink-1">
        Confirm new password
      </label>
      <input
        id="confirm" name="confirm" type="password" autoComplete="new-password"
        minLength={8} required className={field}
      />
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
