import type { StorefrontSku } from "@/lib/storefront/catalog";

/**
 * The brand registry. Everything that varies between brands -- artwork, its
 * intrinsic size, how much breathing room it needs, the note under it -- is
 * data here, so the brands page renders every brand through one BrandMark and
 * one card with no per-brand JSX. A brand the catalog carries but the registry
 * does not know still renders, with a typeset name instead of artwork.
 *
 * `key` is the catalog's own brand value, which is what /products?brand=
 * filters on; hrefs are generated from it, never typed.
 */
export type BrandAsset = {
  src: string;
  width: number;
  height: number;
};

export type BrandEntry = {
  key: string;
  displayName: string;
  asset?: BrandAsset;
  /** Extra inset inside the optical box, as a fraction of it (0-0.3). */
  safeArea?: number;
  /** Fine optical correction for marks that read light or heavy at equal area. */
  opticalScale?: number;
  note?: string;
};

export const BRAND_REGISTRY: BrandEntry[] = [
  {
    key: "Carrier",
    displayName: "Carrier",
    asset: { src: "/brands/carrier-logo.png", width: 800, height: 320 },
    note: "Central-system equipment: furnaces, evaporator coils, and matched air handlers.",
  },
  {
    key: "TCL",
    displayName: "TCL",
    asset: { src: "/brands/tcl-logo.png", width: 286, height: 89 },
    opticalScale: 0.9,
    note: "Mini-split indoor and outdoor units, multi-zone condensers, air handlers, and cassettes.",
  },
  {
    key: "Tosot",
    displayName: "Tosot",
    // Trimmed from the 4000x1000 source, which was mostly empty canvas.
    asset: { src: "/brands/tosot-logo-trimmed.png", width: 1157, height: 207 },
    note: "Wall-mount mini-splits and multi-zone outdoor units, including R-32 A2L equipment.",
  },
];

/** Catalog brand values that are not shopped by brand. */
export const NON_BRANDS = new Set(["Unbranded", ""]);

/** Past this many brands the page groups them alphabetically with jump links. */
export const BRAND_GROUPING_THRESHOLD = 12;

export type BrandCard = BrandEntry & {
  href: string;
  productCount: number;
  priceFrom: number | null;
  categories: string[];
};

export function brandHref(key: string): string {
  return `/products?brand=${encodeURIComponent(key)}`;
}

export function brandDirectory(skus: StorefrontSku[], registry: BrandEntry[] = BRAND_REGISTRY): BrandCard[] {
  const keys = Array.from(new Set(skus.map((sku) => sku.brand))).filter((brand) => !NON_BRANDS.has(brand));
  return keys
    .map((key) => {
      const entry = registry.find((candidate) => candidate.key === key) ?? { key, displayName: key };
      const owned = skus.filter((sku) => sku.brand === key);
      const priced = owned.map((sku) => sku.retailPrice).filter((price): price is number => price !== null);
      return {
        ...entry,
        href: brandHref(key),
        productCount: owned.length,
        priceFrom: priced.length ? Math.min(...priced) : null,
        categories: Array.from(new Set(owned.map((sku) => sku.categoryLabel))).sort(),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Size a mark so every brand covers the same visual area inside the box,
 * whatever its aspect ratio: wide marks get shorter, tall ones narrower.
 */
export function opticalSize(asset: BrandAsset, box: { width: number; height: number }, entry: Pick<BrandEntry, "safeArea" | "opticalScale"> = {}) {
  const inset = 1 - 2 * (entry.safeArea ?? 0);
  const maxWidth = box.width * inset;
  const maxHeight = box.height * inset;
  const ratio = asset.width / asset.height;
  const area = maxWidth * maxHeight * 0.42 * (entry.opticalScale ?? 1) ** 2;
  let width = Math.sqrt(area * ratio);
  let height = width / ratio;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / ratio;
  }
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  return { width: Math.round(width), height: Math.round(height) };
}
