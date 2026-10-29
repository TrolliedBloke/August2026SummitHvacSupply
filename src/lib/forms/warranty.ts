import { z } from "zod";

/**
 * The warranty claim form's one schema, shared by the browser and the API
 * (docs/LIABILITY-REMEDIATION-PLAN.md, 2.5). Summit coordinates claims with
 * the manufacturer; it does not decide them, and nothing here promises cover.
 */
const ORDER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{2,39}$/;

export const warrantyClaimSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120, "Use 120 characters or fewer."),
  email: z.string().trim().max(254).email("Enter an email address like you@example.com."),
  phone: z.string().trim().max(40).regex(/^[0-9 ()+.-]{7,}$/, "Enter a phone number we can reach you at."),
  orderRef: z.string().trim().max(40).regex(ORDER_PATTERN, "Use the order number from your confirmation, or leave it blank.").optional().or(z.literal("")),
  productDescription: z.string().trim().min(3, "Tell us what the equipment is.").max(300),
  modelNumber: z.string().trim().min(2, "Enter the model number from the unit's label.").max(80),
  serialNumber: z.string().trim().min(3, "Enter the serial number from the unit's label.").max(80),
  installDate: z.iso.date("Use the date it was installed.").optional().or(z.literal("")),
  installerName: z.string().trim().max(160).optional().or(z.literal("")),
  installerLicense: z.string().trim().max(40).optional().or(z.literal("")),
  issue: z.string().trim().min(10, "Describe what's happening -- symptoms and any error codes.").max(5000),
  clientRequestId: z.uuid().optional(),
});

export type WarrantyClaimForm = z.infer<typeof warrantyClaimSchema>;

export const WARRANTY_FIELD_LABELS: Record<keyof WarrantyClaimForm, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  orderRef: "Order number",
  productDescription: "Equipment",
  modelNumber: "Model number",
  serialNumber: "Serial number",
  installDate: "Install date",
  installerName: "Installer or company",
  installerLicense: "Installer's CSLB license number",
  issue: "What's happening",
  clientRequestId: "Request id",
};
