import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QuoteProvider } from "@/components/quote-context";
import { FulfillmentProvider } from "@/components/fulfillment-context";
import { QuoteDrawerMount } from "@/components/quote-drawer-mount";
import { ChatWidget } from "@/components/chat-widget";
import { AnalyticsListener } from "@/components/analytics-listener";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SITE } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";

// Inter is the only typeface: headings, body and data. Numbers line up via
// tabular figures (see globals.css), not a monospace font.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

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
    <html lang="en" data-scroll-behavior="smooth" className={inter.variable}>
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
            <SiteNav />
            <main id="main">{children}</main>
            <SiteFooter />
            <QuoteDrawerMount />
            <ChatWidget />
            <AnalyticsListener />
          </QuoteProvider>
        </FulfillmentProvider>
        <Analytics />
      </body>
    </html>
  );
}
