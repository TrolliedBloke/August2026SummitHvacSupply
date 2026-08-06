import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Home,
  Package,
  Search,
  Truck,
} from "lucide-react";
import { LinkButton } from "@/components/ui";
import { SITE } from "@/lib/site";
import { getStorefrontSkus } from "@/lib/storefront/catalog";

/* Live shelf count. Was hardcoded as "16", which drifts silently the moment
   inventory moves -- and a stock promise that turns out to be wrong is worse
   than no promise for a supplier whose whole pitch is "pickup today". */
function inStockCount(): number {
  return getStorefrontSkus().filter((sku) => sku.available > 0).length;
}

export const metadata: Metadata = {
  title: "Bay area HVAC supply, parts, heat pumps, and pickup | Summit HVAC Supply",
  description:
    "Search Bay Area HVAC stock, shop TCL heat pumps and mini splits, get homeowner installer help, or use contractor will-call from Summit HVAC Supply in Newark, CA.",
  alternates: { canonical: "/" },
};

const examples = ["TH09SVH23BW", "2.5 ton heat pump", "R-454B", "line set"];

const doors = [
  {
    eyebrow: "I know what I need",
    title: "Browse products by category",
    body: "Equipment, parts, tools, and common job materials.",
    href: "/products",
    cta: "Shop categories",
    image: "/site/sketches/warehouse-rack.png",
    mediaSide: "left" as const,
  },
  {
    eyebrow: "I am replacing a system",
    title: "Find the right system for your home",
    body: "Answer a few basics. Get matched with equipment and installer help.",
    href: "/homeowners#homeowner-request",
    cta: "Start system selector",
    image: "/site/sketches/home-system.png",
    mediaSide: "right" as const,
  },
];

const categories = [
  { title: "Heat pumps", body: "Air source and hybrid", href: "/products/central-system", image: "/site/sketches/heat-pump.png" },
  { title: "Air conditioners", body: "Central ac systems", href: "/products/light-commercial", image: "/site/sketches/air-conditioner.png" },
  { title: "Furnaces", body: "Gas, electric, and modular", href: "/products", image: "/site/sketches/furnace.png" },
  { title: "Ductless systems", body: "Wall, multi-zone, and accessories", href: "/products/breezein", image: "/site/sketches/ductless.png" },
  { title: "Indoor air quality", body: "Filters, purifiers, humidifiers", href: "/products/freshin", image: "/site/sketches/indoor-air-quality.png" },
  { title: "Water heating", body: "Tank, tankless, and parts", href: "/products", image: "/site/sketches/water-heating.png" },
  { title: "Refrigerant and A2L", body: "R-410A, R-454B, and more", href: "/resources", image: "/site/sketches/refrigerant.png" },
  { title: "Parts and supplies", body: "Controls, capacitors, and more", href: "/products", image: "/site/sketches/parts-supplies.png" },
  { title: "Sheet metal", body: "Duct, fittings, and accessories", href: "/products", image: "/site/sketches/sheet-metal.png" },
  { title: "Tools and equipment", body: "Testing, recovery, and install tools", href: "/products", image: "/site/sketches/tools-equipment.png" },
  { title: "Thermostats and controls", body: "Programmable, smart, and IAQ", href: "/products", image: "/site/sketches/thermostat-controls.png" },
  { title: "Clearance", body: "Closeouts and overstock deals", href: "/products", image: "/site/sketches/clearance.png" },
];

const branches = [
  {
    name: "Newark",
    stock: `${inStockCount()} systems in stock`,
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

const proof = [
  { title: "Real stock.", body: "Updated for local fulfillment.", icon: <Package /> },
  { title: "Real people.", body: "Local help, not a call center.", icon: <Home /> },
  { title: "Ready when you are.", body: "Order by 2:00p PT. Pick up today.", icon: <CheckCircle2 /> },
  { title: "Trade account pricing.", body: "Apply once. Save every time.", icon: <ClipboardCheck /> },
];

const compliance = [
  "Equipment supply only. Installation is handled by qualified local contractors.",
  "Installer confirms sizing, permits, labor, and final scope before equipment is ordered.",
  "AHRI, energy star, ETL, and NEEP documents stay close to the product decision.",
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

      <section className="border-b border-line bg-canvas">
        <CounterContainer className="pb-3 pt-8 md:pb-5 md:pt-10">
          <div className="max-w-[780px]">
            <h1 className="max-w-[640px] font-display text-[2.35rem] font-medium leading-[1] tracking-normal text-ink-1 sm:text-[3.35rem] lg:text-[3.75rem]">
              Parts on the shelf.
              <br />
              Pickup today.
            </h1>
            <p className="mt-3 text-[1.02rem] leading-7 text-ink-1">
              Bay Area stock. Local pickup. Real people.
            </p>

            <form
              action="/products"
              className="mt-5 flex max-w-[720px] flex-col gap-3 overflow-hidden rounded-(--r-sm) border border-line-strong bg-surface-1 p-3 sm:flex-row sm:items-center"
              data-conversion-hook="homepage-search-start"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Search size={28} strokeWidth={1.7} className="ml-2 shrink-0 text-ink-1" aria-hidden="true" />
                <label htmlFor="home-search" className="sr-only">
                  Search by part number, model, or keyword
                </label>
                <input
                  id="home-search"
                  name="q"
                  type="search"
                  placeholder="Part #, model, or keyword"
                  className="min-w-0 flex-1 bg-transparent px-2 font-mono text-[0.95rem] text-ink-1 outline-none placeholder:text-ink-4"
                />
              </div>
              <button
                type="submit"
                className="h-12 w-full rounded-(--r-sm) bg-brand px-7 text-sm font-medium text-brand-ink transition-colors duration-150 sm:w-auto"
              >
                Search
              </button>
            </form>

            <div className="mt-4 flex max-w-full flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden text-sm text-ink-2">
              <span>Examples:</span>
              {examples.map((example) => (
                <Link
                  key={example}
                  href={`/products?q=${encodeURIComponent(example)}`}
                  className="part-number underline underline-offset-4"
                >
                  {example}
                </Link>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2 text-[0.95rem] text-ink-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
              <span className="inline-flex items-center gap-2 text-brand">
                <CheckCircle2 size={21} strokeWidth={1.8} aria-hidden="true" />
                {inStockCount()} on the shelf in Newark
              </span>
              <span className="hidden sm:inline" aria-hidden="true">·</span>
              <span>Will-call until 5:00pm</span>
            </div>
          </div>
        </CounterContainer>
      </section>

      <MobileBranchStrip />

      <section className="bg-canvas pb-4 pt-5 md:pb-5">
        <CounterContainer className="grid gap-2 lg:grid-cols-2">
          {doors.map((door) => (
            <DoorCard key={door.title} {...door} />
          ))}
        </CounterContainer>
      </section>

      <section className="bg-canvas pb-4 pt-3">
        <CounterContainer>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-medium leading-tight text-ink-1">Shop by category</h2>
            <Link href="/products" className="hidden items-center gap-2 text-sm font-medium text-ink-1 md:inline-flex">
              View all categories
              <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <CategoryCard key={category.title} {...category} />
            ))}
          </div>
        </CounterContainer>
      </section>

      <BranchSection />

      <section className="border-y border-line bg-canvas py-7">
        <CounterContainer className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {proof.map((item) => (
            <div key={item.title} className="flex items-center gap-4">
              <span className="grid size-10 place-items-center text-ink-1 [&_svg]:size-7 [&_svg]:stroke-[1.4]">
                {item.icon}
              </span>
              <span>
                <span className="block text-sm font-medium text-ink-1">{item.title}</span>
                <span className="block text-sm text-ink-2">{item.body}</span>
              </span>
            </div>
          ))}
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

function DoorCard({
  eyebrow,
  title,
  body,
  href,
  cta,
  image,
  mediaSide,
}: {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  image: string;
  mediaSide: "left" | "right";
}) {
  return (
    <article className={`grid min-h-[190px] items-center gap-4 rounded-(--r-md) border border-line bg-surface-1 p-5 md:p-6 ${
      mediaSide === "right"
        ? "grid-cols-[minmax(0,1fr)_120px] md:grid-cols-[minmax(0,1fr)_190px]"
        : "grid-cols-[96px_minmax(0,1fr)] md:grid-cols-[118px_minmax(0,1fr)]"
    }`}>
      <div className={`relative aspect-square w-full ${mediaSide === "right" ? "order-2" : ""}`} aria-hidden="true">
        <Image src={image} alt="" fill loading="lazy" sizes="(min-width: 768px) 190px, 120px" className="object-contain" />
      </div>
      <div className={`min-w-0 ${mediaSide === "right" ? "order-1" : ""}`}>
        <p className="text-sm font-medium text-ink-1">{eyebrow}</p>
        <h2 className="mt-2 max-w-[360px] text-[1.42rem] font-medium leading-tight text-ink-1 sm:text-[1.55rem]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-2">{body}</p>
        <LinkButton href={href} variant="secondary" className="mt-4" data-conversion-hook="buyer-door-click">
          {cta}
          <ArrowRight size={15} />
        </LinkButton>
      </div>
    </article>
  );
}

function CategoryCard({
  title,
  body,
  href,
  image,
}: {
  title: string;
  body: string;
  href: string;
  image: string;
}) {
  return (
    <Link
      href={href}
      className="group grid min-h-[124px] grid-cols-[58px_minmax(0,1fr)_18px] items-center gap-3 rounded-(--r-sm) border border-line bg-surface-1 p-4 transition-colors duration-150 hover:border-line-strong sm:grid-cols-[68px_minmax(0,1fr)_18px]"
      data-conversion-hook="category-tile-click"
    >
      <span className="relative block aspect-square w-full" aria-hidden="true">
        <Image src={image} alt="" fill loading="lazy" sizes="(min-width: 640px) 68px, 58px" className="object-contain" />
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
