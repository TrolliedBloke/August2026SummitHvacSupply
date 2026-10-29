/**
 * About-page copy as structured content, so longer or translated strings do
 * not need JSX changes. Every evergreen claim names an owner and the date it
 * was last reviewed; dynamic facts (catalog size, branch status, fulfillment
 * methods) are NOT written here -- the page reads them from their sources.
 *
 * TODO(summit-ops): have each owner re-confirm their claims and update
 * `reviewedAt`.
 */
export type GovernedClaim = { id: string; title: string; body: string; owner: string; reviewedAt: string };

export const ABOUT_CONTENT = {
  eyebrow: "About Summit HVAC Supply",
  heading: "Local HVAC equipment support for Bay Area homes, properties, and pros.",
  intro:
    "We supply TCL, Tosot, Carrier and installation-supply products from Newark, California. Homeowners can ask about one system and installer help; contractors get exact-model search, document requests and account quote support. Installation is handled by qualified local contractors.",
  heroImage: {
    src: "/site/generated/newark-warehouse-stock.jpg",
    alt: "HVAC equipment on warehouse shelving at the Newark branch",
  },
  proofHeading: "What you can check today",
  storyHeading: "How we work",
  claims: [
    {
      id: "fulfillment-review",
      title: "Local fulfillment review",
      body: "Newark will-call, Bay Area delivery and freight are confirmed against the exact product and current inventory before an order is accepted.",
      owner: "Newark counter operations",
      reviewedAt: "2026-09-30",
    },
    {
      id: "evidence-before-claims",
      title: "Evidence before claims",
      body: "Exact-model certifications, warranty terms, documents and compatibility publish only after their official sources are verified.",
      owner: "Catalog research",
      reviewedAt: "2026-09-30",
    },
    {
      id: "two-paths",
      title: "Two clear buying paths",
      body: "Homeowners get plain-English equipment guidance. Contractors get the dense pro workflow where it belongs.",
      owner: "Summit HVAC Supply",
      reviewedAt: "2026-09-30",
    },
  ] satisfies GovernedClaim[],
} as const;
