import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Home, Ruler, ShieldCheck, Users } from "lucide-react";
import { Container, Eyebrow, LinkButton } from "@/components/ui";
import { HomeownerRequestForm } from "@/components/homeowner-request-form";
import { HeroRoutingPanel } from "@/components/homepage-conversion-tools";
import { TestimonialSlot } from "@/components/testimonial-slot";
import { HOMEOWNER_TESTIMONIALS } from "@/lib/testimonials";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "For Homeowners - Buy One TCL Mini Split or Heat Pump in the Bay Area",
  description:
    "Retail-friendly Bay Area guide for homeowners buying one TCL mini split or heat pump, understanding installation, rebates, and installer matching.",
  alternates: { canonical: "/homeowners" },
};

const faq = [
  {
    q: "Can I buy equipment without being a contractor?",
    a: "Yes. You can ask about one TCL mini split or heat pump without a contractor account. Some equipment may still require professional installation and startup for safety, warranty, and rebate eligibility.",
  },
  {
    q: "Do I need an installer?",
    a: "In almost every real project, yes. Heat pumps and mini splits involve electrical, refrigerant, condensate, line-set, mounting, and permit considerations. Summit supplies equipment and can help you connect with a qualified Bay Area installer.",
  },
  {
    q: "What does Summit provide?",
    a: "Summit helps with equipment guidance, stock availability, spec sheets, rebate context, and installer referral. We are not the installing contractor.",
  },
  {
    q: "What does the installer provide?",
    a: "The installer confirms sizing, placement, electrical requirements, permits, installation labor, startup, and final project pricing.",
  },
  {
    q: "How much does a Bay Area heat pump project involve?",
    a: "The equipment is only one part. Installation scope, electrical work, line-set routing, permits, wall penetrations, and rebate documentation can materially affect the final project.",
  },
];

export default function HomeownersPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <section className="border-b border-line bg-surface-1">
        <Container className="grid gap-10 py-14 lg:grid-cols-[1fr_0.85fr] lg:py-20">
          <div>
            <Eyebrow>For Bay Area homeowners</Eyebrow>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
              Buying one TCL mini split or heat pump? You are in the right place.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">
              Summit HVAC Supply can help you understand equipment options,
              rebate questions, and Bay Area installer next steps. We supply the
              equipment from Newark; qualified local contractors handle installation.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="#homeowner-request" size="lg">
                Get Bay Area installer help <ArrowRight size={18} />
              </LinkButton>
              <LinkButton href="/bay-area-heat-pump-rebates" variant="secondary" size="lg">
                See rebate options
              </LinkButton>
            </div>
          </div>
          <div className="flex flex-col gap-5">
            {/* Relocated from the homepage hero -- ZIP + role routing earns its
                keep here, inside the installer-matching flow. */}
            <HeroRoutingPanel />
            <div className="overflow-hidden rounded-(--r-md) border border-line bg-canvas shadow-[var(--shadow-sm)]">
            <div className="p-5">
            <h2 className="font-display text-lg font-semibold text-ink-1">
              What we do and do not do
            </h2>
            <div className="mt-4 grid gap-3">
              <Proof title="Yes, one system is okay" body="You do not need to be buying a truckload or know the exact SKU." />
              <Proof title="Equipment supply only" body="We do not install. We help you prepare for a qualified installer conversation." />
              <Proof title="Local Bay Area focus" body={`Newark supply hub serving ${SITE.serviceArea}.`} />
            </div>
            </div>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-14 lg:py-16">
        <div className="grid gap-5 md:grid-cols-4">
          <Step icon={<Home size={20} />} title="1. Describe the home" body="ZIP, city, room count, ducts, timeline, and comfort problem." />
          <Step icon={<Ruler size={20} />} title="2. Pick the likely lane" body="Single-room mini split, multi-zone, ducted heat pump, or property quote." />
          <Step icon={<ShieldCheck size={20} />} title="3. Check rebate questions" body="Ask about AHRI matchups, eligible equipment, and installer enrollment." />
          <Step icon={<Users size={20} />} title="4. Use a contractor" body="A qualified installer confirms sizing, labor, permits, and startup." />
        </div>
      </Container>

      <section className="border-y border-line bg-surface-1 py-14 lg:py-16">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Eyebrow>Plain-English answers</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-1">
              The questions retail buyers usually have first.
            </h2>
            <p className="mt-3 text-ink-2">
              The goal is not to make you act like a contractor. It is to help
              you ask the right questions before money is spent.
            </p>
          </div>
          <div className="grid gap-3">
            {faq.map((item) => (
              <div key={item.q} className="rounded-(--r-md) border border-line bg-canvas p-5">
                <h3 className="font-display text-base font-semibold text-ink-1">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{item.a}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Homeowner proof sits immediately before the installer-help form.
          Demo fixtures are disclosed in development; production stays empty
          until consented customer quotes replace them. */}
      <TestimonialSlot
        items={HOMEOWNER_TESTIMONIALS}
        heading="What other Bay Area homeowners found"
        className="border-t border-line bg-surface-1 px-5 py-14 sm:px-6 lg:px-8 [&>*]:mx-auto [&>*]:max-w-[1180px]"
      />

      <section id="homeowner-request">
        <Container className="py-14 lg:py-16">
          <HomeownerRequestForm />
        </Container>
      </section>
    </>
  );
}

function Proof({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-(--r-sm) border border-line bg-surface-1 p-3">
      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-eco" />
      <div>
        <h3 className="text-sm font-semibold text-ink-1">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{body}</p>
      </div>
    </div>
  );
}

function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-(--r-md) border border-line bg-surface-1 p-5 shadow-[var(--shadow-sm)]">
      <span className="grid size-11 place-items-center rounded-(--r-sm) bg-brand-tint text-brand">{icon}</span>
      <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-ink-1">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}
