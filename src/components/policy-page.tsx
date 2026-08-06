import Link from "next/link";
import { Container, Eyebrow } from "@/components/ui";
import { SITE } from "@/lib/site";

/* Shared shell for the policy pages (returns, shipping, privacy, terms).
   One layout so the legal surfaces stay visually consistent and a change to
   the contact block or review banner lands everywhere at once. */

export function PolicyPage({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <section className="border-b border-line bg-surface-1">
        <Container className="py-12 lg:py-16">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{intro}</p>
          <p className="mt-6 text-sm text-ink-2">Last updated {updated}</p>
        </Container>
      </section>

      <Container className="py-10 lg:py-14">
        <div className="max-w-3xl">
          {/* The "not yet reviewed by counsel" notice is for the team, not the
              customer, and it is deliberately dev-only. Shown publicly it did
              two harmful things at once: it undercut the reader at the exact
              moment they were deciding whether to trust a $2,400 purchase, and
              it arguably weakened the very terms it sat above -- a limitation
              of liability or a 15% restocking fee is harder to enforce against
              someone the page told not to rely on it. Tracking review status
              belongs in the repo, not the viewport. */}
          {process.env.NODE_ENV !== "production" && (
            <div className="rounded-(--r-md) border border-copper/40 bg-copper-tint px-4 py-3 text-sm leading-relaxed text-ink-2">
              <strong className="font-medium text-ink-1">
                Dev-only notice — not shown to customers.
              </strong>{" "}
              This policy follows common HVAC-distribution practice and has not
              yet been reviewed by counsel. Get sign-off before launch.
            </div>
          )}

          <div className="flex flex-col gap-8">{children}</div>

          <div className="mt-10 rounded-(--r-md) border border-line bg-surface-2/60 px-5 py-4 text-sm leading-relaxed text-ink-2">
            <p className="font-medium text-ink-1">Questions about this policy?</p>
            <p className="mt-1">
              Call{" "}
              <a href={SITE.phoneHref} className="text-ink-1 underline underline-offset-4">
                {SITE.phone}
              </a>{" "}
              or email{" "}
              <a href={SITE.emailHref} className="text-ink-1 underline underline-offset-4">
                {SITE.email}
              </a>
              . {SITE.hours.split("·")[0].trim()}.
            </p>
            <p className="mt-2 text-ink-2">{SITE.address.full}</p>
          </div>
        </div>
      </Container>
    </>
  );
}

export function PolicySection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight text-ink-1">
        {heading}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-base leading-relaxed text-ink-2">
        {children}
      </div>
    </section>
  );
}

export function PolicyList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-ink-3">
      {items.map((item, index) => (
        <li key={index} className="leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function PolicyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-ink-1 underline underline-offset-4">
      {children}
    </Link>
  );
}
