"use client";

import * as React from "react";
import Link from "next/link";
import { Notice } from "@/components/state";
import { Select } from "@/components/form";
import { evaluateReturn, RETURN_QUESTIONS, returnsRulesAreConfirmed, type ReturnFacts, type ReturnQuestion } from "@/lib/returns-policy";
import type { ReturnableLine } from "@/lib/backend/returns";

const REASONS = [
  { value: "wrong_item", label: "Wrong item received" },
  { value: "damaged", label: "Damaged in transit" },
  { value: "defective", label: "Dead on arrival / defective" },
  { value: "changed_mind", label: "No longer needed" },
  { value: "ordered_wrong", label: "Ordered the wrong item" },
  { value: "job_cancelled", label: "Job cancelled" },
];

/**
 * Start a return from one order line: order, SKU and quantity limit are
 * prefilled from the order, and a recorded delivery date answers the "how
 * many days" question. Until operations confirms the rules, the policy result
 * is not shown as an outcome: the request goes to staff, who confirm terms.
 */
export function StartReturnForm({ line, endpoint = "/api/returns", token }: { line: ReturnableLine; endpoint?: string; token?: string }) {
  const recordedDays = line.daysSinceDelivery ?? undefined;
  const [quantity, setQuantity] = React.useState(1);
  const [reason, setReason] = React.useState("");
  const [facts, setFacts] = React.useState<ReturnFacts>(recordedDays === undefined ? {} : { daysSinceDelivery: recordedDays });
  const [days, setDays] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [result, setResult] = React.useState<{ ok: true; rmaNumber: string; validDays: number; reviewOnly: boolean } | { ok: false; error: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const outcome = evaluateReturn(facts);
  const confirmed = returnsRulesAreConfirmed();

  async function submit() {
    setBusy(true);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, lineId: line.lineId, quantity, reason, facts, notes: notes.trim() || undefined }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setBusy(false);
    setResult(payload?.ok ? payload : { ok: false, error: payload?.error ?? "The return could not be started. Call the counter." });
  }

  if (result?.ok) {
    return (
      <Notice tone="success" role="status" title={`Return requested: ${result.rmaNumber}`}>
        We&apos;ve emailed you a copy. The counter reviews it and replies within one business day with the terms and how to send it back. Please
        don&apos;t ship anything until we approve it; an approved return is valid for {result.validDays} days.
      </Notice>
    );
  }

  const warranty = outcome.kind === "result" && outcome.verdict === "warranty";
  const blockedByPolicy = outcome.kind === "result" && confirmed && outcome.verdict === "not_returnable";
  const question = outcome.kind === "needs" ? outcome.question : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-1">
          Quantity (up to {line.returnable})
          <input type="number" min={1} max={line.returnable} value={quantity} onChange={(event) => setQuantity(Math.min(line.returnable, Math.max(1, Number(event.target.value) || 1)))} className="h-11 rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm" />
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-medium text-ink-1">
          <span id={`reason-${line.lineId}`}>Reason</span>
          <Select ariaLabel="Reason for return" value={reason} onChange={setReason} placeholder="Select a reason" options={REASONS} />
        </div>
      </div>
      {question && (
        <QuestionStep
          question={question}
          days={days}
          onDays={setDays}
          onAnswer={(value) => setFacts((current) => ({ ...current, [question as ReturnQuestion]: value }))}
        />
      )}
      {warranty && (
        <Notice tone="info" title="Installed equipment is a warranty claim, not a return">
          We coordinate it with the manufacturer.{" "}
          <Link href="/warranty" className="font-medium underline underline-offset-4">
            File a warranty claim
          </Link>
        </Notice>
      )}
      {outcome.kind === "result" && !warranty && confirmed && (
        <Notice tone={outcome.verdict === "not_returnable" ? "warning" : "info"} title={`Preliminary: ${outcome.headline}`}>
          {outcome.explanation} Staff confirm every return.
        </Notice>
      )}
      {outcome.kind === "result" && !warranty && !confirmed && (
        <Notice tone="info" title="Our team reviews this return">
          We confirm the terms for your order after reviewing it. Nothing is decided yet.
        </Notice>
      )}
      {outcome.kind === "result" && !warranty && !blockedByPolicy && (
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-1">
          Anything we should know? (optional)
          <textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 2000))} rows={3} className="rounded-(--r-sm) border border-control-border bg-control-bg px-3 py-2 text-sm" />
        </label>
      )}
      {result && !result.ok && (
        <Notice tone="danger" role="alert">
          {result.error}
        </Notice>
      )}
      <button
        type="button"
        disabled={busy || !reason || outcome.kind !== "result" || warranty || blockedByPolicy}
        onClick={submit}
        className="h-11 self-start rounded-(--r-sm) bg-brand px-5 text-sm font-medium text-brand-ink disabled:opacity-50"
      >
        {busy ? "Sending…" : "Request return"}
      </button>
    </div>
  );
}

function QuestionStep({ question, days, onDays, onAnswer }: { question: ReturnQuestion; days: string; onDays: (value: string) => void; onAnswer: (value: boolean | number) => void }) {
  const spec = RETURN_QUESTIONS[question];
  if (spec.kind === "days") {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-1">
          {spec.prompt}
          <input inputMode="numeric" value={days} onChange={(event) => onDays(event.target.value.replace(/\D/g, "").slice(0, 4))} className="h-11 w-28 rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-sm" />
        </label>
        <button type="button" disabled={days === ""} onClick={() => onAnswer(Number(days))} className="h-11 rounded-(--r-sm) border border-line-strong px-4 text-sm font-medium disabled:opacity-50">
          Continue
        </button>
      </div>
    );
  }
  return (
    <fieldset className="border-0 p-0">
      <legend className="p-0 text-sm font-medium text-ink-1">{spec.prompt}</legend>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => onAnswer(true)} className="h-11 min-w-20 rounded-(--r-sm) border border-line-strong px-4 text-sm font-medium">Yes</button>
        <button type="button" onClick={() => onAnswer(false)} className="h-11 min-w-20 rounded-(--r-sm) border border-line-strong px-4 text-sm font-medium">No</button>
      </div>
    </fieldset>
  );
}
