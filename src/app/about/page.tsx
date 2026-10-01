import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Boxes, Clock, Mail, MapPin, Navigation, Phone, Truck } from "lucide-react";
import { Container, Eyebrow, LinkButton } from "@/components/ui";
import { BranchStatusText } from "@/components/branch-status";
import { ResilientImage } from "@/components/resilient-image";
import { TestimonialSlot } from "@/components/testimonial-slot";
import { ABOUT_CONTRACTOR_TESTIMONIALS, ABOUT_HOMEOWNER_TESTIMONIALS } from "@/lib/testimonials";
import { ABOUT_CONTENT } from "@/content/about";
import { catalogCategoryDestinations, getStorefrontSkus } from "@/lib/storefront/catalog";
import { directionsHref, NEWARK } from "@/lib/branch";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About - Bay Area HVAC Equipment Supply in Newark, CA",
  description:
    "Summit HVAC Supply provides HVAC equipment quote support, homeowner guidance, installer referral, and contractor supply from Newark, CA.",
  alternates: { canonical: "/about" },
};

const CAPABILITY_LABEL: Record<string, string> = {
  will_call: "Will-call pickup",
  local_delivery: "Bay Area route delivery",
  freight: "Freight",
};

/**
 * About: verifiable evidence first, story second. Every proof point is read
 * from its source -- the catalog, the Branch entity, its fulfillment
 * capabilities -- so none can drift from what the rest of the site says.
 * Editorial claims live in src/content/about.ts with an owner and review date.
 */
export default function AboutPage() {
  const skus = getStorefrontSkus();
  const brands = new Set(skus.map((sku) => sku.brand).filter((brand) => brand !== "Unbranded"));
  const categories = catalogCategoryDestinations().filter((category) => category.status === "available");
  const verifiedMedia = skus.filter((sku) => sku.imageExactModel).length;
  const documented = skus.filter((sku) => sku.documents.some((document) => document.modelCoverageVerified)).length;
  const methods = NEWARK.capabilities.map((capability) => CAPABILITY_LABEL[capability]).filter(Boolean);

  return (
    <>
      <section className="border-b border-line bg-surface-1">
        <Container className="grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
          <div className="min-w-0">
            <Eyebrow>{ABOUT_CONTENT.eyebrow}</Eyebrow>
            <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">{ABOUT_CONTENT.heading}</h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">{ABOUT_CONTENT.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/locations/newark">
                <MapPin size={17} aria-hidden="true" />
                Visit the Newark branch
              </LinkButton>
              <LinkButton href="/contact" variant="secondary">
                Contact us
              </LinkButton>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-(--r-lg) border border-line bg-surface-2">
            <ResilientImage
              src={ABOUT_CONTENT.heroImage.src}
              alt={ABOUT_CONTENT.heroImage.alt}
              fill
              preload
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </Container>
      </section>

      {/* Operational proof, immediately after the hero. */}
      <section aria-labelledby="about-proof" className="border-b border-line bg-canvas">
        <Container className="py-10">
          <h2 id="about-proof" className="text-xl font-semibold tracking-tight text-ink-1">
            {ABOUT_CONTENT.proofHeading}
          </h2>
          <dl className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Proof icon={<Boxes size={20} />} label="Live catalog" action={{ href: "/products", label: "Browse the catalog" }}>
              {skus.length} products across {categories.length} categories from {brands.size} brands
            </Proof>
            <Proof icon={<Clock size={20} />} label="Newark branch" action={{ href: "/locations/newark", label: "Hours and closures" }}>
              <BranchStatusText withDot />
            </Proof>
            <Proof icon={<Truck size={20} />} label="Fulfillment" action={{ href: "/delivery", label: "Check your ZIP" }}>
              {methods.join(", ")}
            </Proof>
            <Proof icon={<BadgeCheck size={20} />} label="Verified documentation" action={{ href: "/resources", label: "See documents" }}>
              {verifiedMedia} products with exact-model media; {documented} with model-verified documents
            </Proof>
          </dl>
        </Container>
      </section>

      <Container className="py-14">
        <h2 className="text-xl font-semibold tracking-tight text-ink-1">{ABOUT_CONTENT.storyHeading}</h2>
        <div className="mt-6 grid gap-10 md:grid-cols-3">
          {ABOUT_CONTENT.claims.map((claim) => (
            <div key={claim.id} className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-ink-1">{claim.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{claim.body}</p>
              {process.env.NODE_ENV !== "production" && (
                <p className="mt-2 text-xs text-ink-3">
                  Dev only: owner {claim.owner}, reviewed {claim.reviewedAt}
                </p>
              )}
            </div>
          ))}
        </div>
      </Container>

      <section className="border-y border-line bg-surface-1 py-14">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-1">Visit or reach us</h2>
            <dl className="mt-5 space-y-4 text-base">
              <NapRow icon={<MapPin size={18} />} label="Warehouse & will-call">
                {SITE.address.full}
              </NapRow>
              <NapRow icon={<Phone size={18} />} label="Phone">
                <a href={SITE.phoneHref} className="text-brand hover:text-brand-hover">
                  {SITE.phone}
                </a>
              </NapRow>
              <NapRow icon={<Mail size={18} />} label="Email">
                <a href={SITE.emailHref} className="break-all text-brand hover:text-brand-hover">
                  {SITE.email}
                </a>
              </NapRow>
              <NapRow icon={<Clock size={18} />} label="Hours">
                {SITE.counterHours}
                <BranchStatusText withDot className="mt-0.5 text-sm text-ink-2" />
              </NapRow>
            </dl>
          </div>
          <div className="flex flex-col justify-between gap-6 rounded-(--r-lg) border border-line bg-surface-2 p-6">
            <div>
              <p className="text-lg font-semibold text-ink-1">
                {SITE.address.city}, {SITE.address.state}
              </p>
              <p className="mt-1 text-sm text-ink-2">{methods.join(" · ")}</p>
            </div>
            <a
              href={directionsHref(NEWARK)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-sm font-medium text-ink-1 hover:bg-surface-2"
            >
              <Navigation size={16} aria-hidden="true" />
              Directions<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </Container>
      </section>

      {/* Testimonials collapse entirely when there is nothing consented to show. */}
      <Container className="flex flex-col gap-12 py-14 empty:hidden">
        <TestimonialSlot items={ABOUT_CONTRACTOR_TESTIMONIALS} heading="From contractors who buy here" />
        <TestimonialSlot items={ABOUT_HOMEOWNER_TESTIMONIALS} heading="From homeowners we've supplied" />
      </Container>
    </>
  );
}

function Proof({
  icon,
  label,
  action,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  action: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-2 text-sm font-medium text-ink-1">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1.5 text-sm leading-6 text-ink-2">
        {children}
        <Link href={action.href} className="mt-1 block font-medium text-ink-1 underline underline-offset-4">
          {action.label}
        </Link>
      </dd>
    </div>
  );
}

function NapRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="relative min-w-0 pl-12">
      <dt className="text-xs text-ink-3">
        <span className="absolute left-0 top-0 grid size-9 place-items-center rounded-(--r-sm) bg-surface-2 text-ink-3" aria-hidden="true">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-0.5 text-ink-1">{children}</dd>
    </div>
  );
}
