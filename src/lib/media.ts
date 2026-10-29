import manifest from "@/data/media-manifest.generated.json";
import type { MediaVerification } from "@/lib/media-verification";

/**
 * Normalized product media. The gallery used to receive bare URLs and track the
 * active image by index, so a reorder or a failed load silently showed a
 * different image at the same position. Each item now carries a stable id,
 * intrinsic dimensions (from the build-time manifest; null when unknown), alt
 * text, an optional caption, and a large source only when one genuinely exists.
 */

export type MediaItem = {
  id: string;
  kind: "image";
  src: string;
  width: number | null;
  height: number | null;
  /** width / height, or null when the dimensions are unknown. */
  aspectRatio: number | null;
  /** Describes what the image shows. Never repeats the caption. */
  alt: string;
  /** Short name for the view, used to name its thumbnail: "Manufacturer product view 2". */
  label: string;
  /** Visible editorial context, when there is any. */
  caption: string | null;
  /** Set only when the asset is meaningfully larger than the gallery shows it. */
  largeSrc: string | null;
};

/** Longest edge, in pixels, an asset needs before "View larger" shows anything larger. */
export const LARGE_VIEW_MIN_EDGE = 1000;

const DIMENSIONS = manifest as Record<string, { width: number; height: number } | null>;

/** Stable, URL-safe id from the source path: survives reordering and insertion. */
export function mediaId(src: string): string {
  let hash = 2166136261;
  for (let index = 0; index < src.length; index += 1) {
    hash ^= src.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `m${(hash >>> 0).toString(36)}`;
}

export function toMediaItem(
  src: string,
  {
    alt,
    label = alt,
    caption = null,
    dimensions = DIMENSIONS[src] ?? null,
  }: { alt: string; label?: string; caption?: string | null; dimensions?: { width: number; height: number } | null }
): MediaItem {
  const width = dimensions?.width ?? null;
  const height = dimensions?.height ?? null;
  const large = width !== null && height !== null && Math.max(width, height) >= LARGE_VIEW_MIN_EDGE;
  return {
    id: mediaId(src),
    kind: "image",
    src,
    width,
    height,
    aspectRatio: width && height ? width / height : null,
    alt,
    label,
    caption,
    largeSrc: large ? src : null,
  };
}

/** A product's gallery: deduplicated, labelled, in catalog order. */
export function productMedia(images: string[], { title, label }: { title: string; label: string }): MediaItem[] {
  const seen = new Set<string>();
  const unique = images.filter((src) => src && !seen.has(src) && seen.add(src));
  return unique.map((src, index) =>
    toMediaItem(src, { alt: `${title}, ${label.toLowerCase()} ${index + 1}`, label: `${label} ${index + 1}` })
  );
}

/**
 * The active item after the collection changes: the same id if it survived,
 * otherwise the item now nearest the old position. Null for an empty gallery.
 */
export function reconcileActiveId(previous: MediaItem[], next: MediaItem[], activeId: string | null): string | null {
  if (next.length === 0) return null;
  if (activeId && next.some((item) => item.id === activeId)) return activeId;
  const oldIndex = Math.max(0, previous.findIndex((item) => item.id === activeId));
  return next[Math.min(oldIndex, next.length - 1)].id;
}

type SkuMediaInput = {
  title: string;
  image: string;
  images: string[];
  referenceImages: string[];
  mediaVerification: MediaVerification;
};

/**
 * A SKU's media and what it is evidence of, for every surface that shows it.
 * The card shows `primarySrc`; the product page shows `items`. Both carry the
 * same `verification`, so a card cannot look exact while its page says
 * "reference".
 */
export function skuMedia(sku: SkuMediaInput): { verification: MediaVerification; primarySrc: string | null; items: MediaItem[] } {
  const verification = sku.mediaVerification;
  const sources =
    verification === "verifiedExact" || verification === "verifiedFamily"
      ? sku.images.length > 0 ? sku.images : [sku.image]
      : verification === "reference"
        ? sku.referenceImages
        : [];
  const label =
    verification === "verifiedExact" ? "Manufacturer product view" : verification === "verifiedFamily" ? "Manufacturer family view" : "Reference photo";
  const items = productMedia(sources, { title: sku.title, label });
  return { verification, primarySrc: items[0]?.src ?? null, items };
}
