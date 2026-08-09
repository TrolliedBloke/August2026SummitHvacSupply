/**
 * Company testimonials -- SEGMENTED BY AUDIENCE, and separate from product
 * reviews (which live in the database via migration 009).
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  HOW TO ADD ONE
 * ─────────────────────────────────────────────────────────────────────────
 * Replace the disclosed demo fixtures below with consented customer entries.
 * A slot renders only when an entry passes publishable(), so production pages
 * collapse cleanly until real testimonials are available.
 *
 *   CONTRACTOR_TESTIMONIALS.push({
 *     quote: "...",          // specific operational result, not "great service"
 *     name: "Full Name",
 *     company: "Company LLC",
 *     city: "Fremont, CA",
 *     trade: "Mechanical contractor",
 *     consented: true,       // REQUIRED -- see below
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  RULES -- these are not stylistic
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Production entries must be real people who actually said this. Inventing a testimonial and
 *    attributing it to a named business is a deceptive endorsement under the
 *    FTC's rule on consumer reviews and testimonials (16 CFR Part 465) -- the
 *    same rule that made the placeholder product reviews unshippable.
 * 2. `consented: true` means that person agreed to be quoted publicly, by
 *    name and company. Entries without it are filtered out at render time.
 * 3. Prefer a specific operational result over praise. "Counter had my
 *    condenser staged at 6:45 so my crew wasn't idling" outperforms "Great
 *    service" because it is falsifiable and therefore credible.
 * 4. Demo entries must use `demo: true`; they are visibly labeled and blocked
 *    whenever NODE_ENV is production.
 * 5. Keep contractor and homeowner voices apart. A contractor evaluating a
 *    supplier does not care that someone's garage office is comfortable.
 */

export type Testimonial = {
  quote: string;
  name: string;
  /** Contractors only. Omit for homeowners -- publish only what they agreed to. */
  company?: string;
  city: string;
  /** e.g. "Mechanical contractor", "Homeowner", "Property manager". */
  trade?: string;
  /** Optional customer portrait. Use only with explicit image permission. */
  image?: string;
  imageAlt?: string;
  /** Fictional presentation fixture. Always disclosed and production-blocked. */
  demo?: boolean;
  /** Must be true to render. No consent, no publication. */
  consented: boolean;
};

const CARLOS_CONTRACTOR_DEMO: Testimonial = {
  quote:
    "I sent the model list before sunrise. The order was staged when I pulled in, and the counter caught a missing disconnect before my crew left for the job.",
  name: "Carlos M.",
  company: "Sample mechanical contractor",
  city: "Fremont, CA",
  trade: "Mechanical contractor",
  image: "/site/testimonials/carlos-contractor-demo.jpg",
  imageAlt: "Fictional mechanical contractor used for a sample testimonial",
  demo: true,
  consented: false,
};

const NINA_FACILITIES_DEMO: Testimonial = {
  quote:
    "For a four-unit retrofit, having stock, submittals, and the pickup window confirmed in one thread kept procurement from holding the install schedule.",
  name: "Nina P.",
  company: "Sample property operations team",
  city: "Oakland, CA",
  trade: "Facilities manager",
  image: "/site/testimonials/nina-facilities-demo.jpg",
  imageAlt: "Fictional facilities manager used for a sample testimonial",
  demo: true,
  consented: false,
};

const JAMIE_HOMEOWNER_DEMO: Testimonial = {
  quote:
    "I knew the room size but not the model number. Summit narrowed it to two in-stock systems and gave me the questions my installer needed to confirm before I paid.",
  name: "Jamie L.",
  city: "San Jose, CA",
  trade: "Homeowner",
  image: "/site/testimonials/jamie-homeowner-demo.jpg",
  imageAlt: "Fictional homeowner used for a sample testimonial",
  demo: true,
  consented: false,
};

const AISHA_HOMEOWNER_DEMO: Testimonial = {
  quote:
    "The equipment was ready in Newark and the delivery steps were exactly as explained. I never felt like I had to pretend I knew contractor terminology.",
  name: "Aisha R.",
  city: "Alameda, CA",
  trade: "Homeowner",
  image: "/site/testimonials/aisha-homeowner-demo.jpg",
  imageAlt: "Fictional homeowner used for a sample testimonial",
  demo: true,
  consented: false,
};

/** Shown on /dealers beside the account application. One strong quote beats three weak ones. */
export const CONTRACTOR_TESTIMONIALS: Testimonial[] = [CARLOS_CONTRACTOR_DEMO];

/** Shown on /homeowners immediately before the installer-help form. Two or three, short. */
export const HOMEOWNER_TESTIMONIALS: Testimonial[] = [
  JAMIE_HOMEOWNER_DEMO,
  AISHA_HOMEOWNER_DEMO,
];

/** Shown on /about, in separate contractor and homeowner sections. */
export const ABOUT_CONTRACTOR_TESTIMONIALS: Testimonial[] = [
  CARLOS_CONTRACTOR_DEMO,
  NINA_FACILITIES_DEMO,
];
export const ABOUT_HOMEOWNER_TESTIMONIALS: Testimonial[] = [
  JAMIE_HOMEOWNER_DEMO,
  AISHA_HOMEOWNER_DEMO,
];

/** Consent gate. Demo fixtures are disclosed and never render in production. */
export function publishable(list: Testimonial[]): Testimonial[] {
  return list.filter((testimonial) => {
    if (testimonial.quote.trim().length === 0) return false;
    if (testimonial.demo) return process.env.NODE_ENV !== "production";
    return testimonial.consented;
  });
}
