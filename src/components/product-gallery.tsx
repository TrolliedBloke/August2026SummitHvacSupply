"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff, Maximize2, RotateCcw, X } from "lucide-react";
import * as React from "react";
import { Modal } from "./dialog";
import { reconcileActiveId, type MediaItem } from "@/lib/media";

/**
 * Product media. One component owns the zero, one and many cases.
 *
 *  - The active image is tracked by stable media id, so reordering, insertion
 *    or a failed load never silently swaps which image is shown.
 *  - Controls render only when they do something: no arrows, thumbnails, dots
 *    or count for a single image, and "View larger" only when the asset is
 *    genuinely larger than the gallery displays it. It is a fit-to-screen
 *    view, named for what it does -- not a zoom it cannot deliver.
 *  - A failed image gets a bounded retry and then a designed fallback, never a
 *    blank region.
 *  - On touch, a deliberate horizontal swipe changes image; vertical movement
 *    is left to the page (touch-action: pan-y).
 */

const SWIPE_THRESHOLD_PX = 40;
const MAX_RETRIES = 2;

export function ProductGallery({ media, title }: { media: MediaItem[]; title: string }) {
  const [activeId, setActiveId] = React.useState<string | null>(media[0]?.id ?? null);
  const [previousMedia, setPreviousMedia] = React.useState(media);
  if (previousMedia !== media) {
    setPreviousMedia(media);
    setActiveId(reconcileActiveId(previousMedia, media, activeId));
  }
  // Per-image load failures. A positive count means "failed this many times";
  // a retry flips it negative, which remounts the image under a new key, and
  // the next error continues the count. Past MAX_RETRIES the fallback stays.
  const [failures, setFailures] = React.useState<Record<string, number>>({});
  const [announce, setAnnounce] = React.useState("");
  const [largeOpen, setLargeOpen] = React.useState(false);
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const swipe = React.useRef<{ x: number; y: number; id: number } | null>(null);
  const galleryId = React.useId();

  if (media.length === 0) {
    return (
      <div className="grid aspect-[1.22/1] place-items-center rounded-(--r-md) border border-line bg-surface-1 p-8 text-center">
        <div>
          <ImageOff className="mx-auto text-ink-3" size={36} aria-hidden="true" />
          <p className="mt-3 font-medium text-ink-1">Product photo coming soon</p>
          <p className="mt-1 max-w-sm text-sm text-ink-2">
            Use the manufacturer model and specifications on this page when matching equipment.
          </p>
        </div>
      </div>
    );
  }

  const index = Math.max(0, media.findIndex((item) => item.id === activeId));
  const current = media[index];
  const many = media.length > 1;
  const failedCount = failures[current.id] ?? 0;
  const failed = failedCount > 0;

  function select(nextIndex: number, { focusTab = false } = {}) {
    const wrapped = (nextIndex + media.length) % media.length;
    const next = media[wrapped];
    setActiveId(next.id);
    setAnnounce(`Image ${wrapped + 1} of ${media.length}`);
    if (focusTab) tabRefs.current[next.id]?.focus();
  }

  function onPointerDown(event: React.PointerEvent) {
    if (!many || event.pointerType === "mouse") return;
    swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }
  function onPointerUp(event: React.PointerEvent) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Intentional and mostly horizontal: anything else is the page scrolling.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    select(index + (dx < 0 ? 1 : -1));
  }

  return (
    <div>
      <div
        id={`${galleryId}-panel`}
        role={many ? "tabpanel" : undefined}
        aria-labelledby={many ? `${galleryId}-tab-${current.id}` : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipe.current = null)}
        className="relative aspect-[1.22/1] touch-pan-y select-none overflow-hidden rounded-(--r-md) border border-line bg-surface-1"
      >
        {failed && failedCount > MAX_RETRIES ? (
          <MediaFallback title="Image unavailable" body="This image could not be loaded. The specifications below still describe the exact model." />
        ) : failed ? (
          <MediaFallback
            title="Image did not load"
            body="Check your connection and try again."
            action={
              <button
                type="button"
                onClick={() => setFailures((all) => ({ ...all, [current.id]: -(all[current.id] ?? 1) }))}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-sm font-medium text-ink-1 hover:bg-surface-2"
              >
                <RotateCcw size={15} aria-hidden="true" /> Retry image
              </button>
            }
          />
        ) : (
          <Image
            // A retry remounts the image under a new key.
            key={`${current.id}-${Math.abs(failedCount)}`}
            src={current.src}
            alt={current.alt}
            fill
            draggable={false}
            loading={index === 0 ? "eager" : "lazy"}
            sizes="(min-width: 1024px) 48vw, 100vw"
            className="object-contain p-5 sm:p-12"
            onError={() =>
              setFailures((all) => ({ ...all, [current.id]: Math.abs(all[current.id] ?? 0) + 1 }))
            }
          />
        )}

        {many && (
          <>
            <GalleryButton label="Previous view" className="left-3" onClick={() => select(index - 1)}>
              <ChevronLeft size={20} aria-hidden="true" />
            </GalleryButton>
            <GalleryButton label="Next view" className="right-3" onClick={() => select(index + 1)}>
              <ChevronRight size={20} aria-hidden="true" />
            </GalleryButton>
          </>
        )}
        {current.largeSrc && !failed && (
          <button
            type="button"
            onClick={() => setLargeOpen(true)}
            className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-2 rounded-(--r-sm) border border-line bg-surface-1 px-3 text-sm font-medium text-ink-1 hover:bg-surface-2"
          >
            <Maximize2 size={16} aria-hidden="true" />
            View larger
          </button>
        )}
      </div>

      {current.caption && <p className="mt-2 text-sm text-ink-2">{current.caption}</p>}

      {many && (
        <>
          {/* Phones: position dots and a count, since thumbnails are hidden. */}
          <div className="mt-3 flex items-center justify-center gap-3 sm:hidden" aria-hidden="true">
            <div className="flex gap-1.5">
              {media.map((item, dotIndex) => (
                <span key={item.id} className={`size-2 rounded-full ${dotIndex === index ? "bg-ink-1" : "bg-line-strong border border-ink-4"}`} />
              ))}
            </div>
            <span className="part-number text-micro text-ink-3">
              {index + 1} / {media.length}
            </span>
          </div>
          <div className="mt-4 hidden grid-cols-5 gap-3 sm:grid" role="tablist" aria-label="Product media">
            {media.map((item, tabIndex) => (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[item.id] = node;
                }}
                id={`${galleryId}-tab-${item.id}`}
                type="button"
                role="tab"
                aria-label={`${item.label}, ${tabIndex + 1} of ${media.length}`}
                aria-selected={item.id === current.id}
                aria-controls={`${galleryId}-panel`}
                tabIndex={item.id === current.id ? 0 : -1}
                onClick={() => select(tabIndex)}
                onKeyDown={(event) => {
                  const keys: Record<string, number> = {
                    ArrowRight: tabIndex + 1,
                    ArrowLeft: tabIndex - 1,
                    Home: 0,
                    End: media.length - 1,
                  };
                  const next = keys[event.key];
                  if (next === undefined) return;
                  event.preventDefault();
                  select(next, { focusTab: true });
                }}
                className={`relative aspect-square overflow-hidden rounded-(--r-sm) border-2 bg-surface-1 ${
                  item.id === current.id ? "border-ink-1" : "border-line"
                }`}
              >
                {(failures[item.id] ?? 0) > 0 ? (
                  <ImageOff size={18} className="absolute inset-0 m-auto text-ink-4" aria-hidden="true" />
                ) : (
                  <Image src={item.src} alt="" fill sizes="90px" className="object-contain p-2" />
                )}
              </button>
            ))}
          </div>
          <p role="status" className="sr-only">
            {announce}
          </p>
        </>
      )}

      <Modal
        open={largeOpen}
        onClose={() => setLargeOpen(false)}
        labelledBy={`${galleryId}-large-title`}
        placement="center"
        className="animate-fade-in"
        backdropClassName="bg-[var(--ink-panel)]/85"
      >
        <div
          className="flex items-center justify-between gap-3 border-b border-line px-4 py-2"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <h2 id={`${galleryId}-large-title`} className="min-w-0 truncate text-sm font-medium text-ink-1">
            {title}
            {many && <span className="ml-2 font-normal text-ink-3">{index + 1} of {media.length}</span>}
          </h2>
          <button
            type="button"
            onClick={() => setLargeOpen(false)}
            aria-label="Close larger image"
            className="grid size-11 shrink-0 place-items-center rounded-(--r-sm) text-ink-1 hover:bg-surface-2"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="relative min-h-0 flex-1" style={{ height: "min(80dvh, 900px)" }}>
          {current.largeSrc ? (
            <Image src={current.largeSrc} alt={current.alt} fill sizes="92vw" className="object-contain p-4 sm:p-8" />
          ) : (
            <MediaFallback title="No larger image" body="This view is only available at the size shown on the page." />
          )}
          {many && (
            <>
              <GalleryButton label="Previous view" className="left-3" onClick={() => select(index - 1)}>
                <ChevronLeft size={20} aria-hidden="true" />
              </GalleryButton>
              <GalleryButton label="Next view" className="right-3" onClick={() => select(index + 1)}>
                <ChevronRight size={20} aria-hidden="true" />
              </GalleryButton>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function MediaFallback({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-6 text-center">
      <div>
        <ImageOff className="mx-auto text-ink-3" size={30} aria-hidden="true" />
        <p className="mt-2 font-medium text-ink-1">{title}</p>
        <p className="mt-1 max-w-xs text-sm text-ink-2">{body}</p>
        {action}
      </div>
    </div>
  );
}

function GalleryButton({ label, className, onClick, children }: { label: string; className: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface-1 text-ink-1 hover:bg-surface-2 ${className}`}
    >
      {children}
    </button>
  );
}
