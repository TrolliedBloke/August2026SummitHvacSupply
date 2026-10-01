"use client";

import Link from "next/link";
import { CheckCircle2, MapPin, PackageCheck, Store, Truck, XCircle } from "lucide-react";
import * as React from "react";
import { useFulfillment } from "./fulfillment-context";
import { Notice } from "./state";
import { resolveFulfillmentAnswer, type FulfillmentAnswer as Answer, type FulfillmentMethod } from "@/lib/backend/fulfillment";
import { FULFILLMENT_POLICY } from "@/lib/fulfillment-policy";
import { SITE } from "@/lib/site";

const METHOD_ICON: Record<FulfillmentMethod, React.ReactNode> = {
  local_delivery: <Truck size={18} strokeWidth={1.8} aria-hidden="true" />,
  pickup: <Store size={18} strokeWidth={1.8} aria-hidden="true" />,
  freight: <PackageCheck size={18} strokeWidth={1.8} aria-hidden="true" />,
};

/**
 * "Can you deliver to my ZIP, and when?" -- answered first, from the same
 * calculator checkout enforces (lib/backend/fulfillment.ts). The ZIP is only
 * ever one the visitor typed; nothing is inferred from location. A missing
 * policy renders an honest "cannot confirm" with pickup and contact fallbacks
 * instead of a guessed date.
 */
export function FulfillmentAnswer({
  headingLevel = 2,
  title = "Check delivery to your ZIP",
  compact = false,
}: {
  headingLevel?: 2 | 3;
  title?: string;
  compact?: boolean;
}) {
  const { zip: savedZip, setZip } = useFulfillment();
  const [value, setValue] = React.useState("");
  const [answer, setAnswer] = React.useState<Answer | null>(null);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const inputId = React.useId();
  const resultRef = React.useRef<HTMLDivElement>(null);

  // A ZIP the visitor already entered elsewhere (the catalog's ZIP gate) is
  // answered on arrival. It is still their own input, never a guess.
  const [prefilled, setPrefilled] = React.useState(false);
  if (!prefilled && savedZip) {
    setPrefilled(true);
    setValue(savedZip);
    setAnswer(resolveFulfillmentAnswer(savedZip, new Date(), FULFILLMENT_POLICY));
  }

  function check(event: React.FormEvent) {
    event.preventDefault();
    const next = resolveFulfillmentAnswer(value, new Date(), FULFILLMENT_POLICY);
    setAnswer(next);
    if (next.kind === "eligible" || next.kind === "ineligible") setZip(next.zip);
  }

  return (
    <section aria-labelledby={`${inputId}-title`} className={`rounded-(--r-md) border border-line bg-surface-1 ${compact ? "p-5" : "p-5 sm:p-7"}`}>
      <Heading id={`${inputId}-title`} className="text-lead font-semibold text-ink-1">
        {title}
      </Heading>
      <form onSubmit={check} className="mt-3 flex flex-wrap items-end gap-2" noValidate>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm font-medium text-ink-1">
            Job-site or delivery ZIP
          </label>
          <input
            id={inputId}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/\D/g, "").slice(0, 5))}
            aria-invalid={answer?.kind === "malformed" || undefined}
            aria-describedby={answer?.kind === "malformed" ? `${inputId}-error` : undefined}
            className="h-11 w-32 rounded-(--r-sm) border border-control-border bg-control-bg px-3 text-base text-ink-1 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 aria-[invalid=true]:border-state-danger-ink"
          />
        </div>
        <button type="submit" className="h-11 rounded-(--r-sm) bg-brand px-5 text-sm font-medium text-brand-ink hover:bg-brand-hover">
          Check
        </button>
      </form>

      <div ref={resultRef} aria-live="polite" className="mt-4">
        {answer && <AnswerView answer={answer} inputId={inputId} />}
      </div>
    </section>
  );
}

function AnswerView({ answer, inputId }: { answer: Answer; inputId: string }) {
  if (answer.kind === "malformed") {
    return (
      <p id={`${inputId}-error`} className="flex items-center gap-2 text-sm text-state-danger-ink">
        <XCircle size={15} aria-hidden="true" /> Enter a five-digit ZIP code.
      </p>
    );
  }
  if (answer.kind === "unavailable") {
    return (
      <Notice tone="warning" title="We cannot confirm delivery online right now">
        Will-call pickup at {SITE.address.city} is always available. Call {SITE.phone} and the counter will confirm delivery to your
        site.
      </Notice>
    );
  }
  if (answer.kind === "unknown") {
    return (
      <Notice
        tone="info"
        title={`We cannot confirm delivery to ${answer.zip} online`}
        action={
          <Link href="/contact?topic=delivery" className="inline-flex min-h-11 items-center text-sm font-medium text-ink-1 underline underline-offset-4">
            Ask about freight to {answer.zip}
          </Link>
        }
      >
        Outside California we quote freight and tax by hand before anything is charged.
      </Notice>
    );
  }
  const delivery = answer.methods.find((method) => method.method === "local_delivery")!;
  return (
    <div>
      <p className="flex items-start gap-2 text-base font-medium text-ink-1">
        {answer.kind === "eligible" ? (
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
        ) : (
          <MapPin size={18} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
        )}
        <span>
          {answer.kind === "eligible"
            ? `Yes -- ${answer.zip} (${answer.area}) is on a Newark delivery route.`
            : `${answer.zip} is outside our delivery routes. Pickup and freight are available.`}
        </span>
      </p>
      {answer.orderBy && answer.kind === "eligible" && delivery.earliest && (
        <p className="mt-1 pl-[26px] text-sm text-ink-2">
          Order by {answer.orderBy.cutoff} {answer.orderBy.dayLabel} for delivery {delivery.earliest}.
        </p>
      )}
      <ul className="mt-4 divide-y divide-line rounded-(--r-sm) border border-line">
        {answer.methods.map((method) => (
          <li key={method.method} className={`flex items-start gap-3 px-4 py-3 ${method.available ? "" : "text-ink-3"}`}>
            <span className="mt-0.5 shrink-0">{METHOD_ICON[method.method]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-1">
                {method.label}
                <span className="sr-only">{method.available ? ", available" : ", not available"}</span>
              </p>
              <p className="text-sm text-ink-2">{method.detail}</p>
            </div>
            <p className="shrink-0 text-right text-sm">
              {!method.available ? (
                <span className="text-ink-3">Not available</span>
              ) : method.earliest ? (
                <span className="font-medium text-ink-1">Earliest {method.earliest}</span>
              ) : (
                <span className="text-ink-2">Date quoted</span>
              )}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-2">
        Delivery fee:{" "}
        {answer.fee.status === "free"
          ? "none for this ZIP."
          : answer.fee.status === "amount"
            ? `$${answer.fee.amount}${answer.fee.freeOver ? `, free on orders over $${answer.fee.freeOver.toLocaleString()}` : ""}.`
            : "shown on your order before you pay."}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/products" className="inline-flex min-h-11 items-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink hover:bg-brand-hover">
          Shop products
        </Link>
        <Link href="/contact?topic=delivery" className="inline-flex min-h-11 items-center rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-sm font-medium text-ink-1 hover:bg-surface-2">
          Ask about a delivery
        </Link>
      </div>
      <p className="mt-3 text-meta text-ink-3">
        Times are Pacific and skip weekends and branch holidays. Fulfillment policy {answer.policyVersion}
        {answer.confirmed ? "" : " -- confirmed with your order"}.
      </p>
    </div>
  );
}
