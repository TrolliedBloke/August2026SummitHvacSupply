import type { Metadata } from "next";
import { SITE } from "@/lib/site";

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  image?: string;
};

export function pageMetadata({
  title,
  description,
  path,
  index = true,
  image = "/site/generated/newark-warehouse-stock.jpg",
}: PageMetadataInput): Metadata {
  const url = new URL(path, SITE.origin).toString();
  const imageUrl = new URL(image, SITE.origin).toString();

  return {
    title,
    description,
    alternates: { canonical: path },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: true, googleBot: { index: false, follow: true } },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      type: "website",
      images: [{ url: imageUrl, width: 1600, height: 900, alt: `${SITE.name} in Newark, California` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
