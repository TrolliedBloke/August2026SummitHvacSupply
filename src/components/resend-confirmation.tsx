"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { resendConfirmation, restartSignup } from "@/lib/backend/auth-actions";
import { AUTH_IDLE, type AuthResult } from "@/lib/forms/auth";

function ResendButton({ cooldown }: { cooldown: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || cooldown > 0}
      className="inline-flex h-11 items-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-60"
    >
      {pending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend the link"}
    </button>
  );
}

/** Resend with a visible cooldown, and a way out when the address was wrong. */
export function ResendConfirmation() {
  const [state, action] = React.useActionState(resendConfirmation, AUTH_IDLE as AuthResult);
  const [cooldown, setCooldown] = React.useState(0);
  const [seen, setSeen] = React.useState<AuthResult>(state);
  if (state !== seen) {
    setSeen(state);
    setCooldown(state.status === "success" ? 60 : state.status === "error" ? state.retryAfterSeconds ?? 0 : 0);
  }
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  return (
    <div className="mt-6 border-t border-line pt-5">
      <p role="status" className="min-h-6 text-sm text-ink-2">
        {state.status === "success" ? state.message : state.status === "error" ? state.formError : ""}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <form action={action}>
          <ResendButton cooldown={cooldown} />
        </form>
        <form action={restartSignup}>
          <button type="submit" className="inline-flex min-h-11 items-center text-sm font-medium text-ink-1 underline underline-offset-4">
            Use a different email
          </button>
        </form>
      </div>
    </div>
  );
}
