"use client";

import * as React from "react";
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

/** Start a return from one order line: order, SKU and quantity limit are prefilled from the order. */
export function StartReturnForm({ line }: { line: ReturnableLine }) {
  const [quantity, setQuantity] = React.useState(1);
  const [reason, setReason] = React.useState("");
  const [facts, setFacts] = React.useState<ReturnFacts>({});
  const [days, setDays] = React.useState("");
  const [result, setResult] = React.useState<{ ok: true; rmaNumber: string; validDays: number } | { ok: false; error: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const outcome = evaluateReturn(facts);

  if (!returnsRulesAreConfirmed()) {
    return (
      <Notice tone="warning" title="Online return initiation is not available yet">
        Operations has not approved the automated eligibility rules. Contact the counter so staff can review this order line directly.
      </Notice>
    );
  }

  async function submit() {
    setBusy(true);
    const response = await fetch("/api/returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineId: line.lineId, quantity, reason, facts }) }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setBusy(false);
    setResult(payload?.ok ? payload : { ok: false, error: payload?.error ?? "The return could not be started. Call the counter." });
  }

  if (result?.ok) {
    return (
      <Notice tone="success" role="status" title={`Return started: ${result.rmaNumber}`}>
        Staff review it and email the next step. The RMA is valid for {result.validDays} days once approved. Write the RMA number on the outer packaging.
      </Notice>
    );
  }

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
      {outcome.kind === "result" && (
        <Notice tone={outcome.verdict === "not_returnable" || outcome.verdict === "warranty" ? "warning" : "info"} title={`Preliminary: ${outcome.headline}`}>
          {outcome.explanation} Staff confirm every return.
        </Notice>
      )}
      {result && !result.ok && (
        <Notice tone="danger" role="alert">
          {result.error}
        </Notice>
      )}
      <button
        type="button"
        disabled={busy || !reason || outcome.kind !== "result" || outcome.verdict === "not_returnable" || outcome.verdict === "warranty"}
        onClick={submit}
        className="h-11 self-start rounded-(--r-sm) bg-brand px-5 text-sm font-medium text-brand-ink disabled:opacity-50"
      >
        {busy ? "Starting…" : "Start return"}
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
