import { ArrowRight, UserRound } from "lucide-react";
import { LinkButton } from "@/components/ui";

/* Second card in the landing rail. Gated trade pricing is the one thing a
   contractor is looking for on first visit, so it sits above the fold beside
   the branch card rather than inside the nav. */
export function TradePricingCard() {
  return (
    <article className="rounded-(--r-md) border border-line bg-surface-1 p-3.5">
      <div className="flex items-start gap-3">
        <UserRound size={26} strokeWidth={1.4} className="mt-0.5 shrink-0 text-ink-1" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="counter-heading text-[1.35rem] leading-none text-ink-1">Trade pricing</h2>
          <p className="mt-2 text-sm leading-5 text-ink-2">
            Sign in to see your net price. New accounts are reviewed by staff.
          </p>
        </div>
      </div>
      <LinkButton href="/dealers" variant="secondary" className="mt-3 h-10 w-full" data-conversion-hook="trade-account-apply">
        Apply for a trade account
        <ArrowRight size={15} />
      </LinkButton>
    </article>
  );
}
