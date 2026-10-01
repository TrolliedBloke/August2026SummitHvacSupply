import { z } from "zod";

/**
 * The quote request as a typed draft: requester, project, and editable lines
 * that each keep the intent they were added with. One schema for the page and
 * the API. A request with no lines needs a description detailed enough to
 * quote from; a request with lines needs valid quantities.
 */
export const QUOTE_MAX_LINES = 100;
export const QUOTE_MAX_QUANTITY = 200;
export const QUOTE_RESPONSE_WINDOW = "after staff review; call the counter for time-sensitive jobs";

export const PROJECT_TYPES = [
  { value: "replacement", label: "Replacing existing equipment" },
  { value: "new_install", label: "New installation or addition" },
  { value: "multi_unit", label: "Multi-unit or property project" },
  { value: "stock", label: "Stock for my shop" },
  { value: "other", label: "Something else" },
] as const;

export const quoteLineSchema = z.object({
  skuId: z.string().min(1).max(120),
  sku: z.string().min(1).max(120),
  quantity: z
    .number({ message: "Enter a quantity." })
    .int("Use a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(QUOTE_MAX_QUANTITY, `At most ${QUOTE_MAX_QUANTITY} per line -- call the counter for more.`),
  intent: z.enum(["cart", "quote", "availability", "notify"]).optional(),
});

export const quoteDraftSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name or company.").max(120),
    email: z.string().trim().toLowerCase().max(254).email("Enter an email address like you@company.com."),
    phone: z.string().trim().max(40).optional(),
    zip: z.string().trim().regex(/^\d{5}$/, "Enter the five-digit job-site ZIP.").optional().or(z.literal("")),
    projectType: z.enum(PROJECT_TYPES.map((type) => type.value) as [string, ...string[]], { message: "Choose the kind of project." }),
    requestedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.")
      .optional()
      .or(z.literal("")),
    notes: z.string().trim().max(5000, "Keep notes under 5,000 characters.").optional(),
    lines: z.array(quoteLineSchema).max(QUOTE_MAX_LINES, `A request can hold up to ${QUOTE_MAX_LINES} lines.`).default([]),
    clientRequestId: z.uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.lines.length === 0 && (!value.notes || value.notes.length < 20)) {
      ctx.addIssue({ code: "custom", path: ["notes"], message: "With no products listed, describe the job: equipment, sizes and quantities (20 characters or more)." });
    }
  });

export type QuoteDraft = z.infer<typeof quoteDraftSchema>;
export type QuoteField = "name" | "email" | "phone" | "zip" | "projectType" | "requestedDate" | "notes" | "lines";

export const QUOTE_FIELD_LABELS: Record<string, string> = {
  name: "Name or company",
  email: "Email",
  phone: "Phone",
  zip: "Job-site ZIP",
  projectType: "Project type",
  requestedDate: "Needed by",
  notes: "Project details",
  lines: "Products",
};

export type QuoteLineCheck = {
  skuId: string;
  input: { sku: string; quantity: number };
  status: "valid" | "merged" | "unknown" | "unavailable";
  canonical?: { skuId: string; sku: string; title: string; modelNumber: string };
  quantity: number;
  message?: string;
};

export type CompatibilityNote = {
  indoorSku: string;
  outdoorSku: string;
  verdict: "verified_compatible" | "verified_incompatible" | "unverified";
  message: string;
};
