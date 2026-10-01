import { Check, Clock, HelpCircle, PackageX } from "lucide-react";
import type { CommerceState } from "@/lib/commerce/state";
import { presentCommerceState } from "@/lib/commerce/state";

/**
 * The product page's availability line, rendered from CommerceState. A
 * counted shelf shows its number; every state carries an icon and words, so
 * color is never the only difference between "ready" and "confirm first".
 */
export function CommerceStatusLine({ state, className = "" }: { state: CommerceState; className?: string }) {
  const view = presentCommerceState(state);
  const stock = "stock" in state && state.stock.kind === "verified" && state.stock.quantity > 0 ? state.stock : null;
  const Icon = view.tone === "ready" ? Check : view.tone === "blocked" ? PackageX : stock ? Check : view.kind === "quoteRequired" ? Clock : HelpCircle;
  return (
    <div className={className}>
      <div className="flex items-baseline gap-3">
        {stock && <span className="tnum text-3xl font-medium leading-none text-stock-ready">{stock.quantity}</span>}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            view.tone === "ready" || stock ? "bg-state-success text-state-success-ink" : "border border-line bg-surface-2 text-ink-2"
          }`}
        >
          <Icon size={13} aria-hidden="true" />
          {view.statusLabel}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-ink-2">{view.statusDetail}</p>
    </div>
  );
}
