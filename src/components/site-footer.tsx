import Image from "next/image";
import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { SITE } from "@/lib/site";
import { CATALOG_CATEGORIES } from "@/lib/storefront/catalog";

const PRODUCT_CATEGORIES = CATALOG_CATEGORIES.filter(
  (category) => category.value !== "central-systems"
);

const RESOURCE_LINKS = [
  { href: "/resources", label: "Resource center" },
  { href: "/homeowners", label: "For homeowners" },
  { href: "/dealers", label: "For contractors" },
  { href: "/tools/model-number-decoder", label: "Model decoder" },
  { href: "/guides/bay-area-hvac-permits", label: "Permit guide" },
  { href: "/portal/login", label: "Account portal" },
] as const;

const COMPANY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/locations/newark", label: "Newark location" },
  { href: "/returns", label: "Returns & Refunds" },
  { href: "/shipping", label: "Shipping & Delivery" },
  { href: "/resources", label: "Warranty & FAQ" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-[var(--ink-panel)] text-white">
      <div className="mx-auto w-full max-w-[var(--nav-max)] px-5 py-12 sm:px-6 sm:py-14 lg:px-[var(--counter-pad)]">
        <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(280px,1.45fr)_repeat(3,minmax(0,.8fr))_minmax(190px,1fr)]">
          <section aria-labelledby="footer-company-heading" className="max-w-md">
            <div className="flex items-center gap-3">
              <Image
                src="/summit-mark-white.svg"
                alt=""
                width={48}
                height={36}
                sizes="48px"
                className="h-9 w-12 object-contain"
              />
              <h2 id="footer-company-heading" className="text-base font-semibold text-white">
                Summit HVAC Supply
              </h2>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/65">
              Bay Area HVAC supply from Newark. Equipment only; installation by qualified local contractors.
            </p>
            <address className="mt-4 flex flex-col gap-1 not-italic text-sm text-white/65">
              <ContactRow icon={<MapPin size={16} strokeWidth={1.75} />}>
                {SITE.address.full}
              </ContactRow>
              <ContactLink href={SITE.phoneHref} icon={<Phone size={16} strokeWidth={1.75} />}>
                {SITE.phone}
              </ContactLink>
              <ContactLink href={SITE.emailHref} icon={<Mail size={16} strokeWidth={1.75} />}>
                {SITE.email}
              </ContactLink>
              <ContactRow icon={<Clock size={16} strokeWidth={1.75} />}>
                {SITE.counterHours}
              </ContactRow>
            </address>
          </section>

          <FooterNav title="Products">
            {PRODUCT_CATEGORIES.map((category) => (
              <FooterLink key={category.value} href={`/products?category=${category.value}`}>
                {category.label}
              </FooterLink>
            ))}
          </FooterNav>

          <FooterNav title="Resources">
            {RESOURCE_LINKS.map((item) => (
              <FooterLink key={item.href} href={item.href}>
                {item.label}
              </FooterLink>
            ))}
          </FooterNav>

          <FooterNav title="Company & policies">
            {COMPANY_LINKS.map((item) => (
              <FooterLink key={`${item.href}-${item.label}`} href={item.href}>
                {item.label}
              </FooterLink>
            ))}
          </FooterNav>

          <section aria-labelledby="footer-start-heading">
            <h2 id="footer-start-heading" className="text-sm font-semibold text-white">
              Start here
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/65">
              Choose the right way to shop.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              <Link
                href="/dealers"
                className="flex h-11 w-full items-center justify-center rounded-(--r-sm) bg-brand px-4 text-center text-sm font-medium text-white transition-colors hover:bg-brand-hover"
              >
                Open contractor account
              </Link>
              <Link
                href="/homeowners"
                className="flex h-11 w-full items-center justify-center rounded-(--r-sm) border border-white/25 bg-transparent px-4 text-center text-sm font-medium text-white transition-colors hover:border-white/45 hover:bg-white/5"
              >
                Shop for your home
              </Link>
            </div>
          </section>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/15 pt-5 pr-14 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between sm:pr-12 lg:pr-14">
          <p>© 2026 Summit HVAC Supply</p>
          <p>Newark, California</p>
        </div>
      </div>
    </footer>
  );
}

function FooterNav({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={`${title} footer navigation`}>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-3 flex flex-col gap-0.5">{children}</ul>
    </nav>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-10 items-center text-sm leading-5 text-white/65 transition-colors hover:text-white lg:min-h-8"
      >
        {children}
      </Link>
    </li>
  );
}

function ContactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-start gap-2.5 py-1 leading-5">
      <span className="mt-0.5 shrink-0 text-white/75" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </div>
  );
}

function ContactLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="flex min-h-9 items-start gap-2.5 py-1 leading-5 transition-colors hover:text-white"
    >
      <span className="mt-0.5 shrink-0 text-white/75" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </a>
  );
}
