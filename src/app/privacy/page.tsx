import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document";
import { LEGAL_DOCUMENTS } from "@/content/legal/registry";

export const metadata: Metadata = {
  title: "Privacy Policy & California Privacy Rights",
  description:
    "How Summit HVAC Supply collects, uses, and protects personal information, including California privacy rights under the CCPA/CPRA.",
};

/* Content, version and section ids live in src/content/legal/privacy.tsx. */
export default function PrivacyPage() {
  return <LegalDocumentPage document={LEGAL_DOCUMENTS.privacy} />;
}
