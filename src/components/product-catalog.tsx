import * as React from "react";
import { Container, Eyebrow } from "@/components/ui";
import { SkuCatalogClient } from "@/components/sku-catalog-client";
import { ZipGate } from "@/components/zip-gate";
import { getCatalogFacets, getStorefrontSkus, productHref } from "@/lib/storefront/catalog";
import { matchedSystems } from "@/lib/catalog/compliance";
import { applyLiveInventoryAll, getLiveInventoryResult } from "@/lib/storefront/live-inventory";
import { CatalogResultsSkeleton } from "@/components/catalog-skeleton";

export async function ProductCatalog() {
  const live = await getLiveInventoryResult();
  const skus = applyLiveInventoryAll(getStorefrontSkus(), live.inventory);
  const facets = getCatalogFacets();
  // AHRI-matched pairs, for the "complete system" task. Plain data: the client
  // never needs the compliance module.
  const systems = matchedSystems().map((system) => ({
    ahriReference: system.ahriReference,
    brand: system.brand,
    btu: system.btu,
    refrigerant: system.refrigerant,
    components: system.components.map((component) => ({ sku: component.sku, unitType: component.unitType, href: productHref(component) })),
  }));
  return (
    <>
      <section className="border-b border-line bg-surface-1">
        <Container className="py-12 lg:py-14">
          <Eyebrow>Wholesale + retail HVAC catalog</Eyebrow>
          <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink-1 sm:text-4xl">
            Find equipment and supplies by SKU, model, brand, and capacity.
          </h1>
          <p className="mt-3 max-w-2xl text-ink-2">
            Shop listed retail prices or request help with unpriced equipment.
            Approved wholesale accounts receive account pricing and trade purchasing tools after sign-in.
          </p>
          <div className="mt-5">
            <ZipGate />
          </div>
        </Container>
      </section>

      <Container className="py-10 lg:py-12">
        <React.Suspense fallback={<CatalogResultsSkeleton />}>
          <SkuCatalogClient skus={skus} facets={facets} systems={systems} inventoryStatus={live.status} />
        </React.Suspense>
      </Container>
    </>
  );
}
