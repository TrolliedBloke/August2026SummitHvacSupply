"use client";

import Image from "next/image";
import * as React from "react";
import { opticalSize, type BrandEntry } from "@/lib/brands";

const BOX = { width: 260, height: 112 };

/**
 * One way to draw any brand: its artwork, contain-sized to the same optical
 * area inside the same box, or -- when there is no artwork or it fails to
 * load -- the name set as a wordmark. Decorative either way: the card's
 * heading already names the brand, so screen readers hear it once.
 */
export function BrandMark({ entry }: { entry: BrandEntry }) {
  const [failed, setFailed] = React.useState(false);
  const asset = entry.asset;
  return (
    <div aria-hidden="true" className="grid h-[180px] place-items-center border-b border-line bg-[#fbfaf7] px-6">
      {asset && !failed ? (
        (() => {
          const size = opticalSize(asset, BOX, entry);
          return (
            <Image
              src={asset.src}
              alt=""
              width={size.width}
              height={size.height}
              sizes={`${size.width}px`}
              onError={() => setFailed(true)}
              className="max-w-full object-contain"
              style={{ width: size.width, height: "auto" }}
            />
          );
        })()
      ) : (
        <span className="max-w-full break-words text-center text-3xl font-semibold tracking-tight text-ink-1">{entry.displayName}</span>
      )}
    </div>
  );
}
