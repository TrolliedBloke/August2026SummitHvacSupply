import Link from "next/link";
import { CalendarClock, CreditCard, RotateCcw, ShieldCheck } from "lucide-react";
import { PURCHASE } from "@/lib/site";

/* Purchase-assurance rail — the four answers a buyer needs before committing
   to a four-figure order: financing, returns, guarantee, and delivery timing.
   Sits directly under the CTA on every buy box (series + SKU pages). */
export function BuyBoxAssurance({ price, className = "" }: { price?: number; className?: string }) {
  return (
    <div className={`rounded-(--r-md) border border-line bg-surface-2/60 ${className}`}>
      <ul className="divide-y divide-line text-sm">
        {/* No specific monthly figure. Under Regulation Z §1026.24(d) an
            advertised payment amount is a "triggering term" that obliges the
            ad to also state the APR, repayment terms, and any down payment --
            none of which appear here. The old copy was worse than incomplete:
            financingMonthly() is price/60 with no interest, so it understated
            the real payment by roughly 75% against the 9.99-24.99% APR in
            PURCHASE.financingDisclosure, a string that is currently shown only
            to the chatbot and never to a shopper. A general availability
            statement is not a triggering term. */}
        {price != null && price > 0 && (
          <AssuranceRow icon={<CreditCard size={16} />}>
            <span className="font-medium text-ink-1">Financing available</span>{" "}
            <span className="text-ink-2">
              — on approved credit. Ask the counter for current terms.
            </span>
          </AssuranceRow>
        )}
        {/* Each claim links to the page that states its exceptions. An
            assurance the buyer cannot verify is just a marketing line; the
            restocking fee and the freight-damage inspection window live one
            click away, and hiding them until after purchase is what generates
            disputes. */}
        <AssuranceRow icon={<RotateCcw size={16} />}>
          <Link href="/returns" className="font-medium text-ink-1 underline underline-offset-4">
            {PURCHASE.returns}
          </Link>
        </AssuranceRow>
        <AssuranceRow icon={<ShieldCheck size={16} />}>
          <span className="font-medium text-ink-1">{PURCHASE.guarantee}</span>{" "}
          <span className="text-ink-2">— wrong or damaged units replaced free</span>
        </AssuranceRow>
        <AssuranceRow icon={<CalendarClock size={16} />}>
          <Link href="/shipping" className="text-ink-2 underline underline-offset-4">
            {PURCHASE.delivery}
          </Link>
        </AssuranceRow>
      </ul>
    </div>
  );
}

function AssuranceRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="shrink-0 text-brand">{icon}</span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}
