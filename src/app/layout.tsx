import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QuoteProvider } from "@/components/quote-context";
import { FulfillmentProvider } from "@/components/fulfillment-context";
import { QuoteDrawerMount } from "@/components/quote-drawer-mount";
import { ChatWidget } from "@/components/chat-widget";
import { AnalyticsListener } from "@/components/analytics-listener";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SITE } from "@/lib/site";
import { catalogCategoryDestinations } from "@/lib/storefront/catalog";
import { Analytics } from "@vercel/analytics/next";
import { AdTags } from "@/components/ad-tags";
import { adsConfig } from "@/lib/ads-config";
import { BrowserPrivacy } from "@/components/privacy/browser-privacy";

// Inter is the only typeface: headings, body and data. Numbers line up via
// tabular figures (see globals.css), not a monospace font.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// SKUs and spec values only (.part-number), never prose.
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-jb", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  title: {
    default: "Summit HVAC Supply - Bay Area HVAC Equipment Catalog",
    template: "%s · Summit HVAC Supply",
  },
  description:
    "Shop TCL, TOSOT, Carrier, central HVAC, mini-split, furnace, cassette, and installation-supply models from Summit HVAC Supply in Newark, CA.",
  keywords: [
    "Bay Area heat pumps",
    "Bay Area mini split supply",
    "HVAC equipment Bay Area",
    "Newark HVAC supply",
    "Bay Area heat pump installer help",
  ],
  openGraph: {
    title: "Summit HVAC Supply - Bay Area HVAC Equipment",
    description:
      "HVAC equipment catalog and quote support for Bay Area homeowners, property teams, and contractors.",
    type: "website",
    siteName: SITE.name,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The production analytics endpoint exists on Vercel only. Rendering the
  // component in a self-hosted production build requests a missing
  // /_vercel/insights/script.js and creates a 404/MIME console error on every
  // page. Custom first-party event logging remains available everywhere.
  const vercelAnalyticsAvailable = process.env.VERCEL === "1";
  // Ad tags render only when every gate in lib/ads-config.ts is open; today
  // the privacy notice says Summit does not share data, so this is null.
  const ads = adsConfig();
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "HVACBusiness",
    name: SITE.name,
    url: SITE.origin,
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
    areaServed: SITE.serviceArea,
  };
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-(--r-sm) focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:text-brand-ink"
        >
          Skip to content
        </a>
        <FulfillmentProvider>
          <QuoteProvider>
            <SiteNav categories={catalogCategoryDestinations()} />
            <main id="main">{children}</main>
            <SiteFooter />
            <QuoteDrawerMount />
            <ChatWidget />
            <AnalyticsListener />
          </QuoteProvider>
        </FulfillmentProvider>
        {vercelAnalyticsAvailable && <Analytics />}
        <BrowserPrivacy />
        {ads.enabled && <AdTags metaPixelId={ads.metaPixelId} googleTagId={ads.googleTagId} />}
      </body>
    </html>
  );
}
