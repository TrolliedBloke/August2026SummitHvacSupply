import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document";
import { LEGAL_DOCUMENTS } from "@/content/legal/registry";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing purchases from Summit HVAC Supply: pricing, orders, installation responsibility, warranty, and liability.",
};

/* Content, version and section ids live in src/content/legal/terms.tsx. */
export default function TermsPage() {
  return <LegalDocumentPage document={LEGAL_DOCUMENTS.terms} />;
}
