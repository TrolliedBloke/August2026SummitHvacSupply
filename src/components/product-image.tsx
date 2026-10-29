"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import * as React from "react";
import { mediaNotice, type MediaDisplayState, type MediaVerification } from "@/lib/media-verification";

/* Every product photo in a list sits on the same white tile, at one fixed
   aspect ratio with the same padding, so no product carries more visual weight
   than another and every title and SKU below them lines up across cards. Manufacturer
   shots ship with white baked into the file; on the off-white page that white
   showed up as a rectangle of a different size under every product. On a white
   tile it disappears, so photos with different crops still line up as
   identical squares.

   The frame reports what it is showing in `data-media-state`: the catalog's
   verification once the image has decoded, `loading` before, `failed` after an
   error. Screenshot capture waits on it, so a "loaded" capture can never be a
   blank tile. Family and reference photos carry a visible label; meaning is
   never left to color or hover. */
export function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
  verification,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  verification: MediaVerification;
}) {
  const [phase, setPhase] = React.useState<"loading" | "loaded" | "failed">("loading");
  const [previousSrc, setPreviousSrc] = React.useState(src);
  if (previousSrc !== src) {
    setPreviousSrc(src);
    setPhase("loading");
  }

  const showImage = src !== null && verification !== "missing" && phase !== "failed";
  const state: MediaDisplayState = !showImage ? (phase === "failed" ? "failed" : "missing") : phase === "loading" ? "loading" : verification;
  const badge = showImage ? mediaNotice(verification, "").badge : null;

  return (
    <span
      className="@container relative block aspect-[16/10] w-full overflow-hidden rounded-(--r-sm) border border-line bg-surface-1"
      data-media-state={state}
    >
      {showImage ? (
        <>
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            loading={priority ? "eager" : "lazy"}
            onLoad={() => setPhase("loaded")}
            onError={() => setPhase("failed")}
            className="object-contain p-[10%]"
          />
          {/* A thin strip along the bottom edge on small tiles (the compact
              phone list), a corner label once the tile is wide enough that it
              no longer covers the product. */}
          {badge && (
            <span className="absolute inset-x-0 bottom-0 border-t border-line bg-surface-1/95 px-1 text-center text-[0.6875rem] font-medium leading-4 text-ink-2 @min-[11rem]:inset-x-auto @min-[11rem]:bottom-auto @min-[11rem]:left-2 @min-[11rem]:top-2 @min-[11rem]:rounded-(--r-sm) @min-[11rem]:border @min-[11rem]:px-2 @min-[11rem]:py-1 @min-[11rem]:text-micro">
              {badge}
            </span>
          )}
        </>
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-3">
          <ImageOff size={28} aria-hidden="true" />
          <span className="text-xs">{phase === "failed" ? "Image unavailable" : "No verified image"}</span>
        </span>
      )}
    </span>
  );
}
