import Image from "next/image";
import { ImageOff } from "lucide-react";

/* Every product photo in a list sits on the same white square. Manufacturer
   shots ship with white baked into the file; on the off-white page that white
   showed up as a rectangle of a different size under every product. On a white
   tile it disappears, so photos with different crops still line up as
   identical squares. */
export function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <span className="relative block aspect-square w-full overflow-hidden rounded-(--r-sm) bg-surface-1">
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} loading={priority ? "eager" : "lazy"} className="object-contain p-[10%]" />
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-3">
          <ImageOff size={28} aria-hidden="true" />
          <span className="text-xs">Image coming soon</span>
        </span>
      )}
    </span>
  );
}
