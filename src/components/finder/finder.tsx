"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Phone, RotateCcw } from "lucide-react";
import * as React from "react";
import { Button, LinkButton } from "@/components/ui";
import { FormField, Input } from "@/components/form";
import { track } from "@/lib/track";
import { submitForm } from "@/lib/forms/result";
import { SITE } from "@/lib/site";
import { MANUAL_J_CAVEAT } from "@/lib/sizing";
import { WARRANTY_DISCLOSURE } from "@/lib/brand-policy";
import { FORK_OPTIONS, questionsFor, type FinderPath, type FinderQuestion, type HomeownerAnswers } from "@/lib/finder/questions";
import type { ContractorResult, FinderResult, HomeownerResult, ResultItem } from "@/lib/finder/recommend";
import { prefillFromAnswers, storeHandoff } from "@/lib/finder/handoff";
import type { TradeTier } from "@/lib/trade-tier";
import { browserOptedOut } from "@/lib/privacy-cookies";

/**
 * The system finder (docs/FINDER-AND-AUDIENCE-PLAN.md Phase 3). One fork
 * question, then four or five per path; every question after the fork can be
 * skipped. Results come first. Email is offered after them, never in front.
 */

type Answers = Record<string, string | undefined>;
type Phase =
  | { kind: "fork" }
  | { kind: "question"; path: FinderPath; index: number }
  | { kind: "loading"; path: FinderPath }
  | { kind: "error"; path: FinderPath; message: string }
  | { kind: "results"; path: FinderPath; result: FinderResult; tier: TradeTier };

export function Finder() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>({ kind: "fork" });
  const [answers, setAnswers] = React.useState<Answers>({});
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const firstRender = React.useRef(true);

  // Move focus to each new step's heading, so screen readers hear the new
  // question and keyboard users don't start from the top of the page.
  const stepKey = phase.kind === "question" ? `question-${phase.index}` : phase.kind;
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [stepKey]);

  const path = phase.kind === "fork" ? null : phase.path;
  const questions = path ? questionsFor(path, answers) : [];

  function choosePath(value: string) {
    if (value === "browse") {
      track("finder_browse_chosen");
      router.push("/products");
      return;
    }
    const chosen = value as FinderPath;
    setAnswers({});
    track("finder_started", { path: chosen });
    setPhase({ kind: "question", path: chosen, index: 0 });
  }

  async function submit(finalPath: FinderPath, finalAnswers: Answers) {
    setPhase({ kind: "loading", path: finalPath });
    const result = await submitForm<{ result: FinderResult; tier: TradeTier }>("/api/finder", { path: finalPath, answers: finalAnswers });
    if (!result.ok) {
      setPhase({ kind: "error", path: finalPath, message: result.formError ?? "We could not load your results." });
      return;
    }
    track("finder_results_viewed", {
      path: finalPath,
      options: result.result.path === "homeowner" ? result.result.options.length : result.result.items.length,
    });
    setPhase({ kind: "results", path: finalPath, result: result.result, tier: result.tier });
  }

  function advance(value: string | undefined) {
    if (phase.kind !== "question") return;
    const question = questions[phase.index];
    const next = { ...answers, [question.id]: value };
    if (value === undefined) delete next[question.id];
    setAnswers(next);
    track("finder_step", { path: phase.path, step: question.id, skipped: value === undefined });
    const nextQuestions = questionsFor(phase.path, next);
    const nextIndex = nextQuestions.findIndex((candidate) => candidate.id === question.id) + 1;
    if (nextIndex >= nextQuestions.length) void submit(phase.path, next);
    else setPhase({ kind: "question", path: phase.path, index: nextIndex });
  }

  function back() {
    if (phase.kind !== "question") return;
    if (phase.index === 0) setPhase({ kind: "fork" });
    else setPhase({ kind: "question", path: phase.path, index: phase.index - 1 });
  }

  function restart() {
    setAnswers({});
    setPhase({ kind: "fork" });
  }

  if (phase.kind === "fork") {
    return (
      <section aria-labelledby="finder-step-heading" className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7">
        <h2 id="finder-step-heading" ref={headingRef} tabIndex={-1} className="text-lead font-medium text-ink-1 outline-none">
          Who is this for?
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {FORK_OPTIONS.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => choosePath(option.value)}
                className="group flex h-full w-full flex-col items-start rounded-(--r-sm) border border-line bg-surface-1 px-4 py-4 text-left transition-colors duration-150 hover:border-ink-3 hover:bg-surface-2"
              >
                <span className="flex w-full items-center justify-between gap-2 text-item font-medium text-ink-1">
                  {option.label}
                  <ArrowRight size={16} aria-hidden="true" className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 text-meta text-ink-3">{option.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (phase.kind === "question") {
    const question = questions[phase.index];
    return (
      <QuestionStep
        key={`${phase.path}-${question.id}`}
        question={question}
        index={phase.index}
        total={questions.length}
        value={answers[question.id]}
        headingRef={headingRef}
        onBack={back}
        onAnswer={advance}
      />
    );
  }

  if (phase.kind === "loading") {
    return (
      <section aria-busy="true" className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7">
        <h2 ref={headingRef} tabIndex={-1} className="text-lead font-medium text-ink-1 outline-none">
          Matching your answers…
        </h2>
        <p className="mt-2 text-sm text-ink-3">Checking the catalog and live stock.</p>
      </section>
    );
  }

  if (phase.kind === "error") {
    return (
      <section role="alert" className="rounded-(--r-md) border border-state-danger-line bg-state-danger p-5 sm:p-7">
        <h2 ref={headingRef} tabIndex={-1} className="text-lead font-medium text-state-danger-ink outline-none">
          {phase.message}
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void submit(phase.path, answers)}>Try again</Button>
          <a href={SITE.phoneHref} className="inline-flex h-11 items-center gap-2 text-sm font-medium text-ink-1 underline underline-offset-4">
            Call {SITE.phone}
          </a>
        </div>
      </section>
    );
  }

  return phase.result.path === "homeowner" ? (
    <HomeownerResults result={phase.result} answers={answers as HomeownerAnswers} headingRef={headingRef} onRestart={restart} />
  ) : (
    <ContractorResults result={phase.result} tier={phase.tier} headingRef={headingRef} onRestart={restart} />
  );
}

/* --------------------------------------------------------------- questions */

function QuestionStep({
  question,
  index,
  total,
  value,
  headingRef,
  onBack,
  onAnswer,
}: {
  question: FinderQuestion;
  index: number;
  total: number;
  value: string | undefined;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onAnswer: (value: string | undefined) => void;
}) {
  const [draft, setDraft] = React.useState(value ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const isLast = index === total - 1;
  const headingId = `finder-q-${question.id}`;
  const helpId = question.help ? `${headingId}-help` : undefined;

  function next() {
    if (question.kind === "zip") {
      const zip = draft.trim();
      if (zip && !/^\d{5}$/.test(zip)) {
        setError("Enter a five-digit ZIP code, or skip this question.");
        return;
      }
      onAnswer(zip || undefined);
      return;
    }
    onAnswer(draft || undefined);
  }

  return (
    <section aria-labelledby={headingId} className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4 text-meta text-ink-3">
        <span>
          Question {index + 1} of {total}
        </span>
        <span>Free · no account needed</span>
      </div>
      <div
        role="progressbar"
        aria-label="Finder progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index}
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full bg-ink-1 transition-[width] duration-150" style={{ width: `${(index / total) * 100}%` }} />
      </div>

      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="mt-6 text-lead font-medium text-ink-1 outline-none">
        {question.prompt}
      </h2>
      {question.help && (
        <p id={helpId} className="mt-1 text-sm text-ink-3">
          {question.help}
        </p>
      )}

      <form
        className="mt-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          next();
        }}
      >
        {question.kind === "choice" ? (
          <div role="radiogroup" aria-labelledby={headingId} aria-describedby={helpId} className="grid gap-2 sm:grid-cols-2">
            {question.options?.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-3 rounded-(--r-sm) border border-line bg-surface-1 px-4 py-3 transition-colors duration-150 hover:bg-surface-2 has-[:checked]:border-ink-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink-1"
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.value}
                  checked={draft === option.value}
                  onChange={() => setDraft(option.value)}
                  className="mt-1 size-4 shrink-0 accent-[var(--ink-1)] focus-visible:outline-none"
                />
                <span className="min-w-0">
                  <span className="block text-item text-ink-1">{option.label}</span>
                  {option.hint && <span className="mt-0.5 block text-meta text-ink-3">{option.hint}</span>}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="max-w-xs">
            <FormField id={`finder-${question.id}`} label="ZIP code" error={error}>
              {(control) => (
                <Input
                  {...control}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={5}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value.replace(/\D/g, "").slice(0, 5));
                    setError(null);
                  }}
                />
              )}
            </FormField>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={onBack} className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink-1">
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onAnswer(undefined)} className="inline-flex h-11 items-center px-3 text-sm font-medium text-ink-2 hover:text-ink-1">
              Skip
            </button>
            <Button type="submit" disabled={question.kind === "choice" && !draft}>
              {isLast ? "See my results" : "Next"} <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

/* ----------------------------------------------------------------- results */

function StockLine({ item }: { item: ResultItem }) {
  if (item.stock.verified && item.stock.quantity > 0) {
    return <span className="text-brand">{item.stock.quantity} counted in Newark</span>;
  }
  return <span className="text-ink-3">Stock confirmed at the counter</span>;
}

function ItemRow({ item }: { item: ResultItem }) {
  return (
    <li className="flex gap-3 py-3">
      <span className="relative size-16 shrink-0 overflow-hidden rounded-(--r-sm) border border-line bg-white">
        <Image src={item.image} alt="" fill sizes="64px" className="object-contain p-1" />
      </span>
      <span className="min-w-0 flex-1">
        <Link href={item.href} className="block text-item font-medium text-ink-1 underline-offset-4 hover:underline">
          {item.title}
        </Link>
        <span className="mt-0.5 block text-meta text-ink-3">
          <span className="part-number">{item.sku}</span>
          {item.btu ? ` · ${item.btu.toLocaleString("en-US")} BTU` : ""}
          {item.refrigerant ? ` · ${item.refrigerant}` : ""}
        </span>
        <span className="mt-0.5 block text-meta">
          <StockLine item={item} />
        </span>
        {item.notice && <span className="mt-1 block text-meta text-state-warning-ink">{item.notice}</span>}
      </span>
    </li>
  );
}

function ResultsHeader({
  headingRef,
  title,
  children,
  onRestart,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  title: string;
  children?: React.ReactNode;
  onRestart: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 ref={headingRef} tabIndex={-1} className="text-h2 font-medium tracking-tight text-ink-1 outline-none">
          {title}
        </h2>
        {children}
      </div>
      <button type="button" onClick={onRestart} className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink-1">
        <RotateCcw size={15} aria-hidden="true" /> Start over
      </button>
    </div>
  );
}

function HomeownerResults({
  result,
  answers,
  headingRef,
  onRestart,
}: {
  result: HomeownerResult;
  answers: HomeownerAnswers;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onRestart: () => void;
}) {
  const router = useRouter();

  function requestInstaller() {
    storeHandoff(prefillFromAnswers(answers));
    track("finder_installer_clicked");
    router.push("/homeowners#homeowner-request");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7">
        <ResultsHeader headingRef={headingRef} title="Your shortlist" onRestart={onRestart}>
          <p className="mt-1 text-ink-2">
            {result.laneLabel}
            {result.capacity ? `, starting around ${result.capacity}` : ""}.
          </p>
        </ResultsHeader>

        {result.options.length > 0 ? (
          <ul className="mt-5 flex flex-col gap-4">
            {result.options.map((option) => (
              <li key={option.ahriReference} className="rounded-(--r-sm) border border-line p-4">
                <h3 className="text-item font-medium text-ink-1">{option.title}</h3>
                <p className="mt-1 text-meta text-ink-3">
                  Meets the California efficiency minimum as a matched pair · <span className="part-number">{option.ratings}</span>
                </p>
                <ul className="mt-1 divide-y divide-line">
                  {option.components.map((component) => (
                    <ItemRow key={component.id} item={component} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 rounded-(--r-sm) bg-surface-2 p-4 text-sm leading-6 text-ink-2">
            <p>
              None of the systems we can verify for a California install fits these answers yet. We only list a system here when its
              efficiency rating is on file and clears the state minimum as a certified matched pair.
            </p>
            <p className="mt-2">
              A licensed installer can size the job, and we source the matched system.{" "}
              <Link href={result.browseHref} className="text-ink-1 underline underline-offset-4">
                Browse the catalog
              </Link>
              .
            </p>
          </div>
        )}
        <p className="mt-4 text-meta text-ink-3">{MANUAL_J_CAVEAT}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <Button onClick={requestInstaller}>
            Get matched with a licensed installer <ArrowRight size={16} aria-hidden="true" />
          </Button>
          <a href={SITE.phoneHref} className="inline-flex h-11 items-center gap-2 text-sm font-medium text-ink-1">
            <Phone size={16} aria-hidden="true" /> Call or text {SITE.phone}
          </a>
        </div>
      </section>

      <section aria-labelledby="install-steps-heading" className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7">
        <h2 id="install-steps-heading" className="text-lead font-medium text-ink-1">
          What your install will involve
        </h2>
        <ol className="mt-4 flex flex-col gap-4">
          {result.installSteps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="tnum grid size-7 shrink-0 place-items-center rounded-full border border-line text-meta text-ink-2">{index + 1}</span>
              <span className="min-w-0 text-sm leading-6 text-ink-2">
                <span className="font-medium text-ink-1">{step.title}.</span> {step.body}{" "}
                {step.href && (
                  <Link href={step.href} className="text-ink-1 underline underline-offset-4">
                    Read the guide
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-meta text-ink-3">{WARRANTY_DISCLOSURE}</p>
      </section>

      <EmailShortlist audience="homeowner" />
    </div>
  );
}

function ContractorResults({
  result,
  tier,
  headingRef,
  onRestart,
}: {
  result: ContractorResult;
  tier: TradeTier;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onRestart: () => void;
}) {
  const verified = tier === "verified_pro";
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7">
        <ResultsHeader headingRef={headingRef} title={result.heading} onRestart={onRestart}>
          <p className="mt-1 text-ink-2">
            {verified
              ? "Your account pricing shows on each product page."
              : "Approved trade accounts see account pricing after sign-in."}
          </p>
        </ResultsHeader>

        {!verified && (
          <div className="mt-5 flex flex-wrap gap-3">
            <LinkButton href="/dealers" onClick={() => track("finder_apply_clicked")}>
              Apply for a trade account
            </LinkButton>
            <LinkButton href="/portal/login?next=/products" variant="secondary">
              Contractor sign in
            </LinkButton>
          </div>
        )}

        {result.items.length > 0 ? (
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {result.items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          result.alert && (
            <p className="mt-5 rounded-(--r-sm) bg-surface-2 p-4 text-sm leading-6 text-ink-2">
              Nothing in the catalog matches every answer. Set an alert below, or call the counter to check what is coming in.
            </p>
          )
        )}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link href={result.browseHref} className="inline-flex h-11 items-center text-sm font-medium text-ink-1 underline underline-offset-4">
            Browse the full category
          </Link>
          <a href={SITE.phoneHref} className="inline-flex h-11 items-center gap-2 text-sm font-medium text-ink-1">
            <Phone size={16} aria-hidden="true" /> Hold stock: {SITE.phone}
          </a>
        </div>
      </section>

      {result.alert && <StockAlertForm alert={result.alert} />}
      {result.items.length > 0 && <EmailShortlist audience="contractor" />}
    </div>
  );
}

/* ------------------------------------------------------------------ emails */

function EmailShortlist({ audience }: { audience: "homeowner" | "contractor" }) {
  const [email, setEmail] = React.useState("");
  const [marketing, setMarketing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setFormError(null);
    setSubmitting(true);
    const adSharingOptOut = browserOptedOut(document.cookie, (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
    const result = await submitForm<{ sent: true }, "email">("/api/finder/email", { email, marketingOptIn: marketing, adSharingOptOut });
    setSubmitting(false);
    if (result.ok) {
      setSent(true);
      return;
    }
    setError(result.fieldErrors.email ?? null);
    setFormError(result.fieldErrors.email ? null : result.formError);
  }

  const title = audience === "homeowner" ? "Email me my shortlist and install checklist" : "Email me these matches";
  if (sent) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-(--r-md) border border-state-success-line bg-state-success p-5 text-sm text-ink-1">
        <CheckCircle2 size={18} className="shrink-0 text-state-success-ink" aria-hidden="true" /> Sent. Check your inbox for the email from Summit.
      </p>
    );
  }
  return (
    <section aria-labelledby={`email-${audience}-heading`} className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7">
      <h2 id={`email-${audience}-heading`} className="text-lead font-medium text-ink-1">
        {title}
      </h2>
      <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
        <div className="max-w-md">
          <FormField id={`finder-email-${audience}`} label="Email address" required error={error}>
            {(control) => <Input {...control} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />}
          </FormField>
        </div>
        <label className="flex items-start gap-3 text-sm leading-6 text-ink-2">
          <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--ink-1)]" />
          <span>
            {audience === "homeowner"
              ? "Also send me occasional emails about planning this project."
              : "Also send me occasional emails about equipment and stock."}{" "}
            <span className="text-ink-3">Unsubscribe any time.</span>
          </span>
        </label>
        {formError && (
          <p role="alert" className="text-sm text-state-danger-ink">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send it"}
          </Button>
          <span className="text-meta text-ink-3">
            One email, unless you tick the box. See our{" "}
            <Link href="/privacy" className="text-ink-1 underline underline-offset-4">
              privacy policy
            </Link>
            .
          </span>
        </div>
      </form>
    </section>
  );
}

function StockAlertForm({ alert }: { alert: NonNullable<ContractorResult["alert"]> }) {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setFormError(null);
    setSubmitting(true);
    const result = await submitForm<{ ok: true }, "email">("/api/stock-alerts", { email, category: alert.category, btu: alert.btu });
    setSubmitting(false);
    if (result.ok) {
      setSaved(true);
      return;
    }
    setError(result.fieldErrors.email ?? null);
    setFormError(result.fieldErrors.email ? null : result.formError);
  }

  if (saved) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-(--r-md) border border-state-success-line bg-state-success p-5 text-sm text-ink-1">
        <CheckCircle2 size={18} className="shrink-0 text-state-success-ink" aria-hidden="true" /> Alert set. We email when the warehouse counts {alert.label} in Newark.
      </p>
    );
  }
  return (
    <section aria-labelledby="stock-alert-heading" className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7">
      <h2 id="stock-alert-heading" className="text-lead font-medium text-ink-1">
        Tell me when {alert.label} is in stock
      </h2>
      <p className="mt-1 text-sm text-ink-3">Counted stock only, at most one email a day.</p>
      <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="w-full max-w-md">
          <FormField id="stock-alert-email" label="Work email" required error={error}>
            {(control) => <Input {...control} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />}
          </FormField>
        </div>
        <Button type="submit" variant="secondary" disabled={submitting}>
          {submitting ? "Saving…" : "Set alert"}
        </Button>
      </form>
      {formError && (
        <p role="alert" className="mt-3 text-sm text-state-danger-ink">
          {formError}
        </p>
      )}
    </section>
  );
}
