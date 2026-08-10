import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// supabase-js constructs a realtime client eagerly, and realtime-js THROWS on
// Node < 22 because there is no global WebSocket. This script only makes REST
// calls, but the throw happens at createClient() before any of them -- which is
// why `npm run catalog:sync` exited 1 having written nothing, printing only the
// realtime advisory. Supplying the polyfill is the fix the error itself
// prescribes. Node 22 makes this unnecessary.
if (!(globalThis as { WebSocket?: unknown }).WebSocket) {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

type GeneratedProduct = {
  id: string;
  sourceRow: number;
  sourceSku: string;
  catalogSku: string;
  slug: string;
  modelNumber: string | null;
  name: string;
  brand: string;
  category: string;
  productType: string;
  description: string | null;
  btu: number | null;
  tonnage: number | null;
  zones: string | null;
  voltage: string | null;
  refrigerant: string | null;
  compatibleOutdoorSku: string | null;
  bundleName: string | null;
  retailPrice: number | null;
  inventoryQuantity: number | null;
  inventoryStatus: string;
  image: string | null;
  images: string[];
  imageVerification: string;
  warranty: unknown;
  specifications: Record<string, unknown>;
  researchStatus: string;
  publicationStatus: string;
  quoteEligible: boolean;
  purchaseEligible: boolean;
  notes: string | null;
  issues: string[];
  evidence: Array<{
    fieldName?: string;
    value?: unknown;
    sourceUrl?: string;
    sourceType: string;
    sourceReference?: string;
    retrievedAt?: string;
    status: string;
    notes?: string;
  }>;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");

  const root = process.cwd();
  const products = JSON.parse(await readFile(path.join(root, "src/data/catalog.generated.json"), "utf8")) as GeneratedProduct[];
  // Acquisition cost is deliberately absent from the published catalog; it is
  // kept outside src/ so no client bundle can reach it.
  const costFile = JSON.parse(await readFile(path.join(root, "data/catalog/costs.generated.json"), "utf8")) as {
    records: Array<{ id: string; unitCost: number | null }>;
  };
  const unitCostById = new Map(costFile.records.map((record) => [record.id, record.unitCost]));
  const report = JSON.parse(await readFile(path.join(root, "data/catalog/reconciliation.generated.json"), "utf8")) as Record<string, unknown>;
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const rows = products.map((product) => ({
    id: product.id,
    source_row: product.sourceRow,
    source_sku: product.sourceSku,
    catalog_sku: product.catalogSku,
    slug: product.slug,
    model_number: product.modelNumber,
    name: product.name,
    brand: product.brand,
    category: product.category,
    product_type: product.productType,
    description: product.description,
    btu: product.btu,
    tonnage: product.tonnage,
    zones: product.zones,
    voltage: product.voltage,
    refrigerant: product.refrigerant,
    compatible_outdoor_sku: product.compatibleOutdoorSku,
    bundle_name: product.bundleName,
    retail_price: product.retailPrice,
    inventory_quantity: product.inventoryQuantity,
    inventory_status: product.inventoryStatus,
    image_url: product.image,
    image_verified: product.imageVerification === "verified",
    warranty: product.warranty,
    specifications: product.specifications,
    research_status: product.researchStatus,
    publication_status: product.publicationStatus,
    quote_eligible: product.quoteEligible,
    purchase_eligible: product.purchaseEligible,
    notes: product.notes,
    issues: product.issues,
    updated_at: new Date().toISOString(),
  }));

  for (let offset = 0; offset < rows.length; offset += 100) {
    const { error } = await supabase.from("catalog_products").upsert(rows.slice(offset, offset + 100), { onConflict: "id" });
    if (error) throw new Error(`Catalog upsert failed: ${error.message}`);
  }

  const costs = products.map((product) => ({ product_id: product.id, unit_cost: unitCostById.get(product.id) ?? null, updated_at: new Date().toISOString() }));
  const { error: costError } = await supabase.from("catalog_product_costs").upsert(costs, { onConflict: "product_id" });
  if (costError) throw new Error(`Catalog cost upsert failed: ${costError.message}`);

  const evidenceRows = products.flatMap((product) => product.evidence.map((evidence) => ({
    product_id: product.id,
    field_name: evidence.fieldName ?? "source_record",
    value: evidence.value ?? { sourceReference: evidence.sourceReference },
    source_url: evidence.sourceUrl ?? null,
    source_type: evidence.sourceType,
    source_reference: evidence.sourceReference ?? evidence.sourceUrl ?? `${product.id}:${evidence.fieldName ?? "source_record"}`,
    verification_status: evidence.status === "verified" ? "verified" : evidence.status === "conflict" ? "conflict" : evidence.status === "rejected" ? "rejected" : "unverified",
    verified_at: evidence.status === "verified" && evidence.retrievedAt ? new Date(`${evidence.retrievedAt}T00:00:00.000Z`).toISOString() : null,
    notes: evidence.notes ?? null,
  })));
  const { error: evidenceError } = await supabase.from("catalog_product_evidence").upsert(evidenceRows, { onConflict: "product_id,field_name,source_reference" });
  if (evidenceError) throw new Error(`Catalog evidence upsert failed: ${evidenceError.message}`);

  const mediaRows = products.flatMap((product) => {
    const imageEvidence = product.evidence.find((evidence) => evidence.fieldName === "image" && evidence.status === "verified");
    if (!imageEvidence?.sourceUrl) return [];
    return product.images.map((url, sortOrder) => ({
      product_id: product.id,
      kind: "image",
      url,
      alt_text: `${product.name} manufacturer ${product.imageVerification === "verified" ? "exact-model" : "family"} view ${sortOrder + 1}`,
      source_url: imageEvidence.sourceUrl,
      exact_model_verified: product.imageVerification === "verified",
      sort_order: sortOrder,
    }));
  });
  if (mediaRows.length > 0) {
    const { error: mediaError } = await supabase.from("catalog_product_media").upsert(mediaRows, { onConflict: "product_id,url" });
    if (mediaError) throw new Error(`Catalog media upsert failed: ${mediaError.message}`);
  }

  const { error: runError } = await supabase.from("catalog_import_runs").insert({
    source_sha256: report.sourceSha256,
    source_rows: report.sourceRows,
    generated_records: report.generatedRecords,
    collision_groups: report.collisionGroups,
    report,
  });
  if (runError) throw new Error(`Import-run insert failed: ${runError.message}`);

  console.log(`Upserted ${rows.length} production catalog records and recorded the import run.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
