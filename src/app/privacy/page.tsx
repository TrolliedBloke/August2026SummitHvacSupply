import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumentPage } from "@/components/legal-document";
import { LEGAL_DOCUMENTS } from "@/content/legal/registry";

export const metadata: Metadata = {
  title: "Privacy Policy & California Privacy Rights",
  description:
    "How Summit HVAC Supply collects, uses, and protects personal information, including California privacy rights under the CCPA/CPRA.",
};

/* Content, version and section ids live in src/content/legal/privacy.tsx. The
   request link sits outside the versioned document, so adding it changes no
   published policy text. */
export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      document={LEGAL_DOCUMENTS.privacy}
      lead={
        <section aria-labelledby="privacy-request-title" className="rounded-(--r-md) border border-line bg-surface-1 p-5 sm:p-7">
          <h2 id="privacy-request-title" className="text-lead font-semibold text-ink-1">Your privacy rights</h2>
          <p className="mt-2 text-sm text-ink-2">Ask what we hold about you, or ask us to delete or correct it. We confirm the request by email and respond within 45 days.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/privacy/request" className="inline-flex min-h-11 items-center rounded-(--r-sm) bg-brand px-4 text-sm font-medium text-brand-ink hover:bg-brand/90">
              Make a privacy request
            </Link>
            <Link href="/privacy/opt-out" className="inline-flex min-h-11 items-center rounded-(--r-sm) border border-line bg-surface-1 px-4 text-sm font-medium text-ink-1 hover:bg-surface-2">
              Opt out of sale or sharing
            </Link>
          </div>
        </section>
      }
    />
  );
}
