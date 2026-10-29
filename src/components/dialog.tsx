"use client";

import * as React from "react";
import { createPortal } from "react-dom";

/**
 * The one modal behaviour, shared by the cart drawer, the mobile navigation,
 * the mobile filter sheet and the gallery's larger view. Each used to carry its
 * own copy of focus trapping and scroll locking, and the copies had drifted:
 * the mobile menu had no Escape, no trap and no focus return at all.
 *
 * The contract, in order:
 *  - focus moves into the panel (to `initialFocus`, else the first control);
 *  - everything outside the panel is `inert`, so it can be neither tabbed to
 *    nor read by a screen reader -- a stronger guarantee than a Tab trap alone;
 *  - Tab wraps inside the panel; Escape calls `onClose(reason)`;
 *  - page scroll is locked and the scroll position is restored exactly;
 *  - on close, focus returns to the element that opened the dialog.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type CloseReason = "escape" | "backdrop" | "button";

export function useModal({
  open,
  onClose,
  panelRef,
  initialFocusRef,
}: {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  panelRef: React.RefObject<HTMLElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Inert every top-level branch of <body> that does not hold the panel.
    const inerted: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child.contains(panel) || child.hasAttribute("inert") || child.tagName === "SCRIPT") continue;
      child.setAttribute("inert", "");
      inerted.push(child);
    }

    // Lock scroll without letting the page jump.
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const previous = { overflow: html.style.overflow, paddingRight: html.style.paddingRight };
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    if (scrollbar > 0) html.style.paddingRight = `${scrollbar}px`;

    const focusFirst = () => {
      const target = initialFocusRef?.current ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      target.focus({ preventScroll: true });
    };
    focusFirst();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current("escape");
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("keydown", onKey, true);
      for (const element of inerted) element.removeAttribute("inert");
      html.style.overflow = previous.overflow;
      html.style.paddingRight = previous.paddingRight;
      if (Math.abs(window.scrollY - scrollY) > 1) window.scrollTo({ top: scrollY, behavior: "instant" as ScrollBehavior });
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, panelRef, initialFocusRef]);
}

/**
 * Portal + backdrop + labelled panel. `placement` picks the shape; everything
 * else about the behaviour is identical. The backdrop's click is reported as
 * its own close reason so a draft-holding caller can decide what it means.
 */
export function Modal({
  open,
  onClose,
  label,
  labelledBy,
  describedBy,
  placement = "right",
  initialFocusRef,
  className = "",
  backdropClassName = "",
  children,
  id,
}: {
  open: boolean;
  onClose: (reason: CloseReason) => void;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  placement?: "right" | "bottom" | "full" | "center";
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  backdropClassName?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const mounted = React.useSyncExternalStore(
    React.useCallback(() => () => undefined, []),
    () => true,
    () => false
  );
  useModal({ open, onClose, panelRef, initialFocusRef });
  if (!mounted || !open) return null;

  const shape: Record<NonNullable<typeof placement>, string> = {
    right: "absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-line bg-surface-1",
    bottom:
      "absolute inset-x-0 bottom-0 flex max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-top)-1rem))] flex-col rounded-t-(--r-lg) border-t border-line bg-canvas",
    full: "absolute inset-0 flex flex-col bg-canvas",
    center:
      "absolute inset-0 m-auto flex h-[min(90dvh,56rem)] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden rounded-(--r-md) bg-surface-1",
  };

  return createPortal(
    <div className="fixed inset-0 z-[80]" data-modal-root="">
      <div
        aria-hidden="true"
        onClick={() => onClose("backdrop")}
        className={`absolute inset-0 bg-[var(--ink-panel)]/50 ${backdropClassName}`}
      />
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`${shape[placement]} outline-none ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
