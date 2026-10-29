/**
 * Contact routing. Each topic names the queue that owns it, the response the
 * customer is promised, whether it can be marked urgent, and which structured
 * context fields it collects -- so support can route and answer without
 * parsing prose.
 *
 * Summit does not run emergency service. "Urgent" never promises a faster
 * written reply; it tells the customer to call, which is the real fast path.
 *
 * TODO(summit-ops): confirm each queue owner and response window.
 */

export type ContactContextField = "sku" | "orderRef" | "branchId" | "zip";

export type ContactTopic = {
  value: string;
  label: string;
  queue: "sales" | "orders" | "support" | "accounts";
  /** Shown before and after submitting. */
  responseWindow: string;
  allowsUrgent: boolean;
  fields: ContactContextField[];
};

export const CONTACT_TOPICS: readonly ContactTopic[] = [
  { value: "product", label: "A product, model or compatibility question", queue: "sales", responseWindow: "after staff review", allowsUrgent: false, fields: ["sku"] },
  { value: "quote", label: "Pricing or a quote for a job", queue: "sales", responseWindow: "after staff review", allowsUrgent: false, fields: ["sku", "zip"] },
  { value: "order", label: "An order I placed", queue: "orders", responseWindow: "after orders-desk review; call for time-sensitive changes", allowsUrgent: true, fields: ["orderRef"] },
  { value: "delivery", label: "Delivery or will-call pickup", queue: "orders", responseWindow: "after orders-desk review; call for time-sensitive changes", allowsUrgent: true, fields: ["orderRef", "branchId", "zip"] },
  { value: "returns", label: "A return, warranty or damaged unit", queue: "support", responseWindow: "after staff review", allowsUrgent: false, fields: ["orderRef", "sku"] },
  { value: "account", label: "My account or trade access", queue: "accounts", responseWindow: "after staff review", allowsUrgent: false, fields: [] },
  { value: "other", label: "Something else", queue: "support", responseWindow: "after staff review", allowsUrgent: false, fields: [] },
] as const;

export function contactTopic(value: string | null | undefined): ContactTopic | null {
  return CONTACT_TOPICS.find((topic) => topic.value === value) ?? null;
}

/** Older topic values from links and the homeowner form, mapped forward. */
const LEGACY_TOPICS: Record<string, string> = {
  one_system: "product",
  installer: "other",
  contractor: "quote",
  property: "quote",
  specs: "product",
};

export function canonicalTopic(value: string | null | undefined): string | null {
  if (!value) return null;
  return contactTopic(value)?.value ?? LEGACY_TOPICS[value] ?? null;
}
