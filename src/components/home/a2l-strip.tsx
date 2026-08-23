import Link from "next/link";
import { ArrowRight, Headphones, House, ShieldCheck } from "lucide-react";
import { SITE } from "@/lib/site";

/* A2L is the live question in Bay Area HVAC right now: the refrigerant
   transition decides which condensers a contractor is allowed to install. The
   chips are real catalog filters, not decoration. */
const FILTERS = [
  { label: "A2L rated", href: "/products?refrigerant=R-454B" },
  { label: "R-454B", href: "/products?refrigerant=R-454B" },
  { label: "R-32", href: "/products?refrigerant=R-32" },
];

export function A2lStrip() {
  return (
    <section className="bg-canvas py-6">
      <CounterWidth>
        <div className="rounded-(--r-md) bg-band p-5 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div className="flex items-start gap-4">
            <ShieldCheck size={32} strokeWidth={1.4} className="mt-0.5 shrink-0 text-ink-1" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="counter-heading text-[1.35rem] leading-none text-ink-1">
                A2L-ready parts &amp; equipment
              </h2>
              <p className="mt-2 max-w-[52ch] text-sm leading-6 text-ink-2">
                Find components rated for R-454B and R-32 systems, with the refrigerant
                class labeled on every product record.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2.5 lg:mt-0">
            {FILTERS.map((filter) => (
              <Link
                key={filter.label}
                href={filter.href}
                className="rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 py-2.5 text-sm text-ink-1 transition-colors duration-150 hover:border-ink-4"
              >
                {filter.label}
              </Link>
            ))}
            <Link
              href="/products?refrigerant=R-454B"
              className="inline-flex items-center gap-2 rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 py-2.5 text-sm font-medium text-ink-1 transition-colors duration-150 hover:border-ink-4"
            >
              Shop A2L-ready
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/guides/r-32-r-454b-a2l-transition"
              className="text-sm text-ink-1 underline underline-offset-4"
            >
              Read the refrigerant guide
            </Link>
          </div>
        </div>
      </CounterWidth>
    </section>
  );
}

/* The two questions people call the counter to ask, answered where they are
   already looking rather than on a contact page. */
export function HelpStrip() {
  return (
    <section className="bg-canvas pb-8">
      <CounterWidth>
        <div className="grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <p className="flex items-center gap-3 text-[0.95rem] text-ink-1">
            <House size={26} strokeWidth={1.4} className="shrink-0" aria-hidden="true" />
            Replacing a home system?
            <Link href="/homeowners#homeowner-request" className="inline-flex items-center gap-1.5 font-medium underline underline-offset-4">
              Start system selector
              <ArrowRight size={14} />
            </Link>
          </p>
          <p className="flex items-center gap-3 text-[0.95rem] text-ink-1 sm:justify-end">
            <Headphones size={26} strokeWidth={1.4} className="shrink-0" aria-hidden="true" />
            Need help verifying a match?
            <a href={SITE.phoneHref} className="part-number font-medium underline underline-offset-4">
              {SITE.phone}
            </a>
          </p>
        </div>
      </CounterWidth>
    </section>
  );
}

function CounterWidth({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 w-auto max-w-[var(--counter-max)] px-0 sm:mx-auto sm:w-full sm:px-6 lg:px-[var(--counter-pad)]">
      {children}
    </div>
  );
}
