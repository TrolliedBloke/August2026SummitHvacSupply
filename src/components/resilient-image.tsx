"use client";

import Image, { type ImageProps } from "next/image";
import { ImageOff } from "lucide-react";
import * as React from "react";

/**
 * An image that degrades to a designed, neutral panel when the asset fails,
 * instead of leaving a blank hole in the layout. The fallback keeps the alt
 * text visible, so an informative image still informs.
 */
export function ResilientImage({ alt, className = "", ...props }: ImageProps & { alt: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <span role="img" aria-label={alt} className="absolute inset-0 grid place-items-center bg-surface-2 p-6 text-center">
        <span>
          <ImageOff size={28} className="mx-auto text-ink-3" aria-hidden="true" />
          <span className="mt-2 block text-sm text-ink-2">{alt}</span>
        </span>
      </span>
    );
  }
  return <Image alt={alt} className={className} onError={() => setFailed(true)} {...props} />;
}
