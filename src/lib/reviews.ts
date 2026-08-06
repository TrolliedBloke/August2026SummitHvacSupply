/**
 * Product reviews registry.
 *
 * IMPORTANT — populate ONLY with real, consented customer reviews. Keyed by
 * SKU id first, then by series slug as a fallback so a review can apply to a
 * whole series. While a product has no real reviews it shows a "no reviews yet"
 * state and emits NO AggregateRating: fabricated ratings violate FTC endorsement
 * rules and Google's review-snippet policy, and risk manual action. Add genuine
 * reviews here and the star summary + Product/AggregateRating schema activate
 * automatically.
 *
 * Example entry:
 *   "sku-brz-09": [
 *     { author: "Marcos R.", role: "Installer", rating: 5, date: "2026-05-02",
 *       location: "Fremont, CA", verified: true,
 *       title: "Quiet and quick to commission",
 *       body: "Paired cleanly, refrigerant charge was spot on…" },
 *   ],
 */

export type Review = {
  author: string;
  role?: string;
  rating: number; // 1–5
  title?: string;
  body: string;
  date: string; // ISO
  location?: string;
  verified?: boolean;
};

/**
 * ⚠️ PLACEHOLDER DATA — sample reviews added at the owner's request so the
 * review UI has content to show during pre-launch demos. REPLACE with real,
 * consented customer reviews before the production deploy: publishing
 * fabricated reviews (and the AggregateRating schema they emit) violates FTC
 * endorsement rules and Google's review-snippet policy.
 */
export const REVIEWS: Record<string, Review[]> = {
  breezein: [
    {
      author: "Marcus T.", role: "Homeowner", rating: 5, date: "2026-05-18",
      location: "Fremont, CA", verified: true,
      title: "Garage office is finally usable year-round",
      body: "Bought the 12k for a converted garage office. Picked it up at the Newark counter Saturday morning, my installer had it running by Sunday. Dead quiet on low — the mini fridge is louder than this thing.",
    },
    {
      author: "Dana R.", role: "Installer", rating: 5, date: "2026-03-02",
      location: "San Jose, CA", verified: true,
      title: "Clean commissioning, charge was spot on",
      body: "Third BreezeIN I've put in this quarter. Factory charge covered the 20-ft run with nothing to add, flare fittings lined up clean, and the app pairing took two minutes. Will-call had it staged when I pulled in.",
    },
    {
      author: "Priya S.", role: "Homeowner", rating: 4, date: "2025-11-09",
      location: "Union City, CA", verified: true,
      title: "Great unit, remote could be better",
      body: "Heats our back bedroom fine even on cold January mornings. Only gripe is the remote menu takes some learning — the TCL app is honestly easier. Summit answered my sizing question by text before I ordered.",
    },
  ],
  freshin: [
    {
      author: "Alan W.", role: "Homeowner", rating: 5, date: "2026-04-22",
      location: "Palo Alto, CA", verified: true,
      title: "The fresh-air intake is the real deal",
      body: "Got this for a home office because of the ventilation feature. CO2 on my monitor stays under 700 ppm with the intake on — used to hit 1,200 by mid-afternoon with the door closed.",
    },
    {
      author: "Reyna C.", role: "Installer", rating: 4, date: "2026-01-15",
      location: "Hayward, CA", verified: true,
      title: "Solid unit, plan the intake duct early",
      body: "Performs as advertised, but budget extra time for the fresh-air duct penetration on retrofit walls. Summit's counter flagged that before I quoted the job, which saved me an awkward change order.",
    },
  ],
  elite: [
    {
      author: "Tom K.", role: "Homeowner", rating: 5, date: "2026-06-03",
      location: "Oakland, CA", verified: true,
      title: "Replaced a gas furnace, heats better at 35°F",
      body: "Whole-home replacement with the hyper-heat Elite. January mornings in the hills it kept 70°F inside without breaking a sweat, and our PG&E bill dropped about $80/mo versus the old furnace + window ACs.",
    },
    {
      author: "Steve M.", role: "Installer", rating: 5, date: "2026-02-27",
      location: "San Mateo, CA", verified: true,
      title: "The -22°F rating isn't marketing",
      body: "I install for a TECH Clean contractor and the Elite has been my go-to for rebate jobs. Inverter ramps smooth, no cold-blow on defrost, and the R-454B service fittings are laid out sensibly.",
    },
    {
      author: "Janelle F.", role: "Property manager", rating: 4, date: "2025-10-12",
      location: "Berkeley, CA", verified: true,
      title: "Two duplex units, zero callbacks",
      body: "Put Elites in both sides of a duplex last fall. Tenants control their own zones, no complaints through winter. Docked a star only because lead time on the 36k head was about a week when I ordered.",
    },
  ],
  "light-commercial": [
    {
      author: "Gus P.", role: "Contractor", rating: 5, date: "2026-05-30",
      location: "Santa Clara, CA", verified: true,
      title: "Restaurant TI, passed inspection first try",
      body: "Spec'd two 48k cassettes for a restaurant tenant improvement. Summit had the AHRI certs and submittal PDFs on the product page — plan checker took them without a single RFI. That alone saved me a week.",
    },
    {
      author: "Irene L.", role: "Procurement", rating: 4, date: "2026-02-08",
      location: "San Francisco, CA", verified: true,
      title: "Reliable supply for our rollout",
      body: "We're standardizing 14 retail locations on this line. Newark stock has covered every phase so far and the PO process with net terms is painless. Freight quotes could turn around a bit faster.",
    },
  ],
  "multi-zone": [
    {
      author: "Derek H.", role: "Homeowner", rating: 5, date: "2026-04-11",
      location: "Walnut Creek, CA", verified: true,
      title: "Four rooms, one condenser, no ducts",
      body: "1950s ranch with zero duct space. The 4-zone handles three bedrooms and the living room off one outdoor unit. Each kid controls their own room, which ended the thermostat wars permanently.",
    },
    {
      author: "Felix N.", role: "Installer", rating: 4, date: "2025-12-19",
      location: "Daly City, CA", verified: true,
      title: "Good manifold layout, watch line lengths",
      body: "Branch box placement is flexible and the manifold is well labeled. Just mind the max line-set lengths on the far zones — the spec sheet on Summit's site has the table, read it before you bid.",
    },
    {
      author: "Carmen V.", role: "Homeowner", rating: 3, date: "2025-09-25",
      location: "Richmond, CA", verified: true,
      title: "Works well, sizing took two tries",
      body: "First installer quoted zones too small for our west-facing rooms. Summit's team caught it when we called to confirm the order and suggested bumping two heads up a size. Right call — but I wish that guidance came standard, not on a phone call.",
    },
  ],
  "central-system": [
    {
      author: "Bill A.", role: "Homeowner", rating: 5, date: "2026-03-14",
      location: "Livermore, CA", verified: true,
      title: "Drop-in replacement for our old split system",
      body: "Reused existing ducts, with the new air handler in the same closet footprint. The house cools evenly for the first time in 20 years, and the AHRI certificate kept the equipment documentation organized.",
    },
    {
      author: "Marisol E.", role: "Contractor", rating: 4, date: "2026-01-28",
      location: "Concord, CA", verified: true,
      title: "Good ducted option at this price point",
      body: "Static pressure handling is honest for the tonnage and the cabinet is tighter than the brand we used to carry. Manual could use better wiring diagrams, but Summit's counter answered the one question I had same-day.",
    },
  ],
};

/**
 * Placeholder reviews are demo scaffolding, and shipping them is a legal
 * problem rather than a taste problem: the entries in REVIEWS are invented
 * people carrying `verified: true` badges, and they drive the
 * Product/AggregateRating schema on every product page.
 *
 * Publishing them would put the site inside the FTC's rule on fake consumer
 * reviews (16 CFR Part 465, in force since 2024, civil penalties assessed per
 * violation) and Google's review-snippet policy, which answers with manual
 * action. Relying on someone remembering to empty this file before a deploy is
 * not a control -- so production refuses to serve them regardless of what the
 * file contains.
 *
 * The demo keeps working locally and in preview. To show them in a hosted demo,
 * set SHOW_PLACEHOLDER_REVIEWS=true explicitly and accept the above.
 * Real, consented reviews should be moved to the database and read from there,
 * at which point this gate stops applying.
 */
function placeholderReviewsAllowed(): boolean {
  if (process.env.SHOW_PLACEHOLDER_REVIEWS === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export function getReviews(skuId: string, seriesSlug: string): Review[] {
  if (!placeholderReviewsAllowed()) return [];
  return REVIEWS[skuId] ?? REVIEWS[seriesSlug] ?? [];
}

export type ReviewSummary = { count: number; average: number };

export function reviewSummary(reviews: Review[]): ReviewSummary | null {
  if (reviews.length === 0) return null;
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return { count: reviews.length, average: Math.round(average * 10) / 10 };
}
