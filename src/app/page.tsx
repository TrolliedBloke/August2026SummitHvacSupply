import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  HardHat,
  Store,
  Truck,
  UserRound,
} from "lucide-react";
import { LinkButton } from "@/components/ui";
import { CounterPanel } from "@/components/home/counter-panel";
import { CounterStock } from "@/components/home/counter-stock";
import { FulfillmentCard } from "@/components/home/fulfillment-card";
import { A2lStrip, HelpStrip } from "@/components/home/a2l-strip";
import { getCategoryHeroImage, type CatalogCategory } from "@/lib/storefront/catalog";
import { SITE } from "@/lib/site";

// The counter strip shows live QuickBooks counts, so the prerendered homepage
// needs a short revalidation window to pick them up. Everything else on the
// page is static copy.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Bay area HVAC supply, parts, heat pumps, and pickup | Summit HVAC Supply",
  description:
    "Search TCL, Tosot, Carrier, mini-split, central HVAC, furnace, cassette, and installation supply SKUs from Summit HVAC Supply.",
  alternates: { canonical: "/" },
};

/* `image` is the fallback only. Each tile prefers a verified product photo from
   its own category (see getCategoryHeroImage) and drops to the sketch when the
   category has no exact-model imagery yet -- currently line sets and controls. */
const categories = [
  { title: "Mini splits", body: "Indoor, outdoor, and multi-zone units", category: "mini-splits", image: "/site/sketches/ductless.png" },
  { title: "Central heat pumps", body: "TCL, Tosot, and Carrier equipment", category: "central-heat-pumps", image: "/site/sketches/heat-pump.png" },
  { title: "Air handlers", body: "2- through 5-ton air handlers", category: "air-handlers", image: "/site/sketches/air-conditioner.png" },
  { title: "Evaporator coils", body: "Carrier central-system coils", category: "evaporator-coils", image: "/site/sketches/indoor-air-quality.png" },
  { title: "Furnaces", body: "Carrier furnace equipment", category: "furnaces", image: "/site/sketches/furnace.png" },
  { title: "Cassettes", body: "Cassette units, panels, and controls", category: "cassettes", image: "/site/sketches/thermostat-controls.png" },
  { title: "Line sets", body: "Copper line sets by connection size", category: "line-sets", image: "/site/sketches/line-set.png" },
  { title: "Installation supplies", body: "Pads, covers, fittings, wire, and conduit", category: "installation-supplies", image: "/site/sketches/installation-supplies.png" },
] as const;

const branches = [
  {
    name: "Newark",
    stock: "Retail pickup and trade orders",
    address: SITE.address.full,
    note: "Will-call until 5:00pm",
  },
  {
    name: "Bay Area delivery",
    stock: "Local routes available",
    address: "San Jose, Oakland, Fremont, peninsula",
    note: "Ask before ordering",
  },
  {
    name: "Contractor pickup",
    stock: "Counter workflow ready",
    address: "Orders, documents, and job quotes",
    note: "Sign in for pro pricing",
  },
  {
    name: "Homeowner help",
    stock: "One-system buyers welcome",
    address: "Equipment guidance and installer referral",
    note: "No model number needed",
  },
];

/* The reason-to-buy row. Each icon is green, which is a deliberate departure
   from THEME.md ("nothing else is green") -- the flat ink row read as fine
   print rather than as a reason to trust the counter. Green stays off
   everything else here: the headings and body remain ink. */
const proof = [
  { title: "Newark pickup", body: "Will-call on confirmed stock", icon: <Store /> },
  { title: "Bay Area delivery", body: "Local routes from the branch", icon: <Truck /> },
  { title: "Exact models", body: "Specs sourced, never guessed", icon: <ClipboardCheck /> },
  { title: "Trade accounts", body: "Net pricing after staff review", icon: <BadgeCheck /> },
];

const compliance = [
  "Equipment supply only. Installation is handled by qualified local contractors.",
  "Installer confirms sizing, permits, labor, and final scope before equipment is ordered.",
  "AHRI, ENERGY STAR, ETL, and NEEP claims publish only after exact-model verification.",
];

export default function HomePage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Can I buy one HVAC system from Summit?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Summit helps homeowners buying one system and contractors buying for jobs.",
        },
      },
      {
        "@type": "Question",
        name: "Does Summit install HVAC equipment?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Summit supplies equipment. Installation is handled by qualified local contractors.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />

      <section className="bg-canvas">
        <FoldContainer className="pb-0 pt-5">
          <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)] lg:gap-8">
            <div className="min-w-0">
              <h1 className="counter-heading max-w-[760px] text-[2.1rem] leading-[1.02] text-ink-1 sm:text-[2.6rem]">
                HVAC equipment and parts,
                <br /> ready from Newark.
              </h1>
              <p className="mt-2 text-[0.98rem] leading-6 text-ink-1">
                Trade pricing for approved contractors. List pricing for homeowners.
              </p>
              <AudienceDoors />
            </div>

            <div className="min-w-0">
              <FulfillmentCard />
            </div>
          </div>
        </FoldContainer>
      </section>

      <CounterStock />

      <section className="bg-canvas pb-5 pt-0">
        <FoldContainer>
          <CounterPanel />
        </FoldContainer>
      </section>

      <section className="bg-canvas py-7">
        <CounterContainer>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-medium leading-tight text-ink-1">Shop by category</h2>
            <Link href="/products" className="hidden items-center gap-2 text-sm font-medium text-ink-1 md:inline-flex">
              View all categories
              <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((item) => (
              <CategoryCard key={item.title} {...item} />
            ))}
          </div>
        </CounterContainer>
      </section>

      <A2lStrip />

      <HelpStrip />

      <MobileBranchStrip />

      <BranchSection />

      <section className="bg-canvas py-9">
        <CounterContainer>
          <h2 className="counter-heading text-[1.25rem] leading-none text-ink-1">
            Why buy from Summit
          </h2>
          {/* Cards, not a bare row. The border is what turns four sentences into
              four reasons -- it gives each one a boundary the eye can land on,
              which a flat grid of text does not. */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {proof.map((item) => (
              <div
                key={item.title}
                className="rounded-(--r-md) border border-line bg-surface-1 p-5"
              >
                <span className="grid size-8 place-items-center text-brand [&_svg]:size-7 [&_svg]:stroke-[1.5]">
                  {item.icon}
                </span>
                <p className="mt-3.5 text-[0.95rem] font-medium text-ink-1">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-ink-2">{item.body}</p>
              </div>
            ))}
          </div>
        </CounterContainer>
      </section>

      <section className="bg-canvas py-8">
        <CounterContainer>
          <div className="rounded-(--r-md) border border-line bg-surface-1 p-5 md:flex md:items-center md:justify-between md:gap-8">
            <div className="flex items-start gap-4">
              <Truck size={38} strokeWidth={1.4} className="mt-1 shrink-0 text-ink-1" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-medium text-ink-1">Need help finding something?</h2>
                <p className="mt-1 text-sm leading-6 text-ink-2">
                  Call {SITE.phone} or submit your local branch request.
                </p>
              </div>
            </div>
            <LinkButton href="/contact" variant="secondary" className="mt-5 md:mt-0" data-conversion-hook="footer-contact">
              Contact us
            </LinkButton>
          </div>
        </CounterContainer>
      </section>

      <section className="bg-canvas pb-10">
        <CounterContainer>
          <div className="grid gap-2 md:grid-cols-3">
            {compliance.map((item) => (
              <p key={item} className="rounded-(--r-md) border border-line bg-surface-1 p-4 text-sm leading-6 text-ink-2">
                {item}
              </p>
            ))}
          </div>
        </CounterContainer>
      </section>
    </>
  );
}

function AudienceDoors() {
  return (
    <div className="mt-3 grid max-w-[680px] overflow-hidden rounded-(--r-sm) border border-brand md:grid-cols-2">
      <Link
        href="/portal/login"
        data-conversion-hook="homepage-shop-contractor"
        className="flex min-h-14 items-center justify-center gap-4 border-b border-brand px-5 py-2.5 transition-colors duration-150 hover:bg-brand-tint md:border-b-0 md:border-r"
      >
        <HardHat size={31} strokeWidth={1.4} className="shrink-0 text-brand" aria-hidden="true" />
        <span>
          <span className="block text-sm font-medium text-ink-1">Shop as contractor</span>
          <span className="part-number mt-0.5 block text-[0.65rem] uppercase tracking-[0.06em] text-ink-2">Net pricing</span>
        </span>
      </Link>
      <Link
        href="/products"
        data-conversion-hook="homepage-shop-homeowner"
        className="flex min-h-14 items-center justify-center gap-4 px-5 py-2.5 transition-colors duration-150 hover:bg-brand-tint"
      >
        <UserRound size={31} strokeWidth={1.4} className="shrink-0 text-brand" aria-hidden="true" />
        <span>
          <span className="block text-sm font-medium text-ink-1">Shop as homeowner</span>
          <span className="part-number mt-0.5 block text-[0.65rem] uppercase tracking-[0.06em] text-ink-2">List pricing</span>
        </span>
      </Link>
    </div>
  );
}

function CategoryCard({
  title,
  body,
  category,
  image,
}: {
  title: string;
  body: string;
  category: CatalogCategory;
  image: string;
}) {
  // A real unit beats line art. The sketch stays as the fallback for categories
  // with no exact-model photo rather than showing a stand-in from elsewhere.
  const photo = getCategoryHeroImage(category);
  return (
    <Link
      href={`/products?category=${category}`}
      className="group grid min-h-[124px] grid-cols-[58px_minmax(0,1fr)_18px] items-center gap-3 rounded-(--r-sm) border border-line bg-surface-1 p-4 transition-colors duration-150 hover:border-line-strong sm:grid-cols-[68px_minmax(0,1fr)_18px]"
      data-conversion-hook="category-tile-click"
    >
      <span className="relative block aspect-square w-full" aria-hidden="true">
        <Image
          src={photo ?? image}
          alt=""
          fill
          loading="lazy"
          sizes="(min-width: 640px) 68px, 58px"
          className="object-contain"
        />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-medium leading-tight text-ink-1">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-ink-2">{body}</span>
      </span>
      <ArrowRight size={16} strokeWidth={1.8} className="text-ink-1" aria-hidden="true" />
    </Link>
  );
}

function BranchSection() {
  return (
    <section className="hidden bg-canvas py-7 md:block">
      <CounterContainer>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-medium leading-tight text-ink-1">Pick up at a branch near you</h2>
          <Link href="/contact" className="inline-flex items-center gap-2 text-sm font-medium text-ink-1">
            View locations
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid gap-2 lg:grid-cols-4">
          {branches.map((branch) => (
            <BranchCard key={branch.name} {...branch} />
          ))}
        </div>
      </CounterContainer>
    </section>
  );
}

function MobileBranchStrip() {
  return (
    <section className="border-b border-line bg-surface-1 py-4 md:hidden">
      <CounterContainer>
        <BranchCard {...branches[0]} />
      </CounterContainer>
    </section>
  );
}

function BranchCard({
  name,
  stock,
  address,
  note,
}: {
  name: string;
  stock: string;
  address: string;
  note: string;
}) {
  return (
    <article className="rounded-(--r-sm) border border-line bg-surface-1 p-4">
      <h3 className="text-sm font-medium text-ink-1">{name}</h3>
      <p className="mt-1 text-sm font-medium text-brand">{stock}</p>
      <p className="mt-3 min-h-10 text-sm leading-5 text-ink-1">{address}</p>
      <p className="mt-3 text-sm text-ink-2">{note}</p>
    </article>
  );
}

function CounterContainer({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mx-4 w-auto max-w-[var(--counter-max)] px-0 sm:mx-auto sm:w-full sm:px-6 lg:px-[var(--counter-pad)] ${className}`}>
      {children}
    </div>
  );
}

function FoldContainer({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto w-full max-w-[var(--nav-max)] px-4 sm:px-6 lg:px-[var(--counter-pad)] ${className}`}>
      {children}
    </div>
  );
}
