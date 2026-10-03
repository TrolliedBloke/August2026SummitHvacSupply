import Link from "next/link";
import { ArrowRight, HardHat, UserRound } from "lucide-react";

/**
 * Two doors, each named for where it goes.
 *
 * This replaced a "Show prices as: contractor / homeowner" radio group that
 * held page-local state and changed nothing -- it looked like a pricing mode
 * while every price on the page stayed retail. Account pricing has exactly one
 * source, the signed-in account (see lib/commerce/price-presentation.ts), so a
 * visitor cannot opt into a price state that checkout would later contradict.
 *
 * Each link is named by its title alone (aria-labelledby). The secondary line
 * is a description, so it can change without changing what a screen reader
 * calls the control.
 */
const PATHS = [
  {
    id: "shop-retail",
    href: "/products",
    title: "Shop retail",
    note: "Listed prices, no account needed",
    Icon: UserRound,
    hook: "audience-retail",
  },
  {
    id: "contractor-sign-in",
    href: "/portal/login?next=/products",
    title: "Contractor sign in",
    note: "Approved accounts see account pricing",
    Icon: HardHat,
    hook: "audience-contractor",
  },
] as const;

export function AudiencePaths() {
  return (
    <nav aria-label="How do you want to shop" className="mt-8 max-w-[835px]">
      <ul className="grid overflow-hidden rounded-(--r-sm) border border-brand sm:grid-cols-2">
        {PATHS.map(({ id, href, title, note, Icon, hook }, index) => (
          <li key={id} className={index === 0 ? "border-b border-brand sm:border-b-0 sm:border-r" : undefined}>
            <Link
              href={href}
              aria-labelledby={`${id}-title`}
              aria-describedby={`${id}-note`}
              data-conversion-hook={hook}
              className="group flex min-h-15 items-center gap-4 py-3 pl-5 pr-4 transition-colors duration-120 hover:bg-brand-tint focus-visible:bg-brand-tint focus-visible:outline-offset-[-2px]"
            >
              <Icon size={24} strokeWidth={1.6} className="shrink-0 text-ink-1" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span id={`${id}-title`} className="block text-item font-medium text-ink-1">
                  {title}
                </span>
                <span id={`${id}-note`} className="mt-0.5 block text-meta text-ink-3">
                  {note}
                </span>
              </span>
              <ArrowRight
                size={16}
                strokeWidth={1.8}
                className="shrink-0 text-ink-1 transition-transform duration-120 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-meta text-ink-3">
        Not sure what you need?{" "}
        <Link
          href="/finder"
          className="font-medium text-ink-1 underline underline-offset-4 transition-colors duration-120 hover:text-brand"
          data-conversion-hook="audience-finder"
        >
          Find your system
        </Link>
        {" · "}New trade customer?{" "}
        <Link
          href="/dealers"
          className="font-medium text-ink-1 underline underline-offset-4 transition-colors duration-120 hover:text-brand"
          data-conversion-hook="audience-apply"
        >
          Apply for an account
        </Link>
      </p>
    </nav>
  );
}
