"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import * as React from "react";

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const slides = images.map((src, index) => ({ src, label: `Manufacturer product view ${index + 1}` }));
  const [active, setActive] = React.useState(0);
  const [zoomed, setZoomed] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const openerRef = React.useRef<HTMLButtonElement>(null);
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const galleryId = React.useId();
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
      <div id={`${galleryId}-panel`} role="tabpanel" aria-labelledby={`${galleryId}-tab-${active}`} className="relative aspect-[1.7/1] overflow-hidden rounded-(--r-md) border border-line bg-surface-2 sm:aspect-[1.22/1]">
        <Image src={current.src} alt={`${title} — manufacturer family view ${active + 1}`} fill loading={active === 0 ? "eager" : "lazy"} sizes="(min-width: 1024px) 48vw, 100vw" className="object-contain p-5 sm:p-12" />
        {slides.length > 1 && <GalleryButton label="Previous view" className="left-3" onClick={() => move(-1)}><ChevronLeft size={20} /></GalleryButton>}
        {slides.length > 1 && <GalleryButton label="Next view" className="right-3" onClick={() => move(1)}><ChevronRight size={20} /></GalleryButton>}
        <button ref={openerRef} type="button" onClick={() => setZoomed(true)} aria-label="Open large product image" className="absolute bottom-3 right-3 grid size-11 place-items-center rounded-(--r-sm) border border-line bg-surface-1 text-ink-1">
          <Maximize2 size={17} />
        </button>
      </div>
      <div className="mt-4 hidden grid-cols-5 gap-3 sm:grid" role="tablist" aria-label="Product media">
        {slides.map((slide, index) => (
          <button
            key={`${slide.label}-${index}`}
            ref={(node) => { tabRefs.current[index] = node; }}
            id={`${galleryId}-tab-${index}`}
            type="button"
            role="tab"
            aria-label={`${slide.label} ${index + 1} of ${slides.length}`}
            aria-selected={active === index}
            aria-controls={`${galleryId}-panel`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              const keys: Record<string, number> = {
                ArrowRight: (index + 1) % slides.length,
                ArrowLeft: (index - 1 + slides.length) % slides.length,
                Home: 0,
                End: slides.length - 1,
              };
              const next = keys[event.key];
              if (next === undefined) return;
              event.preventDefault();
              setActive(next);
              tabRefs.current[next]?.focus();
            }}
            className={`relative aspect-square overflow-hidden rounded-(--r-sm) border bg-surface-1 ${active === index ? "border-ink-1" : "border-line"}`}
          >
            <Image src={slide.src} alt="" fill sizes="90px" className="object-contain p-2" />
          </button>
        ))}
      </div>
      {zoomed && (
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
