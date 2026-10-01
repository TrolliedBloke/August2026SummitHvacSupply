import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { LegalDocumentPage } from "@/components/legal-document";
import { LEGAL_ARCHIVE, LEGAL_DOCUMENTS } from "@/content/legal/registry";
import type { LegalDocument } from "@/content/legal/schema";

/**
 * Stable archive URLs: /legal/<document>/<version>. Every published version
 * stays reachable here, anchors included. The current version redirects to
 * its canonical path, so there is only ever one live copy.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.entries(LEGAL_ARCHIVE).flatMap(([document, versions]) =>
    Object.keys(versions).map((version) => ({ document, version }))
  );
}

function lookup(document: string, version: string): LegalDocument | null {
  return LEGAL_ARCHIVE[document as LegalDocument["id"]]?.[version] ?? null;
}

export async function generateMetadata({ params }: PageProps<"/legal/[document]/[version]">): Promise<Metadata> {
  const { document, version } = await params;
  const found = lookup(document, version);
  if (!found) return { title: "Document not found" };
  return {
    title: `${found.title} (version ${found.version})`,
    robots: { index: false, follow: true },
    alternates: { canonical: LEGAL_DOCUMENTS[found.id].path },
  };
}

export default async function ArchivedLegalDocument({ params }: PageProps<"/legal/[document]/[version]">) {
  const { document, version } = await params;
  const found = lookup(document, version);
  if (!found) notFound();
  const current = LEGAL_DOCUMENTS[found.id];
  if (current.version === found.version) permanentRedirect(current.path);
  return <LegalDocumentPage document={found} archived currentVersion={current.version} />;
}
