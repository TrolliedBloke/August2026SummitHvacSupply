import * as React from "react";
import { Container, Eyebrow } from "@/components/ui";
import { SkuCatalogClient } from "@/components/sku-catalog-client";
import { ZipGate } from "@/components/zip-gate";
import { getCatalogFacets, getStorefrontSkus } from "@/lib/storefront/catalog";

export function ProductCatalog() {
  const skus = getStorefrontSkus();
  const facets = getCatalogFacets();
  return (
    <>
      <section className="border-b border-line bg-surface-1">
        <Container className="py-12 lg:py-14">
          <Eyebrow>Wholesale + retail HVAC catalog</Eyebrow>
          <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
            Find equipment and supplies by SKU, model, brand, and capacity.
          </h1>
          <p className="mt-3 max-w-2xl text-ink-2">
            The catalog reflects our current inventory list. Availability, exact
            imagery, compatibility, and manufacturer documents are confirmed before
            an order is accepted. Add any product to a quote for a verified response.
          </p>
          <div className="mt-5">
            <ZipGate />
          </div>
        </Container>
      </section>

      <Container className="py-10 lg:py-12">
        <React.Suspense fallback={<p className="text-sm text-ink-3">Loading SKU filters...</p>}>
          <SkuCatalogClient skus={skus} facets={facets} />
        </React.Suspense>
      </Container>
    </>
  );
}
