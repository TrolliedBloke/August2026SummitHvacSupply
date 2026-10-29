import { createHash } from "node:crypto";
import type { FinderSegment } from "./finder/questions";

export const AUDIENCE_SEGMENTS = ["contractor", "homeowner_active", "homeowner_researching", "customer"] as const;
export const audienceMinimum = (segment: FinderSegment) => segment === "customer" ? 100 : 250;
export const audiencePurpose = (segment: FinderSegment) => segment === "customer" ? "exclude" : "target";

export function groupAudienceEmails(
  consentEmails: string[],
  sessions: Array<{ email: string | null; segment: string | null; completed_at: string | null }>,
  paidEmails: string[],
): Record<FinderSegment, string[]> {
  const groups: Record<FinderSegment, string[]> = { contractor: [], homeowner_active: [], homeowner_researching: [], customer: [] };
  const normalized = (email: string) => email.trim().toLowerCase();
  const paid = new Set(paidEmails.map(normalized));
  const latest = new Map<string, FinderSegment>();
  for (const session of [...sessions].filter((row) => row.email && row.completed_at).sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))) {
    const email = normalized(session.email!);
    if (!latest.has(email) && AUDIENCE_SEGMENTS.includes(session.segment as FinderSegment)) latest.set(email, session.segment as FinderSegment);
  }
  for (const email of new Set(consentEmails.map(normalized))) {
    const segment = paid.has(email) ? "customer" : latest.get(email);
    if (segment) groups[segment].push(email);
  }
  return groups;
}

export function hashedAudienceCsv(emails: string[]): string {
  return `email\r\n${[...new Set(emails.map((email) => email.trim().toLowerCase()))].sort().map((email) => createHash("sha256").update(email).digest("hex")).join("\r\n")}\r\n`;
}
