import type { ReactNode } from "react";

/**
 * Legal and policy documents as data. Each section carries a permanent,
 * author-controlled id -- the deep-link target, the table-of-contents entry
 * and the archive anchor -- so the page structure is generated, not
 * hand-maintained.
 */
export type LegalDefinition = {
  /** Permanent anchor, e.g. "def-equipment". */
  id: string;
  term: string;
  definition: ReactNode;
};

export type LegalSection = {
  id: string;
  heading: string;
  body: ReactNode;
  definitions?: LegalDefinition[];
};

export type LegalVersion = {
  version: string;
  effectiveDate: string;
  /** Plain-language summary of what changed in this version. */
  summary: string[];
};

export type LegalDocument = {
  id: "privacy" | "terms" | "returns" | "shipping";
  /** Canonical path of the current version. */
  path: string;
  eyebrow: string;
  title: string;
  intro: string;
  version: string;
  effectiveDate: string;
  updatedDate: string;
  owner: string;
  review: { status: "pending_counsel" | "approved"; reviewedAt: string | null };
  /** Newest first. The first entry is this version. */
  history: LegalVersion[];
  sections: LegalSection[];
};

export function formatLegalDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}
