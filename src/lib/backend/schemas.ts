import { z } from "zod";

export const quoteRequestLineSchema = z.object({
  skuId: z.string().min(1).max(120),
  sku: z.string().min(1).max(120),
  modelNumber: z.string().max(160),
  productName: z.string().min(1).max(240),
  quantity: z.number().int().min(1).max(200),
});

export const quoteRequestSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(254),
  phone: z.string().max(40).optional(),
  need: z.string().min(5).max(5000),
  lines: z.array(quoteRequestLineSchema).max(100).default([]),
});

export const dealerApplicationSchema = z.object({
  company: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(7),
  licenseNumber: z.string().optional(),
  serviceArea: z.string().optional(),
  businessType: z.string().optional(),
  monthlyVolume: z.string().optional(),
  brands: z.string().optional(),
  notes: z.string().optional(),
});

export const checkoutSchema = z.object({
  idempotencyKey: z.uuid(),
  items: z
    .array(
      z.object({
        skuId: z.string().min(1),
        sku: z.string().min(1),
        modelNumber: z.string().min(1),
        title: z.string().min(1),
        qty: z.number().int().min(1).max(200),
      })
    )
    .min(1),
  method: z.enum(["pickup", "local_delivery", "freight"]),
  zip: z.string().optional(),
  address: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  poNumber: z.string().optional(),
  billingContact: z.string().optional(),
  window: z.string().optional(),
  buyerName: z.string().optional(),
  buyerEmail: z.string().email().optional(),
}).superRefine((value, ctx) => {
  if (value.method === "local_delivery" && (!value.address || value.address.trim().length < 5)) {
    ctx.addIssue({ code: "custom", path: ["address"], message: "Jobsite address is required for local delivery." });
  }
  if (!value.buyerName || value.buyerName.trim().length < 2) {
    ctx.addIssue({ code: "custom", path: ["buyerName"], message: "Buyer name is required." });
  }
  if (!value.buyerEmail) {
    ctx.addIssue({ code: "custom", path: ["buyerEmail"], message: "Buyer email is required." });
  }
  if (!value.phone || value.phone.trim().length < 7) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Phone is required for order follow-up." });
  }
  if (value.method !== "freight" && !value.window) {
    ctx.addIssue({ code: "custom", path: ["window"], message: "Choose an available fulfillment window." });
  }
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const contactRequestSchema = z.object({
  topic: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(4),
});
