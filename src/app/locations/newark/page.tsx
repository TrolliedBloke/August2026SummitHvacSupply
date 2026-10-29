import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarX2, Clock3, MapPin, Navigation, PackageCheck, Phone } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BranchStatusText } from "@/components/branch-status";
import { Container, LinkButton } from "@/components/ui";
import { pageMetadata, safeJsonLd } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";
import {
  branchAddressLine,
  branchOpeningHoursSchema,
  directionsHref,
  NEWARK,
  upcomingExceptions,
  weeklyHoursRows,
} from "@/lib/branch";
import { pickupReadyLine } from "@/lib/backend/fulfillment";
import { deliveryPolicyIsConfirmed } from "@/lib/fulfillment-policy";
import { LocationMap } from "@/components/location-map";

/**
 * The Newark branch page. Every hour, holiday and status on it -- and the
 * structured data -- is a projection of the Branch entity in lib/branch.ts, so
 * a dated closure updates the page, the header, the mobile menu and the
 * fulfillment dates together. The address, phone and directions link stand on
 * their own; the map embed is an enhancement.
 */
export const metadata: Metadata = pageMetadata({
  title: "Summit HVAC Supply Newark - Will-Call, Stock & Directions",
  description: `Visit Summit HVAC Supply at ${SITE.address.full} for Newark will-call, Bay Area HVAC stock, documents, and contractor support.`,
  path: "/locations/newark",
  image: "/site/generated/newark-warehouse-stock.jpg",
});

// Exceptions in the next 60 days and the structured data depend on the date.
export const revalidate = 3600;

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
function exceptionDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return WEEKDAY.format(new Date(Date.UTC(year, month - 1, day)));
}

export default function NewarkLocationPage() {
  const branch = NEWARK;
  const hoursConfirmed = branch.hoursReview.status === "confirmed";
  const deliveryConfirmed = deliveryPolicyIsConfirmed();
  const hours = hoursConfirmed ? weeklyHoursRows(branch) : [];
  const exceptions = hoursConfirmed ? upcomingExceptions(branch) : [];
  const schema = {
    "@context": "https://schema.org",
    "@type": "HVACBusiness",
    "@id": `${SITE.origin}/locations/newark#location`,
    name: SITE.name,
    url: `${SITE.origin}/locations/newark`,
    image: `${SITE.origin}/site/generated/newark-warehouse-stock.jpg`,
    telephone: branch.phone,
    email: branch.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: branch.address.street,
      addressLocality: branch.address.city,
      addressRegion: branch.address.state,
      postalCode: branch.address.zip,
      addressCountry: branch.address.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: branch.coordinates.lat, longitude: branch.coordinates.lng },
    ...branchOpeningHoursSchema(branch),
    ...(deliveryConfirmed ? { areaServed: SITE.serviceArea } : {}),
    hasMap: directionsHref(branch),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
      <header className="border-b border-line bg-surface-1">
        <Container className="py-10 sm:py-14">
          <Breadcrumbs items={[{ label: "Locations", href: "/locations/newark" }, { label: "Newark", href: "/locations/newark" }]} />
          <div className="mt-5 grid items-center gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="text-sm text-ink-2">Newark supply hub</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">Stock, will-call, and real counter support in Newark.</h1>
              <p className="mt-3 text-base">
                <BranchStatusText withDot className="font-medium text-ink-1" />
              </p>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-2">
                Reserve available equipment for pickup, bring a model or part number for a stock check, or send a project list
                for quote support.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton href="/products">Check stock</LinkButton>
                <LinkButton href={branch.phoneHref} variant="secondary">
                  <Phone size={17} aria-hidden="true" />
                  Call {branch.phone}
                </LinkButton>
                <LinkButton href={directionsHref(branch)} variant="secondary">
                  <Navigation size={17} aria-hidden="true" />
                  Directions
                </LinkButton>
              </div>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-(--r-md) border border-line bg-surface-2">
              <Image
                src="/site/generated/newark-warehouse-stock.jpg"
                alt="HVAC equipment stocked on warehouse shelving at Summit HVAC Supply"
                fill
                preload
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </Container>
      </header>

      <Container className="py-10 sm:py-14">
        <section className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={<MapPin size={20} aria-hidden="true" />} title="Address">
            <address className="not-italic">
              {branch.address.street}
              <br />
              {branch.address.city}, {branch.address.state} {branch.address.zip}
            </address>
            <a href={directionsHref(branch)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-ink-1 underline underline-offset-4">
              Get directions<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </Fact>
          <Fact icon={<Clock3 size={20} aria-hidden="true" />} title="Counter hours">
            {hoursConfirmed ? (
              <>
                <table className="w-full text-left">
                  <caption className="sr-only">Regular weekly hours, Pacific time</caption>
                  <tbody>
                    {hours.map((row) => (
                      <tr key={row.days}>
                        <th scope="row" className="py-0.5 pr-3 font-normal">
                          <abbr title={row.daysLong} className="no-underline">
                            {row.days}
                          </abbr>
                        </th>
                        <td className="py-0.5 text-ink-1">{row.hours ?? "Closed"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-xs text-ink-3">Pacific time</p>
              </>
            ) : (
              <p>Call {branch.phone} to confirm today&apos;s counter hours before traveling.</p>
            )}
          </Fact>
          <Fact icon={<CalendarX2 size={20} aria-hidden="true" />} title="Upcoming closures">
            {!hoursConfirmed ? (
              <p>The counter confirms holiday and temporary closures by phone.</p>
            ) : exceptions.length === 0 ? (
              <p>No closures in the next 60 days.</p>
            ) : (
              <ul>
                {exceptions.map((exception) => (
                  <li key={exception.date}>
                    <span className="text-ink-1">{exceptionDate(exception.date)}</span> · {exception.reason}
                    {exception.hours ? " (special hours)" : " (closed)"}
                  </li>
                ))}
              </ul>
            )}
          </Fact>
          <Fact icon={<PackageCheck size={20} aria-hidden="true" />} title="Fulfillment">
            <p>
              {pickupReadyLine()} on confirmed stock
              <br />
              {deliveryConfirmed ? "Bay Area route delivery" : "Delivery coverage confirmed by the counter"} ·{" "}
              <Link href="/delivery" className="text-ink-1 underline underline-offset-4">
                check your ZIP
              </Link>
            </p>
          </Fact>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-2xl font-medium text-ink-1">How will-call works</h2>
            <ol className="mt-5 space-y-5">
              {[
                "Search the exact SKU or send the counter your equipment list.",
                "Wait for stock and matched-system confirmation before traveling.",
                "Reserve the order and bring the pickup contact and order reference.",
                "Inspect cartons and verify model numbers before leaving the counter.",
              ].map((step, index) => (
                <li key={step} className="flex gap-4">
                  <span className="part-number flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-xs text-ink-1">{index + 1}</span>
                  <p className="pt-0.5 text-sm leading-6 text-ink-2">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm leading-6 text-ink-2">
              Parking, loading position, and large-order pickup instructions are confirmed with the order. Do not arrive for
              unconfirmed stock.
            </p>
          </div>
          <LocationMap address={branchAddressLine(branch)} directionsHref={directionsHref(branch)} />
        </section>

        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-2xl font-medium text-ink-1">Common Newark counter paths</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <LocationLink href="/products" title="Exact SKU search" body="Search model numbers, stock, list price, and documents." />
            <LocationLink href="/dealers" title="Contractor account" body="Apply for trade pricing, quote access, and repeat ordering." />
            <LocationLink href="/homeowners" title="Buying one system" body="Get equipment guidance and qualified installer help." />
          </div>
        </section>
      </Container>
    </>
  );
}

function Fact({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <article>
      <div className="flex items-center gap-2 text-ink-1">
        {icon}
        <h2 className="font-medium">{title}</h2>
      </div>
      <div className="mt-3 text-sm leading-6 text-ink-2">{children}</div>
    </article>
  );
}

function LocationLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="rounded-(--r-sm) border border-line bg-surface-1 p-4 transition-colors hover:border-line-strong">
      <span className="font-medium text-ink-1">{title}</span>
      <span className="mt-2 block text-sm leading-6 text-ink-2">{body}</span>
    </Link>
  );
}
