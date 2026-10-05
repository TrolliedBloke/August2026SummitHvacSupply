"use client";

import * as React from "react";
import { Notice } from "@/components/state";

/** Order number + email → a return link emailed to the order's address. */
export function GuestReturnLinkForm() {
  const [orderNumber, setOrderNumber] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<{ status: "idle" | "sending" | "sent" } | { status: "error"; message: string }>({ status: "idle" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState({ status: "sending" });
    const response = await fetch("/api/returns/guest-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber, email }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setState(payload?.ok ? { status: "sent" } : { status: "error", message: payload?.error ?? "We couldn't send the link. Call the counter." });
  }

  if (state.status === "sent") {
    return (
      <Notice tone="success" role="status" title="Check your email">
        If that order number matches the email, a return link is on its way. It works for 3 days. Nothing arrived in a few minutes? Check spam, or call the counter.
      </Notice>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-1">
        Order number
        <input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} required maxLength={40} placeholder="SO-…" className="h-11 rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-1">
        Email you ordered with
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" className="h-11 rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm" />
      </label>
      {state.status === "error" && (
        <Notice tone="danger" role="alert">
          {state.message}
        </Notice>
      )}
      <button type="submit" disabled={state.status === "sending"} className="h-11 self-start rounded-(--r-sm) bg-brand px-5 text-sm font-medium text-brand-ink disabled:opacity-50">
        {state.status === "sending" ? "Sending…" : "Email me a return link"}
      </button>
    </form>
  );
}
