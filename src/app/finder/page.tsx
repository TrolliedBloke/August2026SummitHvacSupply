import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, Phone, SlidersHorizontal } from "lucide-react";
import { Container } from "@/components/ui";
import { Finder } from "@/components/finder/finder";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Heat Pump & Mini Split System Finder",
  description: "Answer a few plain-language questions to get a starting HVAC system recommendation and next steps from Summit HVAC Supply.",
  path: "/finder",
});

const steps = [
  { icon: ClipboardList, title: "Tell us about the space", body: "Answer a few questions about your home, rooms, ducts, and ZIP code." },
  { icon: SlidersHorizontal, title: "Compare suitable equipment", body: "We check the catalog and show a starting size and matched options." },
  { icon: ArrowRight, title: "Review next steps", body: "Take the shortlist to a qualified local installer for final sizing and permits." },
] as const;

export default function FinderPage() {
  return (
    <>
      <section className="bg-[#1F2A44] text-white">
        <Container className="py-12 sm:py-16 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f0b62a]">Homeowner system finder</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-.035em] sm:text-5xl">Start with the right questions, not a guess.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-7 text-white/80">Tell us what you are trying to heat or cool. We will give you a practical starting point, then show what to confirm with a local installer.</p>
            <div className="mt-7 flex flex-wrap gap-3 text-sm"><span className="rounded-full border border-white/25 px-3 py-1.5">Free to use</span><span className="rounded-full border border-white/25 px-3 py-1.5">No account needed</span><span className="rounded-full border border-white/25 px-3 py-1.5">About five questions</span></div>
          </div>
        </Container>
      </section>

      <section className="bg-white py-10 sm:py-12"><Container><div className="grid gap-4 md:grid-cols-3">{steps.map(({ icon: Icon, title, body }, index) => <div key={title} className="rounded-md border border-slate-200 bg-[#edf2f7] p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#1F2A44] text-[#f0b62a]"><Icon size={18} /></span><span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a6512]">Step {index + 1}</span></div><h2 className="mt-4 text-lg font-semibold text-[#1F2A44]">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}</div></Container></section>

      <section className="bg-[#f4f4f2] py-10 sm:py-14"><Container><div className="mx-auto max-w-4xl"><div className="mb-6 max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8a6512]">Let&apos;s get started</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#1F2A44]">Which best describes what you need?</h2><p className="mt-2 text-base leading-6 text-slate-600">Choose a path below. You can skip questions you do not know yet.</p></div><Finder landing /></div></Container></section>

      <section className="bg-white py-8"><Container><div className="flex flex-col gap-3 rounded-md border border-[#d8c28a] bg-[#fff8e8] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold text-[#1F2A44]">Prefer to talk it through?</h2><p className="mt-1 text-sm text-slate-600">Call the Newark counter or send a request and we&apos;ll point you in the right direction.</p></div><div className="flex flex-wrap gap-3"><a href={SITE.phoneHref} className="inline-flex h-11 items-center gap-2 rounded border border-[#1F2A44] px-4 text-sm font-semibold text-[#1F2A44]"><Phone size={16} /> {SITE.phone}</a><Link href="/contact?topic=product" className="inline-flex h-11 items-center gap-2 rounded bg-[#1F2A44] px-4 text-sm font-semibold text-white">Send a request <ArrowRight size={16} /></Link></div></div></Container></section>
    </>
  );
}
