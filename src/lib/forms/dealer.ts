import { z } from "zod";

/**
 * The trade-account application, one schema for the browser and the API, so a
 * field the form marks required is required on the server too. Requirements
 * are conditional on the business: licensed trades must give a license; a
 * reseller buying for resale must give a seller's permit; tax identity is the
 * last four digits only -- the full number is collected by staff, not stored
 * from a public form.
 *
 * TODO(summit-ops): confirm the checklist, conditional rules and review SLA.
 */
export const DEALER_REVIEW_SLA = "after staff review; call the counter for time-sensitive account needs";

export const ENTITY_TYPES = [
  { value: "sole_proprietor", label: "Sole proprietor" },
  { value: "partnership", label: "Partnership" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "government", label: "Government agency" },
] as const;
export const BUSINESS_TYPES = [
  { value: "contractor", label: "HVAC contractor", licensed: true },
  { value: "installer", label: "Installer", licensed: true },
  { value: "mechanical", label: "Mechanical / commercial", licensed: true },
  { value: "dealer", label: "Dealer / reseller", licensed: false },
] as const;
export const SERVICE_STATES = [
  { value: "ca", label: "California" },
  { value: "or", label: "Oregon" },
  { value: "wa", label: "Washington" },
  { value: "nv", label: "Nevada" },
  { value: "az", label: "Arizona" },
  { value: "multi", label: "Multiple states" },
] as const;
/** EPA Section 608 technician certification types. */
export const EPA608_TYPES = [
  { value: "type_i", label: "Type I (small appliances)" },
  { value: "type_ii", label: "Type II (high-pressure, incl. split systems)" },
  { value: "type_iii", label: "Type III (low-pressure)" },
  { value: "universal", label: "Universal" },
] as const;
export const VOLUMES = [
  { value: "1-5", label: "1-5 units / month" },
  { value: "6-20", label: "6-20 units / month" },
  { value: "21-50", label: "21-50 units / month" },
  { value: "50+", label: "50+ units / month" },
] as const;

const values = <T extends readonly { value: string }[]>(options: T) => options.map((option) => option.value) as [T[number]["value"], ...T[number]["value"][]];

export const dealerFormSchema = z
  .object({
    company: z.string().trim().min(2, "Enter the business's legal name.").max(200),
    entityType: z.enum(values(ENTITY_TYPES), { message: "Choose how the business is organized." }),
    contactName: z.string().trim().min(2, "Enter your full name.").max(120),
    email: z.string().trim().toLowerCase().max(254).email("Enter an email address like you@company.com."),
    phone: z.string().trim().max(40).refine((value) => value.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number."),
    businessType: z.enum(values(BUSINESS_TYPES), { message: "Choose your type of business." }),
    licenseApplicable: z.enum(["yes", "no"], { message: "Tell us whether your work requires a contractor license." }),
    licenseNumber: z.string().trim().max(80).optional(),
    licenseState: z.enum(values(SERVICE_STATES)).optional(),
    // Optional today; required the day Summit lists refrigerant, which EPA
    // sells only to certified technicians (docs/FINDER-AND-AUDIENCE-PLAN.md 2.2).
    epa608Type: z.enum(values(EPA608_TYPES)).optional(),
    epa608Number: z.string().trim().max(40).optional(),
    taxIdLast4: z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits of the EIN (or SSN for a sole proprietor)."),
    buysForResale: z.enum(["yes", "no"], { message: "Tell us whether you buy equipment to resell." }),
    resaleCertificateNumber: z.string().trim().max(80).optional(),
    serviceArea: z.enum(values(SERVICE_STATES), { message: "Choose your main service area." }),
    monthlyVolume: z.enum(values(VOLUMES), { message: "Choose an estimated monthly volume." }),
    brands: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(5000).optional(),
    idempotencyKey: z.uuid().optional(),
  })
  .superRefine((value, ctx) => {
    const licensed = BUSINESS_TYPES.find((type) => type.value === value.businessType)?.licensed;
    if (licensed && value.licenseApplicable === "no") {
      ctx.addIssue({ code: "custom", path: ["licenseApplicable"], message: "This type of business needs a contractor license on file." });
    }
    if (value.licenseApplicable === "yes") {
      if (!value.licenseNumber || value.licenseNumber.length < 4) ctx.addIssue({ code: "custom", path: ["licenseNumber"], message: "Enter the license number." });
      if (!value.licenseState) ctx.addIssue({ code: "custom", path: ["licenseState"], message: "Choose the state that issued the license." });
    }
    if (value.epa608Type && (!value.epa608Number || value.epa608Number.length < 4)) {
      ctx.addIssue({ code: "custom", path: ["epa608Number"], message: "Enter the certification number from the EPA 608 card." });
    }
    if (value.buysForResale === "yes" && (!value.resaleCertificateNumber || value.resaleCertificateNumber.length < 4)) {
      ctx.addIssue({ code: "custom", path: ["resaleCertificateNumber"], message: "Enter the seller's permit or resale certificate number." });
    }
  });

export type DealerForm = z.infer<typeof dealerFormSchema>;
export type DealerField = Exclude<keyof DealerForm, "idempotencyKey">;

export const DEALER_STEPS: Array<{ id: number; label: string; fields: DealerField[] }> = [
  { id: 1, label: "Company", fields: ["company", "entityType", "contactName", "email", "phone"] },
  { id: 2, label: "Licensing & tax", fields: ["businessType", "licenseApplicable", "licenseNumber", "licenseState", "epa608Type", "epa608Number", "taxIdLast4", "buysForResale", "resaleCertificateNumber", "serviceArea"] },
  { id: 3, label: "Volume", fields: ["monthlyVolume", "brands", "notes"] },
];

export const DEALER_FIELD_LABELS: Record<DealerField, string> = {
  company: "Legal business name",
  entityType: "Business structure",
  contactName: "Contact name",
  email: "Work email",
  phone: "Phone",
  businessType: "Type of business",
  licenseApplicable: "Contractor license",
  licenseNumber: "License number",
  licenseState: "Issuing state",
  epa608Type: "EPA 608 certification",
  epa608Number: "EPA 608 certificate number",
  taxIdLast4: "Last 4 of EIN or SSN",
  buysForResale: "Buying for resale",
  resaleCertificateNumber: "Seller's permit or resale certificate",
  serviceArea: "Main service area",
  monthlyVolume: "Estimated monthly volume",
  brands: "Brands you carry",
  notes: "Anything else",
};

export const DEALER_CHECKLIST = [
  "The business's legal name and how it is organized (LLC, corporation, sole proprietor…)",
  "Your contractor license number and issuing state, if your work requires one. Staff check it before approval.",
  "Your EPA 608 certification, if you have one (optional)",
  "The last 4 digits of the business EIN (or SSN for a sole proprietor)",
  "A seller's permit or resale certificate, if you buy equipment to resell",
];
