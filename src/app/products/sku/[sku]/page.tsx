import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Download, Link2, PackageCheck, ShieldCheck } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { AddToQuote } from "@/components/add-to-quote";
import { AccountPrice } from "@/components/account-price";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CommerceStatusLine } from "@/components/commerce-status";
import { NotifyMe } from "@/components/notify-me";
import { ProductGallery } from "@/components/product-gallery";
import { StickyBuyBar } from "@/components/sticky-buy-bar";
import { Container, LinkButton } from "@/components/ui";
import { presentCommerceState, publicCommerceState } from "@/lib/commerce/state";
import { skuMedia } from "@/lib/media";
import { getRelatedSkus, getStorefrontSku, getStorefrontSkus, productHref, skuSlug } from "@/lib/storefront/catalog";
import { applyLiveInventory, applyLiveInventoryAll, getLiveInventory } from "@/lib/storefront/live-inventory";
import { buildProductSchema, getSkuSeoState } from "@/lib/seo/catalog";
import { pageMetadata, safeJsonLd } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";
import { FIELD_GROUPS, FIELD_LABELS, isFieldApplicable } from "@/lib/catalog/field-manifest";
import { CA_STATUS_PUBLIC_LABEL, caResidentialStatus, matchedSystems } from "@/lib/catalog/compliance";
import { compatibilitySummary, productCompatibility } from "@/lib/storefront/compatibility";
import { brandPolicy, internetSaleWarrantyLine, WARRANTY_DISCLOSURE } from "@/lib/brand-policy";
import { isR410a, R410A_POLICY } from "@/lib/refrigerant-policy";

// Every valid slug is known at build time. Without this, an unknown slug is
// rendered on demand and notFound() is served with HTTP 200 -- a soft 404 that
// lets search engines index junk URLs. Unknown params now 404 outright.
/**
 * Conflict wording by category. A contractor needs to know what is uncertain
 * and what we will do about it -- not that a research pipeline flagged a row.
 * None of these expose internal tooling.
 */
const CONFLICT_COPY: Record<string, { heading: string; body: string }> = {
  WAREHOUSE_MODEL_VERIFICATION: {
    heading: "We are confirming this model number",
    body: "This part number does not appear in the manufacturer's published model list for this capacity. We check the rating plate on the unit in Newark before accepting an order, so you do not receive the wrong configuration. The specifications below are the manufacturer's data for this capacity and may change once the model is confirmed.",
  },
  MODEL_NOT_FOUND: {
    heading: "Specifications available on request",
    body: "We have not been able to match this unit to a published manufacturer document, so we are not showing specifications we cannot stand behind. Ask us and we will confirm the exact model, ratings and documentation with the supplier before you order.",
  },
  INVENTORY_CONFLICT: {
    heading: "We are confirming this unit's configuration",
    body: "Our records carry two different values for this item, so we are verifying which is correct against the unit itself before quoting it. Ask us for the confirmed configuration.",
  },
  PURCHASING_RECORD_VERIFICATION: {
    heading: "Part number being confirmed",
    body: "We are confirming the manufacturer part number for this item against our purchase records. Contact us for the exact part before ordering.",
  },
  MANUFACTURER_IDENTITY_UNCERTAIN: {
    heading: "Sold as a generic part",
    body: "This is a standard installation part stocked without a manufacturer-branded part number. The dimensions and materials shown come from our own product description. Ask us if you need a specific brand or a certified equivalent.",
  },
};

export const dynamicParams = false;

/**
 * The page is otherwise static -- identity, specifications and documents change
 * only when the catalog is regenerated and redeployed. Stock is the one field
 * that moves between deploys, so the shell is prerendered and revalidated on a
 * short interval to pick up the QuickBooks counts.
 */
export const revalidate = 60;

export function generateStaticParams() {
  return getStorefrontSkus().map((sku) => ({ sku: skuSlug(sku.sku) }));
}

export async function generateMetadata({ params }: PageProps<"/products/sku/[sku]">): Promise<Metadata> {
  const { sku: skuParam } = await params;
  const sku = getStorefrontSku(decodeURIComponent(skuParam));
  if (!sku) return { title: "SKU not found" };
  const details = [sku.brand, sku.modelNumber, sku.btu ? `${sku.btu.toLocaleString()} BTU` : null, sku.productType].filter(Boolean).join(" · ");
  return pageMetadata({
    title: `${sku.sku} - ${sku.title}`,
    description: `${sku.title}. ${details}. Shop retail or contact Summit HVAC Supply for account pricing and product matching.`,
    path: productHref(sku),
    index: getSkuSeoState(sku).indexable,
  });
}

export default async function SkuPage({ params }: PageProps<"/products/sku/[sku]">) {
  const { sku: skuParam } = await params;
  const record = getStorefrontSku(decodeURIComponent(skuParam));
  if (!record) notFound();
  // Live counts from QuickBooks, where the warehouse has counted this product.
  // Overlays availability only; the product stays quote-only regardless.
  // Fetched once and shared with the related items below, so a visitor never
  // sees one count on the page and a different one in the strip beneath it.
  const live = await getLiveInventory();
  const sku = applyLiveInventory(record, live);
  const related = applyLiveInventoryAll(getRelatedSkus(sku, 4), live);
  const media = skuMedia(sku);
  // The public CommerceState. Price, status and action below all come from it;
  // an approved trade session's own price arrives through <AccountPrice />.
  const commerce = publicCommerceState(sku);
  const commerceView = presentCommerceState(commerce);
  // Manifest-driven: only fields that apply to this equipment type are shown,
  // so a furnace never renders a SEER2 row and a base pad never renders MCA.
  const summaryLabels = new Set(["Brand", "Internal SKU", "Manufacturer model", "Equipment type", "Capacity", "Voltage", "Refrigerant", "Zones", "Bundle / kit"]);
  const researched = FIELD_GROUPS.map((group) => ({
    heading: group.heading,
    rows: group.fields
      .filter((field) => isFieldApplicable(sku.productType, field))
      .map((field) => ({ field, value: sku.specifications[field] }))
      .filter((row) => row.value !== undefined && row.value !== null && row.value !== "")
      .map((row) => ({
        label: FIELD_LABELS[row.field].label,
        value: `${typeof row.value === "number" ? row.value.toLocaleString("en-US") : row.value}${FIELD_LABELS[row.field].unit ? ` ${FIELD_LABELS[row.field].unit}` : ""}`,
        source: sku.fieldSources[row.field]?.sourceUrl ?? sku.fieldSources.specifications?.sourceUrl ?? null,
      }))
      .filter((row) => !summaryLabels.has(row.label)),
  })).filter((group) => group.rows.length > 0);

  const specs = [
    ["Brand", sku.brand],
    ["Internal SKU", sku.sku],
    ["Manufacturer model", sku.modelNumber],
    ["Equipment type", sku.productType],
    ["Capacity", sku.btu ? `${sku.btu.toLocaleString()} BTU${sku.tonnage ? ` (${sku.tonnage} ton)` : ""}` : null],
    ["Voltage", sku.voltage || null],
    // The sheet writes "R454B/A2L". A2L is the ASHRAE flammability class and
    // drives leak-detection, storage and handling requirements, so it travels
    // with the refrigerant rather than being normalised away.
    ["Refrigerant", sku.refrigerant ? `${sku.refrigerant}${sku.refrigerantClass ? ` (${sku.refrigerantClass})` : ""}` : null],
    ["Zones", sku.zones || null],
    ["Bundle / kit", sku.bundleName],
    ["California efficiency", CA_STATUS_PUBLIC_LABEL[caResidentialStatus(sku)]],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  // Only indexable records publish structured data; buildProductSchema returns
  // null for conflicted or incomplete ones.
  const productSchema = buildProductSchema(sku, SITE.origin);
  const equipmentBrand = brandPolicy(sku.brand).kind === "equipment";
  const warrantyLine = equipmentBrand ? internetSaleWarrantyLine(sku.brand) ?? WARRANTY_DISCLOSURE : null;
  const compatibility = productCompatibility(sku, matchedSystems(), getStorefrontSku);
  const compatibilityText = compatibilitySummary(compatibility, sku.refrigerant);
  const model = sku.modelNumber ? `model ${sku.modelNumber}` : "this model";

  /* The evidence, as configuration: each section names itself, carries its
     content or null, and says plainly what is missing when it is null. Deep
     links (#specifications, #documents, ...) are the section ids. */
  const evidence: EvidenceSection[] = [
    {
      id: "overview",
      title: "Overview",
      content: (
        <dl className="divide-y divide-line">
          {specs.map(([label, value]) => (
            <div key={label} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]">
              <dt className="text-sm text-ink-3">{label}</dt>
              <dd className="text-sm font-medium text-ink-1">{value}</dd>
            </div>
          ))}
        </dl>
      ),
      missing: "",
    },
    {
      id: "compatibility",
      title: "Compatibility",
      content: (
        <div className="text-sm leading-6">
          <p className="font-medium text-ink-1">{compatibilityText.label}</p>
          <p className="mt-1 text-ink-2">{compatibilityText.detail}</p>
          {(compatibility.level === "matched" || compatibility.level === "listed") && compatibility.partners.length > 0 && (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {compatibility.partners.map((partner) => (
                <li key={partner.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                  <Link href={productHref(partner)} className="font-medium text-brand underline-offset-4 hover:underline">{partner.title}</Link>
                  <span className="part-number text-xs text-ink-3">{partner.unitType} · {partner.sku}</span>
                </li>
              ))}
            </ul>
          )}
          {sku.ahri && (
            <div className="mt-4">
              <h3 className="text-xs font-medium text-ink-3">AHRI certification</h3>
              {sku.ahri.referenceNumber ? (
                <p className="mt-1 text-ink-1">Certified reference <span className="part-number font-medium">{sku.ahri.referenceNumber}</span>{sku.ahri.certifiedModel ? ` for ${sku.ahri.certifiedModel}` : ""}.</p>
              ) : (
                <p className="mt-1 text-ink-1">
                  {sku.ahri.status === "requires_matched_combination"
                    ? "Rated as a matched system, not as a standalone unit."
                    : sku.ahri.status === "not_applicable"
                      ? "AHRI certification does not apply to this product."
                      : "No AHRI certificate located for this exact model."}
                </p>
              )}
              {sku.ahri.note && <p className="mt-1 text-ink-2">{sku.ahri.note}</p>}
              <a href="https://www.ahridirectory.org/" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-medium text-brand hover:text-brand-hover">Search the AHRI directory</a>
            </div>
          )}
          {compatibility.level === "notEstablished" && (
            <p className="mt-3"><Link href="/finder" className="font-medium text-brand underline-offset-4 hover:underline">Find a matched system</Link></p>
          )}
        </div>
      ),
      missing: "",
    },
    {
      id: "specifications",
      title: "Specifications",
      content:
        researched.length > 0 ? (
          <>
            <p className="text-sm text-ink-2">Read from manufacturer documentation for {model}. Every value links to its source.</p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              {researched.map((group) => (
                <div key={group.heading}>
                  <h3 className="text-xs font-medium text-ink-3">{group.heading}</h3>
                  <dl className="mt-2 divide-y divide-line">
                    {group.rows.map((row) => (
                      <div key={row.label} className="grid gap-1 py-2.5 sm:grid-cols-[160px_1fr]">
                        <dt className="text-sm text-ink-3">{row.label}</dt>
                        <dd className="text-sm font-medium text-ink-1">
                          {row.value}
                          {row.source && <a href={row.source} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs font-normal text-ink-3 underline hover:text-brand">source</a>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </>
        ) : null,
      missing: `Manufacturer specifications have not been verified for ${model} yet. The overview above comes from our inventory records; ask the counter for the spec sheet.`,
    },
    {
      id: "documents",
      title: "Documents",
      content:
        sku.documents.length > 0 ? (
          <>
            <p className="text-sm text-ink-2">Manufacturer documentation confirmed to cover {model}.</p>
            <ul className="mt-3 divide-y divide-line">
              {sku.documents.map((document) => (
                <li key={document.url} className="py-3">
                  <a href={document.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 hover:text-brand">
                    <Download size={16} className="mt-0.5 shrink-0 text-ink-3" />
                    <span>
                      <span className="block font-medium text-ink-1">{document.title}</span>
                      <span className="block text-xs capitalize text-ink-3">{document.kind.replaceAll("_", " ")}{document.coverageNote ? ` · ${document.coverageNote}` : ""}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null,
      missing: `No documents confirmed for ${model} yet. Ask the counter for the installation manual and spec sheet.`,
    },
    {
      id: "warranty",
      title: "Warranty",
      content: sku.warranty ? (
        <div>
          <dl className="space-y-2 text-sm">
            {sku.warranty.parts && <div className="flex justify-between gap-4"><dt className="text-ink-3">Parts</dt><dd className="font-medium text-ink-1">{sku.warranty.parts}</dd></div>}
            {sku.warranty.partsWithRegistration && <div className="flex justify-between gap-4"><dt className="text-ink-3">Parts, registered</dt><dd className="font-medium text-ink-1">{sku.warranty.partsWithRegistration}</dd></div>}
            {sku.warranty.compressor && <div className="flex justify-between gap-4"><dt className="text-ink-3">Compressor</dt><dd className="font-medium text-ink-1">{sku.warranty.compressor}</dd></div>}
            {sku.warranty.heatExchanger && <div className="flex justify-between gap-4"><dt className="text-ink-3">Heat exchanger</dt><dd className="font-medium text-ink-1">{sku.warranty.heatExchanger}</dd></div>}
          </dl>
          {sku.warranty.registrationRequired && (
            <p className="mt-3 text-sm leading-6 text-ink-2">
              Register within {sku.warranty.registrationWindowDays ?? 90} days of installation to keep the extended parts term.
            </p>
          )}
          {sku.warranty.conditions && <p className="mt-2 text-xs leading-5 text-ink-3">{sku.warranty.conditions}</p>}
          {warrantyLine && <p className="mt-2 text-xs leading-5 text-ink-3">{warrantyLine}</p>}
          {sku.warranty.sourceUrl && (
            <a href={sku.warranty.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs font-medium text-brand hover:text-brand-hover">
              Manufacturer warranty source
            </a>
          )}
        </div>
      ) : null,
      missing: "No manufacturer warranty terms on file for this item. Professional installation and registration may be required; the counter can confirm before installation.",
    },
  ];

  return (
    <>
      {productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(productSchema) }}
        />
      )}
      <div className="border-b border-line bg-surface-1">
        <Container className="py-3"><Breadcrumbs items={[{ label: "Products", href: "/products" }, { label: sku.categoryLabel, href: `/products?category=${sku.category}` }, { label: sku.sku, href: productHref(sku) }]} /></Container>
      </div>
      <Container className="py-8 lg:py-12">
        {/* Three areas, one source order: gallery, decision panel, evidence.
            Phones read them in that order; from lg the panel moves to its own
            column and stays in view (sticky) while the evidence scrolls. */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,27rem)] lg:grid-rows-[auto_1fr] lg:gap-x-12">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <ProductGallery media={media.items} title={sku.title} verification={media.verification} modelNumber={sku.modelNumber} />
          </div>

          <aside
            aria-labelledby="product-title"
            className="min-w-0 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain"
            data-decision-panel
          >
            <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-surface-1 px-3 py-1 text-ink-2">{sku.brand}</span><span className="rounded-full bg-surface-1 px-3 py-1 text-ink-2">{sku.categoryLabel}</span><span className="rounded-full bg-surface-1 px-3 py-1 text-ink-2">{sku.productType}</span></div>
            <p className="part-number mt-4 text-sm text-ink-3">SKU {sku.sku}</p>
            <h1 id="product-title" className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink-1">{sku.title}</h1>
            <p className="part-number mt-2 text-sm text-ink-2">{sku.modelNumber ? `Manufacturer model ${sku.modelNumber}` : "Manufacturer model not supplied"}</p>

            {/* A conflict means the model number on our inventory sheet could
                not be found in the manufacturer's own model tables. Saying so
                is the difference between a contractor catching it here and
                catching it when the wrong unit arrives on the job. */}
            {sku.researchStatus === "conflict" && (
              <div className="mt-4 rounded-(--r-md) border border-copper/40 bg-copper-tint p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 shrink-0 text-copper" size={20} />
                  <div>
                    <h2 className="font-medium text-ink-1">{CONFLICT_COPY[sku.conflictType ?? ""]?.heading ?? "We are confirming this model number"}</h2>
                    <p className="mt-1 text-sm leading-6 text-ink-2">
                      {CONFLICT_COPY[sku.conflictType ?? ""]?.body ??
                        "We are confirming this item against the manufacturer's records before any order is accepted."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 border-y border-line py-5">
              <p className="text-sm text-ink-3">{commerceView.priceText ? commerceView.priceQualifier ?? "Price" : "Price"}</p>
              <p className={`mt-1 text-3xl font-semibold text-ink-1 ${commerceView.priceText ? "part-number" : ""}`}>{commerceView.priceText ?? commerceView.priceFallback}</p>
              {commerceView.priceText && (
                <p className="mt-1 text-xs text-ink-3">Plus tax. Approved trade accounts see their own price after sign-in.</p>
              )}
              {sku.bundleName && <p className="mt-2 text-sm text-ink-2">This component may be priced as part of {sku.bundleName}. We confirm the complete configuration before quoting.</p>}
              <AccountPrice skuId={sku.id} />
              <CommerceStatusLine state={commerce} className="mt-4" />
            </div>

            {/* What can I do now, answered in two short rows before the action. */}
            <dl className="divide-y divide-line border-b border-line text-sm">
              <div className="flex gap-3 py-3" data-compatibility-level={compatibility.level}>
                <dt className="sr-only">Compatibility</dt>
                <Link2 className={`mt-0.5 shrink-0 ${compatibility.level === "matched" ? "text-brand" : "text-ink-3"}`} size={18} aria-hidden="true" />
                <dd>
                  <span className="block font-medium text-ink-1">{compatibilityText.label}</span>
                  <a href="#compatibility" className="text-ink-2 underline-offset-4 hover:underline">See what it pairs with</a>
                </dd>
              </div>
              <div className="flex gap-3 py-3">
                <dt className="sr-only">Fulfillment</dt>
                <PackageCheck className="mt-0.5 shrink-0 text-ink-3" size={18} aria-hidden="true" />
                <dd>
                  <span className="block font-medium text-ink-1">Newark pickup or delivery</span>
                  <span className="text-ink-2">Choose at checkout or on your request. Large and unpriced orders go to the counter.</span>
                </dd>
              </div>
            </dl>

            {isR410a(sku.refrigerant) && (
              <p className="mt-5 flex gap-2 rounded-(--r-sm) border border-state-warning-line bg-state-warning p-3 text-sm leading-6 text-state-warning-ink">
                <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
                <span>{R410A_POLICY.contractorNotice}</span>
              </p>
            )}

            {commerceView.action.intent === "notify" ? (
              <div id="restock" className="mt-5 scroll-mt-6">
                <NotifyMe skuId={sku.id} />
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-3">
                <AddToQuote sku={sku} state={commerce} />
                <LinkButton href={`/contact?topic=product&sku=${encodeURIComponent(sku.sku)}`} variant="secondary">Ask about compatibility</LinkButton>
              </div>
            )}
            <p className="mt-4 text-xs leading-5 text-ink-3">
              {commerceView.action.intent === "cart"
                ? "Checkout confirms the price, stock and fulfillment window again before payment."
                : "Requests go to the Newark counter, which confirms price, stock and timing in writing. Nothing is charged."}
            </p>
            <p className="mt-2 text-xs leading-5 text-ink-3">
              Contractor? <Link href="/dealers" className="font-medium text-brand underline-offset-4 hover:underline">Apply for a wholesale account</Link> for account pricing and purchasing tools.
            </p>
          </aside>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <nav aria-label="On this page" className="border-t border-line pt-5">
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {evidence.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className="inline-flex min-h-11 items-center text-ink-2 underline-offset-4 hover:text-ink-1 hover:underline">
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            {evidence.map((section) => (
              <ProductEvidenceSection key={section.id} {...section} />
            ))}
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-12 border-t border-line pt-10" aria-labelledby="nearby-heading">
            <h2 id="nearby-heading" className="font-display text-2xl font-semibold tracking-tight text-ink-1">Nearby catalog items</h2>
            <p className="mt-1 text-sm text-ink-2">Other products in {sku.categoryLabel.toLowerCase()}. Compatibility with this unit is not established; similar capacity does not make a match.</p>
            <div className="product-grid mt-6">
              {related.map((item) => <ProductCard key={item.id} sku={item} />)}
            </div>
          </section>
        )}
        <StickyBuyBar sku={sku} state={commerce} />
      </Container>
    </>
  );
}

type EvidenceSection = {
  id: "overview" | "compatibility" | "specifications" | "documents" | "warranty";
  title: string;
  /** null when the evidence does not exist yet; `missing` then says so. */
  content: React.ReactNode | null;
  missing: string;
};

/** One evidence section. Missing evidence is a sentence, never an empty gap. */
function ProductEvidenceSection({ id, title, content, missing }: EvidenceSection) {
  const icon = id === "warranty" ? <ShieldCheck size={18} aria-hidden="true" className="text-ink-3" /> : null;
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-8 scroll-mt-6 border-t border-line pt-8" data-evidence={id} data-evidence-state={content ? "present" : "missing"}>
      <h2 id={`${id}-heading`} className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-ink-1">
        {icon}
        {title}
      </h2>
      <div className="mt-4">{content ?? <p className="text-sm leading-6 text-ink-2">{missing}</p>}</div>
    </section>
  );
}
