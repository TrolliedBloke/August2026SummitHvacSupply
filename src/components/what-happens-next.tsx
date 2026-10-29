import { Phone } from "lucide-react";
import { SITE } from "@/lib/site";

/**
 * The one "what happens next" panel for request flows (quote, contact,
 * homeowner, dealer). Reassurance lives here, beside or below the form, in a
 * few numbered lines instead of a hero image and paragraphs before the first
 * field. The phone fallback is a quiet secondary link: it must never compete
 * with the form's own submit button.
 *
 * Steps must not promise response times, fees or outcomes that operations has
 * not approved (docs/DESIGN-REMEDIATION-STATUS.md); pass the approved wording.
 */
export function WhatHappensNext({
  steps,
  phoneLabel = "Time-sensitive? Call the counter",
  showPhone = true,
  className = "",
}: {
  steps: string[];
  phoneLabel?: string;
  /** Off where the page already shows the phone number beside the panel. */
  showPhone?: boolean;
  className?: string;
}) {
  return (
    <section aria-labelledby="what-happens-next" className={`rounded-(--r-md) border border-line bg-surface-1 p-5 ${className}`} data-what-happens-next>
      <h2 id="what-happens-next" className="text-item font-semibold text-ink-1">
        What happens next
      </h2>
      <ol className="mt-3 space-y-2.5 text-sm leading-6 text-ink-2">
        {steps.map((step, index) => (
          <li key={step} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
            <span className="tnum grid size-6 place-items-center rounded-full bg-surface-2 text-xs font-medium text-ink-1" aria-hidden="true">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {showPhone && (
        <a href={SITE.phoneHref} className="group mt-4 flex min-h-11 items-start gap-2 border-t border-line pt-3 text-sm text-ink-2">
          <Phone size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-3" />
          <span>
            {phoneLabel}
            <span className="tnum block font-semibold text-ink-1 underline-offset-4 group-hover:underline">{SITE.phone}</span>
          </span>
        </a>
      )}
    </section>
  );
}
