"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import * as React from "react";
import { Notice } from "@/components/state";
import { evaluateReturn, RETURN_QUESTIONS, RETURNS_RULES, returnsRulesAreConfirmed, type ReturnFacts, type ReturnQuestion } from "@/lib/returns-policy";

/**
 * A preliminary answer to "can I return this?", asking only the fact the next
 * rule needs. It cites the policy section whose rule fired, names the rules
 * version, and never approves anything: the counter inspects every return.
 */
export function ReturnChecker() {
  const [facts, setFacts] = React.useState<ReturnFacts>({});
  const [days, setDays] = React.useState("");
  const outcome = evaluateReturn(facts);
  const answered = Object.keys(facts).length;

  if (!returnsRulesAreConfirmed()) {
    return (
      <section aria-labelledby="return-checker-title" className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7">
        <h2 id="return-checker-title" className="text-lead font-semibold text-ink-1">Check a return</h2>
        <p className="mt-3 text-sm text-ink-2">
          Returns are reviewed by our team. Start a return and we&apos;ll confirm the terms for your order within one business day. Installed
          equipment that stopped working is a warranty claim instead.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/returns/start" className="inline-flex min-h-11 items-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink hover:bg-brand/90">
            Start a return
          </Link>
          <Link href="/warranty" className="inline-flex min-h-11 items-center rounded-(--r-sm) border border-line bg-surface-1 px-4 text-sm font-medium text-ink-1 hover:bg-surface-2">
            File a warranty claim
          </Link>
        </div>
      </section>
    );
  }

  function answer(question: ReturnQuestion, value: boolean | number) {
    setFacts((current) => ({ ...current, [question]: value }));
  }

  return (
    <section aria-labelledby="return-checker-title" className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="return-checker-title" className="text-lead font-semibold text-ink-1">
          Check a return
        </h2>
        <p className="text-meta text-ink-3">Preliminary · staff confirm every return</p>
      </div>

      <div aria-live="polite" className="mt-4">
        {outcome.kind === "needs" ? (
          <Question
            key={outcome.question}
            question={outcome.question}
            days={days}
            onDays={setDays}
            onAnswer={(value) => answer(outcome.question, value)}
          />
        ) : (
          <div>
            <Notice
              tone={outcome.verdict === "full_refund" || outcome.verdict === "refund_less_restocking" || outcome.verdict === "damage_claim" ? "success" : "warning"}
              title={outcome.headline}
            >
              {outcome.explanation}{" "}
              <a href={`#${outcome.sectionId}`} className="font-medium text-ink-1 underline underline-offset-4">
                See the policy section
              </a>
              .
            </Notice>
            <p className="mt-3 text-meta text-ink-3">
              Rules {outcome.rulesVersion}, policy version {outcome.documentVersion}. This is not an approval: an RMA number is
              issued only after staff review.
            </p>
            {outcome.verdict === "warranty" && (
              <div className="mt-4">
                <Link href="/warranty" className="inline-flex min-h-11 items-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink hover:bg-brand/90">
                  File a warranty claim
                </Link>
              </div>
            )}
            {outcome.verdict !== "not_returnable" && outcome.verdict !== "warranty" && (
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/portal/returns/new" className="inline-flex min-h-11 items-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink hover:bg-brand-hover">
                  Start a return from your account
                </Link>
                <Link href="/returns/start" className="inline-flex min-h-11 items-center rounded-(--r-sm) border border-line bg-surface-1 px-4 text-sm font-medium text-ink-1 hover:bg-surface-2">
                  Ordered as a guest? Start with your order email
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {answered > 0 && (
        <button
          type="button"
          onClick={() => {
            setFacts({});
            setDays("");
          }}
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-2 underline underline-offset-4 hover:text-ink-1"
        >
          <RotateCcw size={14} aria-hidden="true" /> Start over
        </button>
      )}
      <p className="mt-2 text-meta text-ink-3">
        {RETURNS_RULES.windowDays}-day window · {RETURNS_RULES.restockingFeePercent}% restocking fee on opened units · RMA valid {RETURNS_RULES.rmaValidDays} days
      </p>
    </section>
  );
}

function Question({
  question,
  days,
  onDays,
  onAnswer,
}: {
  question: ReturnQuestion;
  days: string;
  onDays: (value: string) => void;
  onAnswer: (value: boolean | number) => void;
}) {
  const spec = RETURN_QUESTIONS[question];
  const id = `return-q-${question}`;
  if (spec.kind === "days") {
    const value = Number(days);
    const valid = days !== "" && Number.isInteger(value) && value >= 0 && value <= 3650;
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onAnswer(value);
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor={id} className="text-base font-medium text-ink-1">
          {spec.prompt}
        </label>
        <div className="flex gap-2">
          <input
            id={id}
            inputMode="numeric"
            value={days}
            onChange={(event) => onDays(event.target.value.replace(/\D/g, "").slice(0, 4))}
            className="h-11 w-28 rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
          />
          <button type="submit" disabled={!valid} className="h-11 rounded-(--r-sm) bg-brand px-5 text-sm font-medium text-brand-ink disabled:opacity-50">
            Continue
          </button>
        </div>
      </form>
    );
  }
  return (
    <fieldset className="border-0 p-0">
      <legend className="p-0 text-base font-medium text-ink-1">{spec.prompt}</legend>
      {spec.hint && <p className="mt-1 text-meta text-ink-3">{spec.hint}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => onAnswer(true)} className="h-11 min-w-20 rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-sm font-medium text-ink-1 hover:bg-surface-2">
          Yes
        </button>
        <button type="button" onClick={() => onAnswer(false)} className="h-11 min-w-20 rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-sm font-medium text-ink-1 hover:bg-surface-2">
          No
        </button>
      </div>
    </fieldset>
  );
}
