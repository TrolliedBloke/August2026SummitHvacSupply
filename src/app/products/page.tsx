import { ProductCatalog } from "@/components/product-catalog";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 60;

export async function generateMetadata({ searchParams }: PageProps<"/products">): Promise<Metadata> {
  const query = await searchParams;
  const hasFacet = Object.values(query).some((value) => value !== undefined && value !== "" && value !== "all");
  return pageMetadata({
    title: "HVAC Equipment & Supplies - Search by SKU or Model",
    description: "Search Summit HVAC Supply products by SKU, OEM model, brand, equipment type, capacity, voltage, refrigerant, and pricing status.",
    path: "/products",
    index: !hasFacet,
  });
}

export default function ProductsPage() {
  return <ProductCatalog />;
}
