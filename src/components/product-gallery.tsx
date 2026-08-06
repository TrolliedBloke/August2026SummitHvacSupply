"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import * as React from "react";

export type GallerySpec = { label: string; value: string };

export function ProductGallery({ images, title, specs }: { images: string[]; title: string; specs: GallerySpec[] }) {
  const slides = [
    ...images.map((src) => ({ kind: "photo" as const, src, label: "Product view" })),
    { kind: "dimensions" as const, label: "Dimensions" },
  ];
  const [active, setActive] = React.useState(0);
  const [zoomed, setZoomed] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const openerRef = React.useRef<HTMLButtonElement>(null);
  const current = slides[active];
  const move = (direction: number) => setActive((value) => (value + direction + slides.length) % slides.length);

  React.useEffect(() => {
    if (!zoomed) return;
    const opener = openerRef.current;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setZoomed(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus();
    };
  }, [zoomed]);

  return (
    <div>
      <div className="relative aspect-[1.7/1] overflow-hidden rounded-(--r-md) border border-line bg-surface-2 sm:aspect-[1.22/1]">
        {current.kind === "photo" ? (
          <Image src={current.src} alt={title} fill loading="eager" sizes="(min-width: 1024px) 48vw, 100vw" className="object-contain p-5 sm:p-12" />
        ) : (
          <DimensionalView title={title} specs={specs} />
        )}
        <GalleryButton label="Previous view" className="left-3" onClick={() => move(-1)}><ChevronLeft size={20} /></GalleryButton>
        <GalleryButton label="Next view" className="right-3" onClick={() => move(1)}><ChevronRight size={20} /></GalleryButton>
        {current.kind === "photo" && (
          <button ref={openerRef} type="button" onClick={() => setZoomed(true)} aria-label="Open large product image" className="absolute bottom-3 right-3 grid size-11 place-items-center rounded-(--r-sm) border border-line bg-surface-1 text-ink-1">
            <Maximize2 size={17} />
          </button>
        )}
      </div>
      <div className="mt-4 hidden grid-cols-5 gap-3 sm:grid" role="tablist" aria-label="Product media">
        {slides.map((slide, index) => (
          <button key={`${slide.label}-${index}`} type="button" role="tab" aria-selected={active === index} onClick={() => setActive(index)} className={`relative aspect-square overflow-hidden rounded-(--r-sm) border bg-surface-1 ${active === index ? "border-ink-1" : "border-line"}`}>
            {slide.kind === "photo" ? <Image src={slide.src} alt="" fill sizes="90px" className="object-contain p-2" /> : <span className="px-1 font-mono text-[10px] text-ink-2">Dimensions</span>}
          </button>
        ))}
      </div>
      {zoomed && current.kind === "photo" && (
        <div ref={dialogRef} className="fixed inset-0 z-[80] grid place-items-center bg-[var(--ink-panel)]/90 p-5" role="dialog" aria-modal="true" aria-labelledby="product-zoom-title" onClick={() => setZoomed(false)}>
          <h2 id="product-zoom-title" className="sr-only">Large image of {title}</h2>
          <button ref={closeRef} type="button" aria-label="Close large image" className="absolute right-5 top-5 grid size-11 place-items-center rounded-(--r-sm) bg-surface-1 text-ink-1" onClick={() => setZoomed(false)}><X size={20} /></button>
          <div className="relative h-[82vh] w-[min(92vw,1100px)] bg-surface-1" onClick={(event) => event.stopPropagation()}>
            <Image src={current.src} alt={title} fill sizes="92vw" className="object-contain p-8" />
          </div>
        </div>
      )}
    </div>
  );
}

function GalleryButton({ label, className, onClick, children }: { label: string; className: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} onClick={onClick} className={`absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface-1 text-ink-1 ${className}`}>{children}</button>;
}

function DimensionalView({ title, specs }: { title: string; specs: GallerySpec[] }) {
  return (
    <div className="absolute inset-0 grid place-content-center p-8 text-center">
      <div className="mx-auto h-28 w-52 border border-ink-1" aria-hidden />
      <p className="mt-5 font-mono text-sm text-ink-1">{title}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-left">
        {specs.map((spec) => <div key={spec.label}><dt className="text-xs text-ink-3">{spec.label}</dt><dd className="mt-0.5 font-mono text-sm text-ink-1">{spec.value}</dd></div>)}
      </dl>
    </div>
  );
}
