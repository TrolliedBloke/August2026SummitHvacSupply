import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CsvRow = Record<string, string>;
type ResearchOverride = {
  name?: string;
  modelNumber?: string;
  category?: string;
  productType?: string;
  researchStatus?: "in_progress" | "verified" | "conflict";
  specifications?: Record<string, string | number>;
  warranty?: Record<string, unknown> | null;
  image?: string | null;
  images?: string[];
  imageVerification?: "unverified" | "manufacturer_family" | "verified";
  documents?: unknown[];
  compatibility?: unknown[];
  ahri?: unknown;
  fieldSources?: Record<string, { sourceUrl: string; sourceType: string; retrievedAt: string }>;
  evidence?: Array<{ fieldName: string; value: unknown; sourceUrl: string; sourceType: string; retrievedAt: string; status: "verified" | "conflict" | "rejected"; notes?: string }>;
};
type ExactMediaGroup = {
  id: string;
  skus: string[];
  sourceUrl: string;
  retrievedAt: string;
  notes: string;
  images: string[];
};

async function main() {
const root = process.cwd();
const sourcePath = path.join(root, "data/catalog/inventory-source.csv");
const catalogPath = path.join(root, "src/data/catalog.generated.json");
// Acquisition cost is written OUTSIDE src/ on purpose. Anything under src/data
// is reachable from a "use client" import graph, and a JSON import is bundled
// whole -- per-key tree-shaking does not happen -- so a single client component
// touching the catalog would publish what Summit pays for every unit.
const costPath = path.join(root, "data/catalog/costs.generated.json");
const reportPath = path.join(root, "data/catalog/reconciliation.generated.json");
const researchLedgerPath = path.join(root, "data/catalog/research-ledger.generated.json");
const overridesPath = path.join(root, "data/catalog/research-overrides.json");
const exactMediaPath = path.join(root, "data/catalog/exact-media.json");

const text = await readFile(sourcePath, "utf8");
const matrix = parseCsv(text);
const headers = matrix[0].map((value) => value.trim());
const rows = matrix.slice(1).filter((row) => row.some((value) => value.trim())).map((values, index) => ({
  sourceRow: index + 2,
  raw: Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""])) as CsvRow,
}));

const groups = new Map<string, typeof rows>();
for (const row of rows) {
  const key = normalizeIdentifier(row.raw.SKU);
  groups.set(key, [...(groups.get(key) ?? []), row]);
}

const overrides = JSON.parse(await readFile(overridesPath, "utf8")) as { products: Record<string, ResearchOverride> };
const exactMedia = JSON.parse(await readFile(exactMediaPath, "utf8")) as { groups: ExactMediaGroup[] };
const products = rows.map((row) => {
  const product = normalizeRow(row.sourceRow, row.raw, groups.get(normalizeIdentifier(row.raw.SKU)) ?? []);
  return applyExactMedia(applyResearchOverride(product, overrides.products[product.catalogSku]), exactMedia.groups);
});
const seen = new Set<string>();
for (const product of products) {
  let candidate = product.catalogSku;
  let ordinal = 2;
  while (seen.has(candidate.toLowerCase())) candidate = `${product.catalogSku}-V${ordinal++}`;
  product.catalogSku = candidate;
  product.slug = slugify(candidate);
  seen.add(candidate.toLowerCase());
}

const collisions = [...groups.entries()]
  .filter(([, members]) => members.length > 1)
  .map(([normalizedSku, members]) => ({
    normalizedSku,
    sourceRows: members.map((member) => member.sourceRow),
    disposition: "separate_variant_pending_human_confirmation",
    generatedSkus: products.filter((product) => members.some((member) => member.sourceRow === product.sourceRow)).map((product) => product.catalogSku),
  }));

const report = {
  generatedAt: new Date().toISOString(),
  sourceFile: "data/catalog/inventory-source.csv",
  sourceSha256: createHash("sha256").update(text).digest("hex"),
  sourceRows: rows.length,
  generatedRecords: products.length,
  normalizedIdentifiers: groups.size,
  collisionGroups: collisions.length,
  collisionRows: collisions,
  quoteEligible: products.filter((product) => product.quoteEligible).length,
  purchaseEligible: products.filter((product) => product.purchaseEligible).length,
  positiveRetailPrices: products.filter((product) => product.retailPrice !== null).length,
  unknownInventory: products.filter((product) => product.inventoryStatus === "unknown").length,
  researchCsvOnly: products.filter((product) => product.researchStatus === "csv_only").length,
  researchInProgress: products.filter((product) => product.researchStatus === "in_progress").length,
  researchVerified: products.filter((product) => product.researchStatus === "verified").length,
  researchConflicts: products.filter((product) => product.researchStatus === "conflict").length,
  manufacturerImageCoverage: products.filter((product) => product.imageVerification !== "unverified").length,
  exactModelImageCoverage: products.filter((product) => product.imageVerification === "verified").length,
  needsReview: products.filter((product) => product.publicationStatus === "needs_review").map((product) => ({
    sourceRow: product.sourceRow,
    sourceSku: product.sourceSku,
    catalogSku: product.catalogSku,
    issues: product.issues,
  })),
  rowMapping: products.map((product) => ({
    sourceRow: product.sourceRow,
    sourceSku: product.sourceSku,
    catalogSku: product.catalogSku,
    manufacturer: product.brand,
    model: product.modelNumber,
    product: product.name,
    category: product.category,
    productType: product.productType,
    publicationStatus: product.publicationStatus,
    websitePath: `/products/sku/${product.slug}`,
  })),
};

const researchLedger = {
  generatedAt: report.generatedAt,
  records: products.map((product) => ({
    sourceRow: product.sourceRow,
    catalogSku: product.catalogSku,
    sourceSku: product.sourceSku,
    modelNumber: product.modelNumber,
    researchStatus: product.researchStatus,
    missing: [
      !product.modelNumber && "exact_identity",
      !product.image && "exact_image",
      product.documents.length === 0 && "official_documents",
      !product.warranty && "manufacturer_warranty",
      product.compatibility.length === 0 && "compatibility_evidence",
    ].filter(Boolean),
    evidence: product.evidence,
  })),
};

// Split acquisition cost out of the published catalog before anything is written.
const costs = {
  generatedAt: report.generatedAt,
  note: "Server-only. Summit acquisition cost per source row. Never import from src/.",
  records: products.map((product) => ({
    id: product.id,
    catalogSku: product.catalogSku,
    sourceRow: product.sourceRow,
    unitCost: product.unitCost,
  })),
};
const publishedProducts = products.map((product) => {
  const { unitCost, ...publicProduct } = product;
  void unitCost;
  return publicProduct;
});

await mkdir(path.dirname(catalogPath), { recursive: true });
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(catalogPath, `${JSON.stringify(publishedProducts, null, 2)}\n`);
await writeFile(costPath, `${JSON.stringify(costs, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(researchLedgerPath, `${JSON.stringify(researchLedger, null, 2)}\n`);
console.log(JSON.stringify({ catalogPath, costPath, reportPath, researchLedgerPath, ...report }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function normalizeRow(sourceRow: number, raw: CsvRow, siblings: Array<{ sourceRow: number; raw: CsvRow }>) {
  const issues: string[] = [];
  const sourceSku = clean(raw.SKU) ?? `ROW-${sourceRow}`;
  const siblingName = siblings.map((item) => clean(item.raw["Product Name"])).find(Boolean) ?? null;
  const siblingBrand = siblings.map((item) => clean(item.raw.Brand)).find((value) => value && value !== "--") ?? null;
  const suppliedName = clean(raw["Product Name"]);
  const name = suppliedName ?? siblingName ?? `${sourceSku} product`;
  if (!suppliedName) issues.push(siblingName ? "product_name_inferred_from_sibling_sku" : "product_name_requires_verification");

  const brand = normalizeBrand(clean(raw.Brand) ?? siblingBrand, sourceSku);
  if (!clean(raw.Brand) || raw.Brand.trim() === "--") issues.push("brand_inferred_from_identifier");

  const suppliedType = clean(raw["Product Type"]);
  const typeSupplied = Boolean(suppliedType) && suppliedType !== "#NAME?" && !isSheetFormula(suppliedType);
  let productType = normalizeProductType(typeSupplied ? suppliedType : null, `${sourceSku} ${name}`);
  if (!typeSupplied) issues.push("product_type_inferred");
  // An explicit "Indoor"/"Outdoor" in the product name can correct a
  // contradictory IDU/ODU sheet cell, and a specific equipment name can refine
  // the coarse IDU type. Other supplied types remain authoritative: "NaturalAir
  // Insulated Copper Coil" contains "coil" while the sheet says Accessory, and
  // overruling that would put copper line stock beside evaporator coils.
  const REFINES_INDOOR_UNIT = new Set(["Air handler", "Ceiling cassette", "Cassette panel"]);
  const nameDerivedProductType = normalizeProductType(null, name);
  const hasExplicitDirection = /\b(?:indoor|outdoor)\b/i.test(name);
  const mayRefine = !typeSupplied
    || hasExplicitDirection
    || (productType === "Indoor unit" && REFINES_INDOOR_UNIT.has(nameDerivedProductType));
  if (mayRefine && nameDerivedProductType !== "Installation accessory" && productType !== nameDerivedProductType) {
    productType = nameDerivedProductType;
    issues.push(typeSupplied ? "product_type_refined_from_product_name" : "product_type_inferred_from_product_name");
  }
  let category = normalizeCategory(clean(raw.Category), productType, sourceSku, name);
  if (!clean(raw.Category)) issues.push("category_inferred");

  let btu = numeric(raw.BTU);
  if (btu === null) {
    const thousands = name.match(/\b(\d{1,3})\s*k(?:\s*btu)?\b/i);
    const explicit = name.match(/\b(\d{4,6})\s*btu\b/i);
    if (thousands) btu = Number(thousands[1]) * 1000;
    else if (explicit) btu = Number(explicit[1]);
    if (btu !== null) issues.push("btu_inferred_from_product_name");
  }
  if (btu === 900 && /(?:^|\D)9\s*k(?:\D|$)|9000/i.test(name)) {
    btu = 9000;
    issues.push("btu_corrected_900_to_9000_from_product_name");
  }
  const refrigerant = normalizeRefrigerant(clean(raw.Refrigerant));
  // The A2L column value ("R454B/A2L") carries a flammability classification
  // that drives handling, leak-detection and code requirements. Keep it.
  const refrigerantClass = /a2l/i.test(clean(raw.Refrigerant) ?? "") || refrigerant === "R-454B" || refrigerant === "R-32" ? "A2L" : null;
  // The sheet's model column also holds prose ("THEY DONT MAKE IT") and shifted
  // label text ("Cassette Panel 01"). Publishing those as manufacturer model
  // numbers invites a contractor to order a part number that does not exist.
  const rawModel = clean(raw["OEM Barcode/UPC"]);
  const modelNumber = isPlausibleModelNumber(rawModel) ? rawModel : null;
  if (rawModel && !modelNumber) issues.push("model_number_not_a_manufacturer_identifier");
  if (brand === "Carrier" && /^26SCA5/i.test(modelNumber ?? "") && category !== "central-air-conditioners") {
    category = "central-air-conditioners";
    issues.push("category_corrected_from_official_model_family");
  }
  const retailPrice = positiveMoney(raw["Sell Price"]);
  const unitCost = positiveMoney(raw["Unit Cost"]);
  const note = clean(raw.Notes);
  const collision = siblings.length > 1;
  const variantToken = collision
    ? slugify(refrigerant ?? modelNumber?.slice(-10) ?? `row-${sourceRow}`).toUpperCase()
    : null;
  const catalogSku = collision ? `${sourceSku.toUpperCase()}-${variantToken}` : sourceSku.toUpperCase();
  if (collision) issues.push("source_sku_collision_preserved_as_variant");
  if (retailPrice === null) issues.push(/bundle/i.test(note ?? "") ? "bundle_component_has_no_standalone_price" : "retail_price_unverified");
  issues.push("inventory_unverified", "exact_image_unverified", "manufacturer_research_pending");

  const publicationStatus = suppliedName || siblingName ? (retailPrice !== null ? "published" : "quote_only") : "needs_review";
  return {
    id: `inventory-row-${sourceRow}`,
    sourceRow,
    sourceSku,
    catalogSku,
    slug: slugify(catalogSku),
    modelNumber,
    name,
    brand,
    category,
    productType,
    description: null,
    btu,
    tonnage: btu && btu % 12000 === 0 ? btu / 12000 : null,
    zones: clean(raw.Zones),
    voltage: normalizeVoltage(clean(raw.Voltage)),
    refrigerant,
    refrigerantClass,
    compatibleOutdoorSku: clean(raw["Compatible Outdoor SKU"]),
    bundleName: clean(raw["Bundle/Kit Name"]),
    minimumStock: numeric(raw["Min Stock"]),
    warehouseLocation: clean(raw.Location),
    retailPrice,
    unitCost,
    inventoryQuantity: null,
    inventoryStatus: "unknown",
    image: null,
    images: [],
    imageVerification: "unverified",
    documents: [],
    warranty: null,
    // AHRI certifies matched systems, not loose components. A cassette, panel,
    // line set or accessory has no certificate to find, so "not_applicable" is
    // the correct terminal state for most of this catalog -- not "not_found".
    ahri: null as unknown,
    // Per-field provenance. A field without an entry here was derived from the
    // inventory sheet, not from a manufacturer source.
    fieldSources: {} as Record<string, { sourceUrl: string; sourceType: string; retrievedAt: string }>,
    specifications: compactObject({ btu, zones: clean(raw.Zones), voltage: normalizeVoltage(clean(raw.Voltage)), refrigerant, refrigerantClass }),
    compatibility: [],
    researchStatus: "csv_only",
    publicationStatus,
    quoteEligible: publicationStatus !== "needs_review",
    purchaseEligible: publicationStatus === "published",
    notes: note,
    issues: [...new Set(issues)],
    evidence: [{
      sourceType: "inventory_csv",
      sourceReference: `data/catalog/inventory-source.csv#row-${sourceRow}`,
      verifiedAt: null,
      status: "source_record",
    }],
  };
}

function applyResearchOverride<T extends ReturnType<typeof normalizeRow>>(product: T, override?: ResearchOverride): T {
  if (!override) return product;
  const evidence = override.evidence ?? [];
  if (override.researchStatus === "verified" && !evidence.some((item) => item.status === "verified")) {
    throw new Error(`${product.catalogSku}: verified research requires at least one verified evidence record`);
  }
  const overrideImages = override.images ?? (override.image ? [override.image] : []);
  if (override.imageVerification === "verified" && (overrideImages.length === 0 || !evidence.some((item) => item.fieldName === "image" && item.status === "verified"))) {
    throw new Error(`${product.catalogSku}: a verified image requires an exact-model image URL and verified evidence`);
  }
  return {
    ...product,
    name: override.name ?? product.name,
    modelNumber: override.modelNumber ?? product.modelNumber,
    category: override.category ?? product.category,
    productType: override.productType ?? product.productType,
    researchStatus: override.researchStatus ?? product.researchStatus,
    specifications: { ...product.specifications, ...override.specifications },
    warranty: override.warranty ?? product.warranty,
    image: overrideImages[0] ?? product.image,
    images: overrideImages.length > 0 ? overrideImages : product.images,
    imageVerification: override.imageVerification ?? product.imageVerification,
    documents: override.documents ?? product.documents,
    compatibility: override.compatibility ?? product.compatibility,
    ahri: override.ahri ?? product.ahri,
    fieldSources: { ...product.fieldSources, ...override.fieldSources },
    evidence: [...product.evidence, ...evidence],
  } as T;
}

function applyExactMedia<T extends ReturnType<typeof normalizeRow>>(product: T, groups: ExactMediaGroup[]): T {
  if (product.imageVerification === "verified") return product;
  const group = groups.find((candidate) => candidate.skus.includes(product.catalogSku));
  if (!group) return product;
  if (group.images.length === 0) throw new Error(`${group.id}: exact media group has no images`);
  return {
    ...product,
    image: group.images[0],
    images: group.images,
    imageVerification: "verified",
    researchStatus: product.researchStatus === "csv_only" ? "in_progress" : product.researchStatus,
    issues: product.issues.filter((issue) => issue !== "exact_image_unverified"),
    evidence: [...product.evidence, {
      fieldName: "image",
      value: { exactMediaGroup: group.id, localPaths: group.images, exactModelVerified: true },
      sourceUrl: group.sourceUrl,
      sourceType: "manufacturer_product_page",
      retrievedAt: group.retrievedAt,
      status: "verified",
      notes: group.notes,
    }],
  } as T;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (
    !trimmed ||
    trimmed.startsWith("=") ||
    /^(?:#N\/A|#NAME\?|#REF!|#VALUE!|#DIV\/0!|-|--|don't know|dont know|they (?:don't|don’t|dont) make it)$/i.test(trimmed)
  ) return null;
  return trimmed;
}

function numeric(value: string | null | undefined): number | null {
  const cleaned = clean(value)?.replaceAll(",", "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveMoney(value: string | null | undefined): number | null {
  const parsed = numeric(value?.replace("$", ""));
  return parsed !== null && parsed > 0 ? parsed : null;
}

/** Unresolved Google Sheets AI formulas ship in 25 rows of the source sheet. */
function isSheetFormula(value: string | null | undefined): boolean {
  return Boolean(value && /^\s*=/.test(value));
}

/**
 * A manufacturer model number is a compact alphanumeric identifier. Free-text
 * prose in that column is a data-entry artefact, not a part number.
 */
function isPlausibleModelNumber(value: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 40) return false;
  if (isSheetFormula(trimmed)) return false;
  if (!/\d/.test(trimmed)) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  // More than one space means a sentence or a label, not an identifier.
  if ((trimmed.match(/\s/g) ?? []).length > 1) return false;
  return true;
}

function normalizeBrand(value: string | null, sku: string): string {
  if (value && value !== "--") return value.toLowerCase() === "tosot" ? "Tosot" : value.toUpperCase() === "TCL" ? "TCL" : value;
  if (/^TCL/i.test(sku)) return "TCL";
  if (/^TOS/i.test(sku)) return "Tosot";
  if (/^CAR/i.test(sku)) return "Carrier";
  return "Unbranded";
}

function normalizeProductType(value: string | null, text: string): string {
  if (value && value !== "#NAME?") {
    if (value.toUpperCase() === "IDU") return "Indoor unit";
    if (value.toUpperCase() === "ODU") return "Outdoor unit";
    if (value.toUpperCase() === "COIL") return "Evaporator coil";
    return titleCase(value);
  }
  if (/air handler|\bahu\b/i.test(text)) return "Air handler";
  if (/furnace|\bfur\b/i.test(text)) return "Furnace";
  if (/coil/i.test(text)) return "Evaporator coil";
  if (/cassette/i.test(text)) return "Ceiling cassette";
  if (/panel/i.test(text)) return "Cassette panel";
  if (/controller|control/i.test(text)) return "Control";
  if (/line set/i.test(text)) return "Line set";
  if (/outdoor|condenser|\bhpu\b|\bodu\b/i.test(text)) return "Outdoor unit";
  if (/indoor|\bidu\b/i.test(text)) return "Indoor unit";
  return "Installation accessory";
}

function normalizeCategory(value: string | null, productType: string, sku: string, name: string): string {
  const normalized = value?.toLowerCase().replaceAll(" ", "");
  if (productType === "Furnace") return "furnaces";
  if (productType === "Air handler") return "air-handlers";
  if (productType === "Evaporator coil") return "evaporator-coils";
  if (productType === "Ceiling cassette" || productType === "Cassette panel") return "cassettes";
  if (productType === "Line set" || normalized === "lineset") return "line-sets";
  if (productType === "Control") return "controls";
  // Parts and accessories stay in supplies even when their name mentions the
  // equipment they attach to. A "Mini Split Line Hide Cover Kit" is a cover
  // kit, and listing it beside heat pumps in the mini-split category is how a
  // buyer ends up with trim instead of a condenser.
  if (productType === "Accessory" || productType === "Installation accessory") return "installation-supplies";
  if (normalized === "central") return productType === "Outdoor unit" ? "central-heat-pumps" : "central-systems";
  // ODU/IDU suffixes live on the SKU, not in the prose name. Matching against
  // "sku + name" meant a row whose category cell was blank fell through to
  // supplies -- that is how a Tosot 9K outdoor condenser got filed as an
  // installation supply.
  if (normalized === "minisplit" || /(?:idu|odu)$/i.test(sku) || /mini.?split|\bmz\b/i.test(`${sku} ${name}`)) return "mini-splits";
  if (productType === "Outdoor unit" || productType === "Indoor unit") return "mini-splits";
  return "installation-supplies";
}

function normalizeVoltage(value: string | null): string | null {
  if (!value) return null;
  if (/^220V$/i.test(value)) return "208/230V";
  if (/^110V$/i.test(value)) return "115V";
  return value.toUpperCase();
}

function normalizeRefrigerant(value: string | null): string | null {
  if (!value) return null;
  const compact = value.toUpperCase().replaceAll("-", "");
  if (compact === "R410") return "R-410A";
  if (compact === "R410A") return "R-410A";
  if (compact === "R454B" || compact === "R454B/A2L") return "R-454B";
  if (compact === "R32") return "R-32";
  return value;
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function compactObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== ""));
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}
