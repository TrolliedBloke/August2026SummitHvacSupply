/**
 * What a product image is evidence of.
 *
 * The catalog's own `imageVerification: "verified"` meant "a manufacturer
 * image for this product line was found", and the storefront read it as
 * "verified against this exact model". Of 56 records marked verified, 37 share
 * their photo with a different model number -- one Carrier FJ5 image stands in
 * for the 36, 48 and 60 kBTU air handlers. Those are honest family images, and
 * labelling them as exact-model media told a contractor more than we know.
 *
 * One classifier, used by the card, the product page, the about page and the
 * coverage report, so they cannot disagree:
 *
 *  - verifiedExact  -- a manufacturer image no other model in the catalog uses.
 *  - verifiedFamily -- a manufacturer image for the product family, shared with
 *                      other models or explicitly recorded as family media.
 *  - reference      -- supplier or reference photos not verified for this model.
 *  - missing        -- nothing to show. A deliberate state, not a failure. Also
 *                      used when the image is of a different component than
 *                      the record (an indoor wall head on an outdoor unit):
 *                      no picture is more honest than the wrong one.
 *
 * `loading` and `failed` are runtime states of an individual <img>, not catalog
 * facts, so they live on the components (MediaDisplayState), not here.
 */

export type MediaVerification = "verifiedExact" | "verifiedFamily" | "reference" | "missing";

/** Catalog state plus the two states only a browser can observe. */
export type MediaDisplayState = MediaVerification | "loading" | "failed";

export type MediaRecord = {
  modelNumber: string | null;
  productType: string;
  image: string | null;
  images?: string[];
  referenceImages?: string[];
  imageVerification: "unverified" | "manufacturer_family" | "verified";
};

function normalizeModel(model: string | null): string {
  return (model ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function recordImages(record: MediaRecord): string[] {
  return [record.image, ...(record.images ?? [])].filter((src): src is string => Boolean(src));
}

/** Every image path -> the distinct model numbers that use it. */
export function imageModelIndex(records: MediaRecord[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const record of records) {
    if (record.imageVerification === "unverified") continue;
    const model = normalizeModel(record.modelNumber);
    for (const src of recordImages(record)) {
      const models = index.get(src) ?? new Set<string>();
      models.add(model);
      index.set(src, models);
    }
  }
  return index;
}

/* Component roles as they appear in productType and in asset file names. A
   "system-pair" image shows both halves and so matches either. */
const INDOOR_TYPES = /indoor unit|air handler|evaporator coil|cassette/i;
const OUTDOOR_TYPES = /outdoor unit|condenser|heat pump/i;
const INDOOR_ASSET = /indoor|wall-head|wall-front|-idu\b|-ahu\b|cassette/i;
const OUTDOOR_ASSET = /condenser|outdoor|-odu\b|-hpu\b/i;

/**
 * True when an asset's file name names a different component than the record:
 * an outdoor unit shown with an indoor wall head, an air handler shown with a
 * condenser. File names are the only provenance the import kept, so this is a
 * guard, not a proof; flagged records are listed by `npm run catalog:media`.
 */
export function componentMismatch(productType: string, src: string): boolean {
  const file = src.split("/").pop() ?? src;
  if (/system-pair|pair/i.test(file)) return false;
  if (OUTDOOR_TYPES.test(productType) && INDOOR_ASSET.test(file) && !OUTDOOR_ASSET.test(file)) return true;
  if (INDOOR_TYPES.test(productType) && OUTDOOR_ASSET.test(file) && !INDOOR_ASSET.test(file)) return true;
  return false;
}

/** A human verdict from data/catalog/media-review.json. */
export type MediaReview = { verdict: "withhold" | "family"; reason: string };

/**
 * Classify one record against the whole catalog. An image is exact-model media
 * only when every image on the record is used by this model alone; a record
 * with no model number cannot be exact, because there is nothing to match.
 */
export function classifyMedia(record: MediaRecord, index: Map<string, Set<string>>, review?: MediaReview): MediaVerification {
  const automatic = classifyAutomatically(record, index);
  // A reviewer can only lower confidence, never raise it.
  if (review?.verdict === "withhold") return "missing";
  if (review?.verdict === "family" && automatic === "verifiedExact") return "verifiedFamily";
  return automatic;
}

function classifyAutomatically(record: MediaRecord, index: Map<string, Set<string>>): MediaVerification {
  const images = recordImages(record);
  if (record.imageVerification === "unverified" || images.length === 0) {
    return (record.referenceImages ?? []).length > 0 ? "reference" : "missing";
  }
  if (images.some((src) => componentMismatch(record.productType, src))) return "missing";
  if (record.imageVerification === "manufacturer_family") return "verifiedFamily";
  if (!normalizeModel(record.modelNumber)) return "verifiedFamily";
  const shared = images.some((src) => (index.get(src)?.size ?? 0) > 1);
  return shared ? "verifiedFamily" : "verifiedExact";
}

export type MediaNotice = {
  /** Short overlay label. null for exact media, which needs no qualifier. */
  badge: string | null;
  /** One sentence for under the product-page gallery. */
  detail: string;
};

/** The words for each state. Never conveyed by color alone. */
export function mediaNotice(state: MediaDisplayState, modelNumber: string): MediaNotice {
  const model = modelNumber ? `model ${modelNumber}` : "this model";
  switch (state) {
    case "verifiedExact":
      return { badge: null, detail: `Manufacturer image matched to ${model}.` };
    case "verifiedFamily":
      return {
        badge: "Representative",
        detail: `Manufacturer image for this product family, not ${model} specifically. The same image covers more than one model, so size, labels and fittings can differ; match the model number and specifications.`,
      };
    case "reference":
      return {
        badge: "Reference photo",
        detail: `Reference photo that has not been verified against ${model}. Confirm the listed specifications before ordering.`,
      };
    case "missing":
      return {
        badge: null,
        detail: "Use the manufacturer model and specifications on this page when matching equipment.",
      };
    case "loading":
      return { badge: null, detail: "Loading image." };
    case "failed":
      return { badge: null, detail: "This image could not be loaded. The specifications still describe the exact model." };
  }
}
