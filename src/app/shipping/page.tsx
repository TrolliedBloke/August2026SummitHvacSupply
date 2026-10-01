import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document";
import { LEGAL_DOCUMENTS } from "@/content/legal/registry";
import { FulfillmentAnswer } from "@/components/fulfillment-answer";

export const metadata: Metadata = {
  title: "Shipping, Delivery & Newark Will-Call Pickup",
  description:
    "Newark will-call pickup, Bay Area jobsite delivery, and LTL freight for HVAC equipment. Lead times, freight handling, and delivery requirements.",
};

/* Content, version and section ids live in src/content/legal/shipping.tsx.
   /shipping owns the long-form terms; the answer card at the top is the same
   calculator projection /delivery and checkout use, so a cutoff or date can
   never differ between them. */
export default function ShippingPage() {
  return (
    <LegalDocumentPage
      document={LEGAL_DOCUMENTS.shipping}
      lead={<FulfillmentAnswer compact title="Delivery to your ZIP" />}
    />
  );
}
