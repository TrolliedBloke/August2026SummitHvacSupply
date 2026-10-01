import { z } from "zod";
import { CONTACT_TOPICS } from "@/lib/contact-topics";

/**
 * The contact form's one schema, shared by the browser (validation before
 * submit) and the API (authoritative validation). Messages are written for the
 * person filling the form in.
 */
const TOPIC_VALUES = CONTACT_TOPICS.map((topic) => topic.value) as [string, ...string[]];
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ./_-]{1,59}$/;
const ORDER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{3,39}$/;

export const contactFormSchema = z.object({
  topic: z.enum(TOPIC_VALUES, { message: "Choose what you are reaching out about." }),
  name: z.string().trim().min(2, "Enter your name.").max(120, "Use 120 characters or fewer."),
  email: z.string().trim().max(254, "Use 254 characters or fewer.").email("Enter an email address like you@example.com."),
  message: z.string().trim().min(4, "Tell us a little more -- at least a few words.").max(5000, "Keep the message under 5,000 characters."),
  sku: z.string().trim().max(60).regex(SKU_PATTERN, "Use the SKU or model number as printed.").optional().or(z.literal("")),
  orderRef: z.string().trim().max(40).regex(ORDER_PATTERN, "Use the order number from your confirmation, for example SO-ABC123.").optional().or(z.literal("")),
  branchId: z.enum(["newark"]).optional(),
  zip: z.string().trim().regex(/^\d{5}$/, "Use a five-digit ZIP.").optional().or(z.literal("")),
  urgent: z.boolean().optional(),
  sourceUrl: z.string().max(300).optional(),
  clientRequestId: z.uuid().optional(),
});

export type ContactForm = z.infer<typeof contactFormSchema>;
export type ContactField = keyof ContactForm;

export const CONTACT_FIELD_LABELS: Record<string, string> = {
  topic: "Topic",
  name: "Name",
  email: "Email",
  message: "Message",
  sku: "SKU or model number",
  orderRef: "Order number",
  zip: "ZIP code",
};

/**
 * Allow-listed URL prefill: only these parameters, only canonical values. A
 * tampered value is dropped, never shown or submitted as-is.
 */
export function contactPrefill(params: { get(name: string): string | null }, canonicalSku: (raw: string) => string | null) {
  const topic = params.get("topic");
  const sku = params.get("sku");
  const branch = params.get("branch");
  const order = params.get("order");
  return {
    topic: CONTACT_TOPICS.some((entry) => entry.value === topic) ? topic! : sku ? "product" : "",
    sku: sku ? canonicalSku(sku) ?? "" : "",
    branchId: branch === "newark" ? ("newark" as const) : undefined,
    orderRef: order && ORDER_PATTERN.test(order) ? order : "",
  };
}
