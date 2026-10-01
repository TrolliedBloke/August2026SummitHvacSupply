import Image from "next/image";
import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { SITE } from "@/lib/site";
import { CATEGORY_RAIL } from "@/lib/nav-links";

/* The same list as the header's category rail. */
const PRODUCT_CATEGORIES = CATEGORY_RAIL;

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
    <footer className="bg-[#093324] bg-[linear-gradient(180deg,#0a3425_0%,#082e20_100%)] text-white">
      <div className="mx-auto w-full max-w-[1538px] px-6 pt-8 pb-7 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
        <div className="footer-layout grid gap-y-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,.7fr)_minmax(0,.75fr)_minmax(0,.85fr)_minmax(13rem,1fr)] xl:gap-x-10 2xl:gap-x-12">
          <section aria-labelledby="footer-company-heading" className="max-w-md -translate-y-1">
            <div className="flex items-center gap-3">
              <Image
                src="/summit-mark-white.svg"
                alt=""
                width={48}
                height={36}
                sizes="48px"
                className="h-9 w-12 object-contain"
              />
              <h2 id="footer-company-heading" className="text-lg font-semibold text-white">
                Summit HVAC Supply
              </h2>
            </div>
            <p className="mt-3 max-w-[410px] text-base leading-[22px] text-white/90">
              Bay Area HVAC supply from Newark. Equipment only; installation by qualified local contractors.
            </p>
            <address className="mt-2 flex flex-col gap-0 not-italic text-base text-white/90">
              <ContactRow icon={<MapPin size={21} strokeWidth={1.75} />}>
                {SITE.address.full}
              </ContactRow>
              <ContactLink href={SITE.phoneHref} icon={<Phone size={21} strokeWidth={1.75} />}>
                {SITE.phone}
              </ContactLink>
              <ContactLink href={SITE.emailHref} icon={<Mail size={21} strokeWidth={1.75} />}>
                {SITE.email}
              </ContactLink>
              <ContactRow icon={<Clock size={21} strokeWidth={1.75} />}>
                {SITE.counterHours}
              </ContactRow>
            </address>
          </section>

          <div className="hidden md:block">
            <FooterNav title="Products">
              {PRODUCT_CATEGORIES.map((category) => (
                <FooterLink key={category.href} href={category.href}>
                  {category.label}
                </FooterLink>
              ))}
            </FooterNav>
          </div>

          <div className="hidden md:block"><FooterNav title="Resources">
            {RESOURCE_LINKS.map((item) => (
              <FooterLink key={item.href} href={item.href}>
                {item.label}
              </FooterLink>
            ))}
          </FooterNav></div>

          <div className="hidden md:block"><FooterNav title="Company & policies">
            {COMPANY_LINKS.map((item) => (
              <FooterLink key={`${item.href}-${item.label}`} href={item.href}>
                {item.label}
              </FooterLink>
            ))}
          </FooterNav></div>

          <div className="divide-y divide-white/20 border-y border-white/20 md:hidden">
            <FooterDisclosure title="Products">{PRODUCT_CATEGORIES.map((item) => <FooterLink key={item.href} href={item.href}>{item.label}</FooterLink>)}</FooterDisclosure>
            <FooterDisclosure title="Resources">{RESOURCE_LINKS.map((item) => <FooterLink key={item.href} href={item.href}>{item.label}</FooterLink>)}</FooterDisclosure>
            <FooterDisclosure title="Company & policies">{COMPANY_LINKS.map((item) => <FooterLink key={`${item.href}-${item.label}`} href={item.href}>{item.label}</FooterLink>)}</FooterDisclosure>
          </div>

          <section aria-label="Shopping paths" className="pt-4">
            <div className="flex flex-col gap-3.5">
              <Link
                href="/dealers"
                className="flex h-11 w-full items-center justify-center rounded-[6px] bg-[#f6f5f1] px-4 text-center text-[17px] font-semibold text-[#073322] transition-colors hover:bg-white"
              >
                Apply for a trade account
              </Link>
              <Link
                href="/homeowners"
                className="flex h-12 w-full items-center justify-center rounded-[6px] border-2 border-white/90 bg-transparent px-4 text-center text-[17px] font-semibold text-white transition-colors hover:bg-white/5"
              >
                Buying for your home
              </Link>
            </div>
          </section>
        </div>

      </div>
    </footer>
  );
}

function FooterDisclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="group"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-semibold marker:content-none">{title}<span aria-hidden="true" className="text-xl font-normal transition-transform group-open:rotate-45">+</span></summary><ul className="flex flex-col pb-4">{children}</ul></details>;
}

function FooterNav({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={`${title} footer navigation`}>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <ul className="mt-3 flex flex-col">{children}</ul>
    </nav>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-6 items-center text-base leading-6 text-white/90 transition-colors hover:text-white"
      >
        {children}
      </Link>
    </li>
  );
}

function ContactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-start gap-3 py-1 leading-6">
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
      className="flex min-h-8 items-start gap-3 py-1 leading-6 transition-colors hover:text-white"
    >
      <span className="mt-0.5 shrink-0 text-white/75" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </a>
  );
}
