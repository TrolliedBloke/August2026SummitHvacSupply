import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Clock3, MapPin, PackageCheck, Phone } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Container, LinkButton } from "@/components/ui";
import { pageMetadata, safeJsonLd } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Summit HVAC Supply Newark - Will-Call, Stock & Directions",
  description: `Visit Summit HVAC Supply at ${SITE.address.full} for Newark will-call, Bay Area HVAC stock, documents, and contractor support.`,
  path: "/locations/newark",
  image: "/site/generated/newark-warehouse-stock.jpg",
});

export default function NewarkLocationPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "HVACBusiness",
    "@id": `${SITE.origin}/locations/newark#location`,
    name: SITE.name,
    url: `${SITE.origin}/locations/newark`,
    image: `${SITE.origin}/site/generated/newark-warehouse-stock.jpg`,
    telephone: SITE.phone,
    email: SITE.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.street,
      addressLocality: SITE.address.city,
      addressRegion: SITE.address.state,
      postalCode: SITE.address.zip,
      addressCountry: "US",
    },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "07:00", closes: "17:00" },
    ],
    areaServed: SITE.serviceArea,
    hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SITE.address.full)}`,
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
    <header className="border-b border-line bg-surface-1"><Container className="py-10 sm:py-14"><Breadcrumbs items={[{ label: "Locations", href: "/locations/newark" }, { label: "Newark", href: "/locations/newark" }]} /><div className="mt-5 grid items-center gap-8 lg:grid-cols-[1fr_0.9fr]"><div><p className="text-sm text-ink-2">Newark supply hub</p><h1 className="mt-2 font-display text-4xl font-medium leading-tight text-ink-1 sm:text-5xl">Stock, will-call, and real counter support in Newark.</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-ink-2">Reserve available equipment for pickup, bring a model or part number for a stock check, or send a project list for quote support.</p><div className="mt-6 flex flex-wrap gap-3"><LinkButton href="/products">Check stock</LinkButton><LinkButton href={SITE.phoneHref} variant="secondary"><Phone size={17} />Call {SITE.phone}</LinkButton></div></div><div className="relative aspect-[4/3] overflow-hidden rounded-(--r-md) border border-line"><Image src="/site/generated/newark-warehouse-stock.jpg" alt="HVAC equipment stocked on warehouse shelving at Summit HVAC Supply" fill priority sizes="(min-width: 1024px) 42vw, 100vw" className="object-cover" /></div></div></Container></header>
    <Container className="py-10 sm:py-14"><section className="grid gap-4 sm:grid-cols-3"><Fact icon={<MapPin size={20} />} title="Address"><address className="not-italic">{SITE.address.street}<br />{SITE.address.city}, {SITE.address.state} {SITE.address.zip}</address></Fact><Fact icon={<Clock3 size={20} />} title="Counter hours"><p>Monday-Friday<br />7:00am-5:00pm PT</p></Fact><Fact icon={<PackageCheck size={20} />} title="Fulfillment"><p>Same-day will-call on confirmed stock<br />Bay Area delivery coordination</p></Fact></section><section className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]"><div><h2 className="font-display text-2xl font-medium text-ink-1">How will-call works</h2><ol className="mt-5 space-y-5">{["Search the exact SKU or send the counter your equipment list.", "Wait for stock and matched-system confirmation before traveling.", "Reserve the order and bring the pickup contact and order reference.", "Inspect cartons and verify model numbers before leaving the counter."].map((step, index) => <li key={step} className="flex gap-4"><span className="part-number flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-xs text-ink-1">{index + 1}</span><p className="pt-0.5 text-sm leading-6 text-ink-2">{step}</p></li>)}</ol><p className="mt-6 text-sm leading-6 text-ink-2">Parking, loading position, and large-order pickup instructions are confirmed with the order. Do not arrive for unconfirmed stock.</p></div><div className="overflow-hidden rounded-(--r-md) border border-line"><iframe title="Map showing Summit HVAC Supply in Newark, California" src={`https://www.google.com/maps?q=${encodeURIComponent(SITE.address.full)}&output=embed`} className="h-[360px] w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div></section><section className="mt-12 border-t border-line pt-8"><h2 className="font-display text-2xl font-medium text-ink-1">Common Newark counter paths</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><LocationLink href="/products" title="Exact SKU search" body="Search model numbers, stock, list price, and documents." /><LocationLink href="/dealers" title="Contractor account" body="Apply for trade pricing, quote access, and repeat ordering." /><LocationLink href="/homeowners" title="Buying one system" body="Get equipment guidance and qualified installer help." /></div></section></Container>
  </>;
}

function Fact({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <article className="rounded-(--r-sm) border border-line bg-surface-1 p-5"><div className="flex items-center gap-2 text-ink-1">{icon}<h2 className="font-medium">{title}</h2></div><div className="mt-3 text-sm leading-6 text-ink-2">{children}</div></article>; }
function LocationLink({ href, title, body }: { href: string; title: string; body: string }) { return <Link href={href} className="rounded-(--r-sm) border border-line bg-surface-1 p-4"><span className="font-medium text-ink-1">{title}</span><span className="mt-2 block text-sm leading-6 text-ink-2">{body}</span></Link>; }
