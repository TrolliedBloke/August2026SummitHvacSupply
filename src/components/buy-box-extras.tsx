import { Download, MessageSquare, Phone } from "lucide-react";
import { SITE } from "@/lib/site";
import type { StorefrontSku } from "@/lib/storefront/catalog";

/* Answers a contractor needs before committing, placed in the decision panel
   instead of below the fold: the documents that confirm fit, the parts the
   install will also need, and a person to ask. */

const BUY_BOX_DOCUMENT_LIMIT = 4;

interface BuyBoxDocumentsProps {
  documents: StorefrontSku["documents"];
}

export function BuyBoxDocuments({ documents }: BuyBoxDocumentsProps) {
  if (documents.length === 0) return null;
  const shown = documents.slice(0, BUY_BOX_DOCUMENT_LIMIT);
  const more = documents.length - shown.length;

  return (
    <div className="mt-5 border-t border-line pt-4" data-buy-box-documents>
      <h2 className="text-sm font-medium text-ink-1">Documents</h2>
      <ul className="mt-2 space-y-1.5 text-sm">
        {shown.map((document) => (
          <li key={document.url}>
            <a href={document.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 text-ink-2 hover:text-brand">
              <Download size={14} className="mt-1 shrink-0 text-ink-3" aria-hidden="true" />
              <span className="underline-offset-4 hover:underline">{document.title}</span>
            </a>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <a href="#documents" className="mt-2 inline-block text-xs font-medium text-brand hover:text-brand-hover">
          All {documents.length} documents
        </a>
      )}
    </div>
  );
}

/** Plain words for the accessory categories getRecommendedAccessorySkus draws from. */
const ACCESSORY_LABELS: Record<string, string> = {
  "line-sets": "line set",
  "installation-supplies": "pad, disconnect or wire",
  controls: "thermostat",
  "evaporator-coils": "evaporator coil",
};

interface OrderedSeparatelyProps {
  accessories: readonly StorefrontSku[];
  /** Anchor of the section that lists the accessories. */
  targetId: string;
}

/** Names what the install usually also needs, from the accessories actually recommended for this unit. */
export function OrderedSeparately({ accessories, targetId }: OrderedSeparatelyProps) {
  const labels = [...new Set(accessories.map((item) => ACCESSORY_LABELS[item.category]).filter(Boolean))];
  if (labels.length === 0) return null;

  return (
    <p className="mt-4 text-sm leading-6 text-ink-2" data-ordered-separately>
      <span className="font-medium text-ink-1">Usually ordered separately:</span> {labels.join(" · ")}.{" "}
      <a href={`#${targetId}`} className="font-medium text-brand underline-offset-4 hover:underline">See matching parts</a>
    </p>
  );
}

/** The Newark counter as a person to reach, not a footer address. */
export function CounterCard() {
  return (
    <div className="mt-5 rounded-(--r-md) border border-line bg-surface-1 p-4" data-counter-card>
      <p className="text-sm font-medium text-ink-1">Questions about this unit?</p>
      <p className="mt-1 text-sm text-ink-2">The Newark counter can check fit, stock and pairing. {SITE.counterHours}.</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <a href={SITE.phoneHref} className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-hover">
          <Phone size={14} aria-hidden="true" /> Call {SITE.phone}
        </a>
        <a href={SITE.smsHref} className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-hover">
          <MessageSquare size={14} aria-hidden="true" /> Text the counter
        </a>
      </div>
    </div>
  );
}
