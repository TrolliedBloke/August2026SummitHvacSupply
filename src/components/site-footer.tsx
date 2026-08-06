import Link from "next/link";
import Image from "next/image";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { SITE } from "@/lib/site";
import { SERIES } from "@/lib/products";

export function SiteFooter() {
  return (
    <footer className="bg-[var(--ink-panel)] text-brand-ink">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-7 sm:px-6 lg:px-8">
        <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-[1.15fr_.85fr_.85fr_.85fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <Image src="/logo-summit.svg" alt="" width={34} height={34} sizes="34px" className="size-8 object-contain" />
              <span className="text-base font-medium text-brand-ink">
                Summit HVAC Supply
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-6 text-brand-ink/75">
              Bay Area HVAC supply from Newark. Equipment only; installation is handled by qualified local contractors.
            </p>
            <dl className="mt-5 space-y-2.5 text-sm">
              <div className="flex items-start gap-2.5 text-brand-ink/75">
                <MapPin size={16} className="mt-0.5 shrink-0" />
                <span>{SITE.address.full}</span>
              </div>
              <a href={SITE.phoneHref} className="flex min-h-11 items-center gap-2.5 text-brand-ink/75 hover:text-brand-ink">
                <Phone size={16} className="shrink-0" />
                {SITE.phone}
              </a>
              <a href={SITE.emailHref} className="flex min-h-11 items-center gap-2.5 text-brand-ink/75 hover:text-brand-ink">
                <Mail size={16} className="shrink-0" />
                {SITE.email}
              </a>
              <div className="flex items-start gap-2.5 text-brand-ink/75">
                <Clock size={16} className="mt-0.5 shrink-0" />
                <span>{SITE.hours}</span>
              </div>
            </dl>
          </div>

          <FooterCol title="Products">
            {SERIES.map((s) => (
              <FooterLink key={s.slug} href={`/products/${s.slug}`}>
                {s.name}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="Company">
            <FooterLink href="/about">About</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
            <FooterLink href="/resources">Resources</FooterLink>
            <FooterLink href="/homeowners">For Homeowners</FooterLink>
            <FooterLink href="/dealers">For Contractors</FooterLink>
            <FooterLink href="/portal/login">Account Portal</FooterLink>
            <FooterLink href="/locations/newark">Newark location</FooterLink>
          </FooterCol>

          <FooterCol title="Policies">
            <FooterLink href="/returns">Returns & Refunds</FooterLink>
            <FooterLink href="/shipping">Shipping & Delivery</FooterLink>
            <FooterLink href="/resources">Warranty & FAQ</FooterLink>
            <FooterLink href="/privacy">Privacy Policy</FooterLink>
            <FooterLink href="/terms">Terms of Service</FooterLink>
            <FooterLink href="/tools/model-number-decoder">Model decoder</FooterLink>
            <FooterLink href="/guides/bay-area-hvac-permits">Permit guide</FooterLink>
          </FooterCol>

          <div>
            <h3 className="text-sm font-medium text-brand-ink">
              Start here
            </h3>
            <div className="mt-4 flex flex-col gap-2.5">
              <Link
                href="/homeowners"
                className="flex h-11 items-center justify-center rounded-(--r-sm) bg-surface-1 text-sm font-medium text-ink-1 transition-opacity hover:opacity-90"
              >
                Buying one for your home
              </Link>
              <Link
                href="/dealers"
                className="flex h-11 items-center justify-center rounded-(--r-sm) border border-brand-ink/30 text-sm font-medium text-brand-ink transition-colors"
              >
                Open contractor account
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-2 border-t border-brand-ink/20 pt-5 text-xs text-brand-ink/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Summit HVAC Supply. Bay Area TCL HVAC supply from Newark, CA.</p>
          <p className="text-white/70">
            Equipment supply only. Installation is handled by qualified local contractors.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-brand-ink">
        {title}
      </h3>
      <ul className="mt-4 flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex min-h-11 items-center text-sm text-white/65 transition-colors hover:text-white">
        {children}
      </Link>
    </li>
  );
}
