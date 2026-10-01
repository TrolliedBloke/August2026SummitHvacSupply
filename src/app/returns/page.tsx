import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document";
import { LEGAL_DOCUMENTS } from "@/content/legal/registry";
import { ReturnChecker } from "@/components/returns/return-checker";

export const metadata: Metadata = {
  title: "Returns & Refunds - 30-Day Policy & Freight Damage Claims",
  description:
    "30-day returns on unopened HVAC equipment. Freight damage, restocking fees, warranty claims, and how to start a return from Newark, CA.",
};

/* Content, version and section ids live in src/content/legal/returns.tsx. */
export default function ReturnsPage() {
  return <LegalDocumentPage document={LEGAL_DOCUMENTS.returns} lead={<ReturnChecker />} />;
}
