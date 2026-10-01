/**
 * Model and part-number identifiers: one normalizer and one ranker for every
 * entry point -- the model-number decoder, the AHRI lookup, quick order, CSV
 * import and the cross-reference table. Two normalizers used to exist and could
 * give different answers for the same nameplate.
 *
 * Ranking is deterministic and conservative:
 *   exact      the code as written, ignoring case only
 *   normalized the same code once spaces, dashes and slashes are removed
 *   prefix     the code starts with what was typed
 *   contains   what was typed starts at a token boundary inside the code
 *   suggestion an OCR confusion (O/0, I/1, S/5, B/8, Z/2), a dropped leading
 *              zero, or a one-character slip -- shown as "Did you mean",
 *              never treated as a match
 *
 * Nothing here claims compatibility. Only a verified row in the cross-reference
 * table may produce a `cross_reference` outcome.
 */

export const MIN_IDENTIFIER_LENGTH = 3;
export const MAX_VISIBLE_CANDIDATES = 6;

export type IdentifierField = "sku" | "model" | "sourceSku" | "ahri";

export type IdentifierRecord = {
  id: string;
  codes: Array<{ value: string; field: IdentifierField }>;
};

export type MatchType = "exact" | "normalized" | "prefix" | "contains" | "suggestion";

export type Candidate = {
  id: string;
  matchType: MatchType;
  score: number;
  field: IdentifierField;
  code: string;
  /** Why a suggestion was offered: "ocr", "leading_zero", "typo". */
  reason?: "ocr" | "leading_zero" | "typo";
};

/** Uppercase, alphanumerics only. "tsc-09ha2/i3ti23 " -> "TSC09HA2I3TI23". */
export function normalizeIdentifier(raw: string): string {
  return raw.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const OCR_MAP: Record<string, string> = { O: "0", I: "1", L: "1", S: "5", B: "8", Z: "2" };

/** Collapse characters a camera or a tired eye confuses, both directions. */
export function ocrForm(normalized: string): string {
  return normalized.replace(/[OILSBZ]/g, (char) => OCR_MAP[char] ?? char);
}

/** Drop leading zeros from every digit run: "TCL09K" -> "TCL9K". */
export function leadingZeroForm(normalized: string): string {
  return normalized.replace(/(^|[A-Z])0+(?=\d)/g, "$1");
}

/** Offsets in the normalized code where a token starts (separators and letter/digit switches). */
function tokenStarts(raw: string): Set<number> {
  const starts = new Set<number>([0]);
  let index = 0;
  let previous: "alpha" | "digit" | "sep" = "sep";
  for (const char of raw.toUpperCase()) {
    const kind = /[A-Z]/.test(char) ? "alpha" : /\d/.test(char) ? "digit" : "sep";
    if (kind === "sep") {
      previous = "sep";
      continue;
    }
    if (previous === "sep" || previous !== kind) starts.add(index);
    previous = kind;
    index += 1;
  }
  return starts;
}

function editDistance(a: string, b: string, ceiling: number): number {
  if (Math.abs(a.length - b.length) > ceiling) return ceiling + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > ceiling) return ceiling + 1;
    previous = current;
  }
  return previous[b.length];
}

const FIELD_WEIGHT: Record<IdentifierField, number> = { sku: 3, model: 2, sourceSku: 1, ahri: 0 };

/** Score one code against a query. Null when it does not match at any tier. */
export function matchIdentifier(rawQuery: string, code: string): Omit<Candidate, "id" | "field"> | null {
  const query = normalizeIdentifier(rawQuery);
  const normalizedCode = normalizeIdentifier(code);
  if (!query || !normalizedCode) return null;

  if (rawQuery.trim().toUpperCase() === code.trim().toUpperCase()) return { matchType: "exact", score: 100, code };
  if (query === normalizedCode) return { matchType: "normalized", score: 90, code };
  if (normalizedCode.startsWith(query)) {
    // Shorter remainders rank higher: "TCL24" is closer to "TCL24K" than to "TCL24KAHUXX".
    return { matchType: "prefix", score: 70 - Math.min(15, normalizedCode.length - query.length), code };
  }
  const at = normalizedCode.indexOf(query);
  if (at > 0 && tokenStarts(code).has(at)) {
    return { matchType: "contains", score: 50 - Math.min(10, normalizedCode.length - query.length), code };
  }
  if (query.length < 5) return null;
  if (ocrForm(query) === ocrForm(normalizedCode)) return { matchType: "suggestion", score: 30, code, reason: "ocr" };
  if (leadingZeroForm(query) === leadingZeroForm(normalizedCode)) return { matchType: "suggestion", score: 29, code, reason: "leading_zero" };
  if (query.length >= 6) {
    const ceiling = query.length >= 10 ? 2 : 1;
    if (editDistance(query, normalizedCode, ceiling) <= ceiling) return { matchType: "suggestion", score: 20, code, reason: "typo" };
  }
  return null;
}

/** Best candidate per record, ranked: score, then field (SKU before model), then code. */
export function rankIdentifiers(rawQuery: string, records: IdentifierRecord[]): Candidate[] {
  const out: Candidate[] = [];
  for (const record of records) {
    let best: Candidate | null = null;
    for (const { value, field } of record.codes) {
      if (!value) continue;
      const match = matchIdentifier(rawQuery, value);
      if (!match) continue;
      const candidate: Candidate = { ...match, id: record.id, field };
      if (
        !best ||
        candidate.score > best.score ||
        (candidate.score === best.score && FIELD_WEIGHT[field] > FIELD_WEIGHT[best.field])
      ) {
        best = candidate;
      }
    }
    if (best) out.push(best);
  }
  return out.sort(
    (a, b) => b.score - a.score || FIELD_WEIGHT[b.field] - FIELD_WEIGHT[a.field] || a.code.localeCompare(b.code)
  );
}

export type VerifiedCrossReference = {
  /** The other manufacturer's model, as printed. */
  sourceModel: string;
  skuIds: string[];
  /** Who verified it and against what -- required, or the row is not used. */
  verifiedBy: string;
  evidenceUrl: string;
};

export type IdentifierOutcome =
  | { kind: "invalid"; reason: "empty" | "no_alphanumerics" }
  | { kind: "too_short"; minLength: number }
  | { kind: "no_coverage"; normalized: string; suggestions: Candidate[] }
  | { kind: "exact"; match: Candidate; others: Candidate[] }
  | { kind: "ambiguous"; candidates: Candidate[]; total: number }
  | { kind: "cross_reference"; reference: VerifiedCrossReference };

export function resolveIdentifier(
  rawQuery: string,
  records: IdentifierRecord[],
  crossReferences: VerifiedCrossReference[] = []
): IdentifierOutcome {
  if (!rawQuery.trim()) return { kind: "invalid", reason: "empty" };
  const normalized = normalizeIdentifier(rawQuery);
  if (!normalized) return { kind: "invalid", reason: "no_alphanumerics" };
  if (normalized.length < MIN_IDENTIFIER_LENGTH) return { kind: "too_short", minLength: MIN_IDENTIFIER_LENGTH };

  const reference = crossReferences.find(
    (row) => row.verifiedBy && row.evidenceUrl && normalizeIdentifier(row.sourceModel) === normalized
  );
  if (reference) return { kind: "cross_reference", reference };

  const ranked = rankIdentifiers(rawQuery, records);
  const exact = ranked.filter((candidate) => candidate.matchType === "exact" || candidate.matchType === "normalized");
  if (exact.length === 1) {
    return { kind: "exact", match: exact[0], others: ranked.filter((candidate) => candidate !== exact[0]).slice(0, MAX_VISIBLE_CANDIDATES - 1) };
  }
  const matches = ranked.filter((candidate) => candidate.matchType !== "suggestion");
  if (matches.length > 0) {
    return { kind: "ambiguous", candidates: matches.slice(0, MAX_VISIBLE_CANDIDATES), total: matches.length };
  }
  return { kind: "no_coverage", normalized, suggestions: ranked.slice(0, 3) };
}

export const MATCH_LABEL: Record<MatchType, string> = {
  exact: "Exact match",
  normalized: "Exact match",
  prefix: "Starts with your entry",
  contains: "Contains your entry",
  suggestion: "Suggestion",
};

export const SUGGESTION_REASON: Record<NonNullable<Candidate["reason"]>, string> = {
  ocr: "Similar characters (for example O and 0)",
  leading_zero: "Leading zero differs",
  typo: "One character differs",
};
