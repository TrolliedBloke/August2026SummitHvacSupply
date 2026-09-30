import Image from "next/image";
import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { SITE } from "@/lib/site";

const PRODUCT_CATEGORIES = [
  { href: "/products?category=mini-splits", label: "Mini splits" },
  { href: "/products?q=condenser", label: "Condensers" },
  { href: "/products?category=furnaces", label: "Furnaces" },
  { href: "/products?category=air-handlers", label: "Air handlers" },
  { href: "/products?category=evaporator-coils", label: "Coils" },
  { href: "/products?category=line-sets", label: "Line sets" },
  { href: "/products?refrigerant=R-454B", label: "Refrigerant" },
  { href: "/products?category=controls", label: "Thermostats" },
] as const;

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
      <div className="mx-auto w-full max-w-[1538px] pt-[26px] pb-5 max-[1577px]:px-5">
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(390px,1.55fr)_minmax(150px,.72fr)_minmax(180px,.72fr)_minmax(210px,.82fr)_330px]">
          <section aria-labelledby="footer-company-heading" className="max-w-md -translate-y-1.5">
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
            <p className="mt-3 max-w-[410px] text-[15px] leading-[22px] text-white/90">
              Bay Area HVAC supply from Newark. Equipment only; installation by qualified local contractors.
            </p>
            <address className="mt-2 flex flex-col gap-0 not-italic text-[15px] text-white/90">
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

          <FooterNav title="Products">
            {PRODUCT_CATEGORIES.map((category) => (
              <FooterLink key={category.href} href={category.href}>
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

          <section aria-label="Shopping paths" className="pt-4 xl:translate-x-[21px]">
            <div className="flex flex-col gap-3.5">
              <Link
                href="/dealers"
                className="flex h-11 w-full items-center justify-center rounded-[6px] bg-[#f6f5f1] px-4 text-center text-base font-semibold text-[#073322] transition-colors hover:bg-white"
              >
                Apply for a trade account
              </Link>
              <Link
                href="/homeowners"
                className="flex h-12 w-full items-center justify-center rounded-[6px] border-2 border-white/90 bg-transparent px-4 text-center text-base font-semibold text-white transition-colors hover:bg-white/5"
              >
                Shop as homeowner
              </Link>
            </div>
          </section>
        </div>

      </div>
    </footer>
  );
}

function FooterNav({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={`${title} footer navigation`}>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <ul className="mt-2 flex flex-col">{children}</ul>
    </nav>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-6 items-center text-[15px] leading-6 text-white/90 transition-colors hover:text-white"
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
