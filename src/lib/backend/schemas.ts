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

/**
 * Every string is bounded. These fields land in Postgres text columns through a
 * service-role write on an unauthenticated endpoint, so without an upper bound
 * a single request could store an arbitrarily large row. quoteRequestSchema
 * above already caps its fields; these did not.
 *
 * Limits are sized to the field: a licence number is short, notes are prose.
 */
export const dealerApplicationSchema = z.object({
  company: z.string().min(2).max(200),
  contactName: z.string().min(2).max(120),
  email: z.string().email().max(254),
  phone: z.string().min(7).max(40),
  licenseNumber: z.string().max(80).optional(),
  serviceArea: z.string().max(500).optional(),
  businessType: z.string().max(120).optional(),
  monthlyVolume: z.string().max(120).optional(),
  brands: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
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

/**
 * Cart snapshot input. The endpoint is public and unauthenticated, so every
 * field here is attacker controlled and only `skuId`/`qty` are actually used --
 * title and price are re-derived from the server catalog in saveCartSnapshot.
 * They are still bounded so a caller cannot post megabytes of junk that later
 * lands in an email body.
 */
export const cartSnapshotSchema = z.object({
  email: z.string().email().max(254),
  items: z
    .array(
      z.object({
        skuId: z.string().min(1).max(120),
        sku: z.string().max(120).optional(),
        title: z.string().max(240).optional(),
        modelNumber: z.string().max(160).optional(),
        qty: z.number().int().min(1).max(200),
        // Accepted for backwards compatibility with older clients and then
        // ignored: pricing is never taken from the browser.
        unitPrice: z.number().nonnegative().max(1_000_000).optional(),
      })
    )
    .min(1)
    .max(50),
});

/** Bounded for the same reason as dealerApplicationSchema above. */
export const contactRequestSchema = z.object({
  topic: z.string().min(1).max(120),
  name: z.string().min(2).max(120),
  email: z.string().email().max(254),
  message: z.string().min(4).max(5000),
});
