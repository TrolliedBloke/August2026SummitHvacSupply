import type { Metadata } from "next";
import Link from "next/link";
import { Container, Eyebrow } from "@/components/ui";
import { WarrantyClaimForm } from "@/components/warranty/warranty-claim-form";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Warranty Claim - Equipment Bought from Summit HVAC Supply",
  description: "File a warranty claim for HVAC equipment bought from Summit HVAC Supply. We coordinate the claim with the manufacturer.",
};

export default async function WarrantyPage({ searchParams }: PageProps<"/warranty">) {
  const { order } = (await searchParams) as { order?: string };
  const initialOrder = typeof order === "string" && /^[A-Za-z0-9-]{3,40}$/.test(order) ? order : "";
  return (
    <Container className="py-12 lg:py-16">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 max-w-2xl">
          <Eyebrow>Warranty</Eyebrow>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">File a warranty claim</h1>
          <p className="mt-3 text-ink-2">
            For installed equipment that has stopped working. The manufacturer decides warranty cover; we open the claim with them for you and
            keep you posted.
          </p>
          <div className="mt-8">
            <WarrantyClaimForm initialOrder={initialOrder} />
          </div>
        </div>
        <aside className="h-fit rounded-(--r-md) border border-line bg-surface-1 p-6 text-sm text-ink-2">
          <h2 className="font-semibold text-ink-1">Have these ready</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>Model and serial number from the unit&apos;s data label</li>
            <li>Install date, and the installer&apos;s name and CSLB license number</li>
            <li>Any error code, and photos of the label and the problem</li>
            <li>The manufacturer registration confirmation, if you registered it</li>
          </ul>
          <p className="mt-4">
            Not installed yet, or arrived damaged? That&apos;s a <Link href="/returns" className="font-medium text-ink-1 underline underline-offset-4">return</Link>, not a warranty claim.
          </p>
          <p className="mt-4">
            Urgent, like no heat or cooling? Call <a href={`tel:${SITE.phone.replace(/[^0-9+]/g, "")}`} className="font-medium text-ink-1 underline underline-offset-4">{SITE.phone}</a>.
          </p>
        </aside>
      </div>
    </Container>
  );
}
