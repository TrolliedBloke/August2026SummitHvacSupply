import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QuoteProvider } from "@/components/quote-context";
import { FulfillmentProvider } from "@/components/fulfillment-context";
import { QuoteDrawerMount } from "@/components/quote-drawer-mount";
import { ChatWidget } from "@/components/chat-widget";
import { AnalyticsListener } from "@/components/analytics-listener";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { SITE } from "@/lib/site";

// Body: Inter — neutral, legible at small sizes for spec-dense pages.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Display: Inter Tight — the weight and tight tracking of a distributor
// catalog without the geometric SaaS-dashboard vocabulary. Shares rendering
// DNA with Inter, so the two families never fight.
const grotesk = Inter_Tight({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
// Data: JetBrains Mono — tabular figures so spec rails and tables align.
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  title: {
    default: "Summit HVAC Supply - Bay Area HVAC Equipment Catalog",
    template: "%s · Summit HVAC Supply",
  },
  description:
    "Search TCL, TOSOT, Carrier, central HVAC, mini-split, furnace, cassette, and installation-supply models. Request verified pricing and availability from Newark, CA.",
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
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
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
      </body>
    </html>
  );
}
