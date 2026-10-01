import { PRIVACY } from "./privacy";
import { TERMS } from "./terms";
import { RETURNS } from "./returns";
import { SHIPPING } from "./shipping";
import { TERMS_1_0 } from "./archive/terms-1.0";
import { SHIPPING_1_0 } from "./archive/shipping-1.0";
import type { LegalDocument } from "./schema";

/** Current, canonical versions. */
export const LEGAL_DOCUMENTS: Record<LegalDocument["id"], LegalDocument> = {
  privacy: PRIVACY,
  terms: TERMS,
  returns: RETURNS,
  shipping: SHIPPING,
};

/**
 * Every published version, current included, by document and version. Each
 * has a stable archive URL: /legal/<document>/<version>.
 */
export const LEGAL_ARCHIVE: Record<LegalDocument["id"], Record<string, LegalDocument>> = {
  privacy: { [PRIVACY.version]: PRIVACY },
  terms: { [TERMS_1_0.version]: TERMS_1_0, [TERMS.version]: TERMS },
  returns: { [RETURNS.version]: RETURNS },
  shipping: { [SHIPPING_1_0.version]: SHIPPING_1_0, [SHIPPING.version]: SHIPPING },
};

export function archiveHref(id: LegalDocument["id"], version: string): string {
  return `/legal/${id}/${version}`;
}
