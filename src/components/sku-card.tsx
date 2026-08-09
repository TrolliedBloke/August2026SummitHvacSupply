import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ImageOff } from "lucide-react";
import { AddToQuote } from "./add-to-quote";
import { Chip } from "./ui";
import { productHref, type StorefrontSku } from "@/lib/storefront/catalog";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function SkuCard({ sku, priority = false }: { sku: StorefrontSku; priority?: boolean }) {
  return (
    <article className="group min-w-0 flex flex-col overflow-hidden rounded-(--r-md) border border-line bg-surface-1 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
      <Link href={productHref(sku)} className="relative flex aspect-[16/10] items-center justify-center bg-surface-2">
        {sku.imageVerified ? (
          <>
            <Image src={sku.image} alt={`${sku.title}, model ${sku.modelNumber}`} fill loading={priority ? "eager" : "lazy"} sizes="(min-width: 1024px) 360px, 100vw" className="object-contain p-4" />
          </>
        ) : (
          <span className="flex flex-col items-center gap-2 text-ink-3"><ImageOff size={28} aria-hidden="true" /><span className="text-xs">Exact image being verified</span></span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">{sku.brand}</Chip>
          <Chip tone="neutral">{sku.categoryLabel}</Chip>
          <Chip tone={sku.purchaseEligible ? "eco" : "lead"}>{sku.purchaseEligible ? "Available to order" : "Contact for price"}</Chip>
        </div>
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">SKU {sku.sku}</p>
          <h3 className="mt-1 [overflow-wrap:anywhere] font-display text-xl font-semibold tracking-tight text-ink-1"><Link href={productHref(sku)} className="hover:text-brand">{sku.title}</Link></h3>
          <p className="mt-1 break-words text-sm text-ink-2">{sku.modelNumber ? `Model ${sku.modelNumber} · ` : ""}{sku.productType}</p>
        </div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-(--r-sm) border border-line bg-line text-center">
          <Spec label="Price" value={sku.retailPrice !== null ? currency(sku.retailPrice) : "Request"} />
          <Spec label="Capacity" value={sku.btu ? `${sku.btu.toLocaleString()} BTU` : "Not listed"} />
          <Spec label="Voltage" value={sku.voltage || "Not listed"} />
        </dl>
        <div className="mt-auto flex flex-wrap items-center gap-3">
          <AddToQuote sku={sku} size="sm" />
          <Link href={productHref(sku)} className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-brand">Details <ArrowUpRight size={15} /></Link>
        </div>
      </div>
    </article>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 flex-col justify-center bg-surface-1 px-2 py-2"><dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">{label}</dt><dd className="mt-1 break-words font-mono text-xs font-semibold text-ink-1">{value}</dd></div>;
}
