import Link from "next/link";
import { ArrowRight, BadgeDollarSign, ClipboardCheck, FileSearch, HardHat, ShieldAlert, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui";

interface Tool {
  title: string;
  body: string;
  href: string;
  icon: LucideIcon;
}

/* The help Summit gives that an online-only store does not. Every tile links to
   a page that already exists; until this row they were reachable only from the
   footer. */
const TOOLS: readonly Tool[] = [
  { title: "System finder", body: "Five questions to a matched system", href: "/finder", icon: SlidersHorizontal },
  { title: "Model decoder", body: "Find a product from the nameplate", href: "/tools/model-number-decoder", icon: FileSearch },
  { title: "A2L refrigerant guide", body: "R-454B and R-32, what changes", href: "/guides/r-32-r-454b-a2l-transition", icon: ShieldAlert },
  { title: "Rebates by ZIP", body: "Programs to check for your project", href: "/tools/rebate-lookup", icon: BadgeDollarSign },
  { title: "Permit guide", body: "Bay Area changeout permits", href: "/guides/bay-area-hvac-permits", icon: ClipboardCheck },
  { title: "Find an installer", body: "Help connecting with a contractor", href: "/homeowners#homeowner-request", icon: HardHat },
];

export function ToolsRow() {
  return (
    <section aria-labelledby="tools-heading" className="bg-white py-9 sm:py-12">
      <Container>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="tools-heading" className="text-[26px] font-semibold tracking-[-.03em] text-[#1F2A44]">
              Plan the job before you buy
            </h2>
            <p className="mt-1 text-sm text-slate-600">Free tools and Bay Area guidance from the Newark counter.</p>
          </div>
          <Link href="/resources" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-[#b5770b] sm:inline-flex">
            All resources <ArrowRight size={16} />
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TOOLS.map(({ title, body, href, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full min-h-[128px] flex-col gap-2 rounded-md border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#e3a11b] hover:shadow-[0_2px_7px_rgba(31,42,68,.08)]"
              >
                <Icon className="size-6 text-[#b5770b]" strokeWidth={1.75} aria-hidden="true" />
                <span className="text-[15px] font-semibold leading-5 text-[#1F2A44]">{title}</span>
                <span className="text-xs leading-4 text-slate-600">{body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
