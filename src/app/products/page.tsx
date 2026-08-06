import { ProductCatalog } from "@/components/product-catalog";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 60;

export async function generateMetadata({ searchParams }: PageProps<"/products">): Promise<Metadata> {
  const query = await searchParams;
  const hasFacet = Object.values(query).some((value) => value !== undefined && value !== "" && value !== "all");
  return pageMetadata({
    title: "TCL HVAC SKUs - Search Stock, Specs & Pricing",
    description: "Search Summit HVAC Supply SKUs by model, BTU, voltage, unit type, stock, documents, and contractor pricing.",
    path: "/products",
    index: !hasFacet,
  });
}

export default function ProductsPage() {
  return <ProductCatalog />;
}
