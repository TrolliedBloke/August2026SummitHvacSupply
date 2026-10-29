import { z } from "zod";

/**
 * The homeowner request, as typed fields -- not a newline-joined message --
 * shared by the form and /api/homeowner-requests. Vocabulary is the
 * homeowner's: no license, tax id, resale or volume fields appear here.
 */
export const HOME_TYPES = [
  { value: "single_family", label: "Single-family home" },
  { value: "townhome", label: "Townhome or condo" },
  { value: "adu", label: "ADU or addition" },
  { value: "small_commercial", label: "Small commercial space" },
] as const;
export const DUCT_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Not sure" },
] as const;
export const REBATE_OPTIONS = DUCT_OPTIONS;
export const TIMELINES = [
  { value: "asap", label: "As soon as possible" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "Next 1-3 months" },
  { value: "researching", label: "Just researching" },
] as const;

const values = <T extends readonly { value: string }[]>(options: T) => options.map((option) => option.value) as [T[number]["value"], ...T[number]["value"][]];

export const homeownerRequestSchema = z.object({
  zip: z.string().trim().regex(/^\d{5}$/, "Enter the five-digit ZIP where the equipment will go."),
  city: z.string().trim().min(2, "Enter the city.").max(80, "Use 80 characters or fewer."),
  homeType: z.enum(values(HOME_TYPES), { message: "Choose the type of home." }),
  zones: z.string().trim().min(1, "Tell us roughly which rooms or zones.").max(120, "Use 120 characters or fewer."),
  existingDucts: z.enum(values(DUCT_OPTIONS), { message: "Choose whether the home has ducts." }),
  rebateInterest: z.enum(values(REBATE_OPTIONS), { message: "Choose whether rebates matter to you." }),
  timeline: z.enum(values(TIMELINES), { message: "Choose a timeline." }),
  name: z.string().trim().min(2, "Enter your name.").max(120, "Use 120 characters or fewer."),
  email: z.string().trim().toLowerCase().max(254).email("Enter an email address like you@example.com."),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((value) => !value || value.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number, or leave it blank.")
    .optional(),
  notes: z.string().trim().max(2000, "Keep notes under 2,000 characters.").optional(),
  consent: z.literal(true, { message: "Check the box so we can contact you about this request." }),
  clientRequestId: z.uuid().optional(),
});

export type HomeownerRequest = z.infer<typeof homeownerRequestSchema>;
export type HomeownerField = keyof HomeownerRequest;

export const HOMEOWNER_FIELD_LABELS: Record<string, string> = {
  zip: "ZIP code",
  city: "City",
  homeType: "Home type",
  zones: "Rooms or zones",
  existingDucts: "Existing ducts",
  rebateInterest: "Rebate interest",
  timeline: "Timeline",
  name: "Name",
  email: "Email",
  phone: "Phone",
  notes: "Anything else",
  consent: "Permission to contact you",
};

/** What happens after a request, stated before the form. TODO(summit-ops): confirm the window. */
export const HOMEOWNER_RESPONSE_WINDOW = "after staff review; call the counter for time-sensitive projects";
