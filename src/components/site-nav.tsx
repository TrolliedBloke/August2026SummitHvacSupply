"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Lock, Search, ChevronDown, ShoppingCart, MapPin } from "lucide-react";
import * as React from "react";
import { useQuote } from "./quote-context";
import { SITE } from "@/lib/site";
import { CATALOG_CATEGORIES } from "@/lib/storefront/catalog";

/* One icon spec for the whole header. Every mark -- pin, magnifier, cart,
   chevron -- is drawn from lucide at this stroke so no single icon reads
   heavier than its neighbours. Sizes vary by role; the weight never does. */
const ICON_STROKE = 1.75;

/* Primary nav mirrors how the counter is organized: equipment first, then the
   parts that go with it, then brand. Every target is a real catalog view --
   nothing here lands on an empty result set. */
const PRIMARY = [
  { href: "/products", label: "Equipment" },
  { href: "/products?category=installation-supplies", label: "Parts" },
  { href: "/products?category=line-sets", label: "Tools" },
  { href: "/brands", label: "Brands" },
];

const RESOURCES = [
  { href: "/resources", label: "Resources" },
  { href: "/tools/model-number-decoder", label: "Model number decoder" },
  { href: "/guides/bay-area-hvac-permits", label: "Permit and code guides" },
  { href: "/bay-area-heat-pump-rebates", label: "Bay area heat pump rebates" },
  { href: "/locations/newark", label: "Newark delivery and will-call" },
];

const RESOURCE_HREFS = RESOURCES.map((r) => r.href);

/* Shared by every row-3 entry so the run reads as an even rhythm: the spacing
   is padding carried by each item, not a fixed gap between labels of very
   different widths. */
const NAV_ITEM = "whitespace-nowrap rounded-(--r-sm) px-3.5 py-2 text-[15px] font-medium transition-colors";

function useClientMounted() {
  return React.useSyncExternalStore(
    React.useCallback(() => () => undefined, []),
    () => true,
    () => false
  );
}

function Wordmark() {
  return (
    <Link href="/" className="flex shrink-0 items-center" aria-label="Summit HVAC Supply home">
      <Image
        src="/logo-summit-lockup.png"
        alt="Summit HVAC Supply"
        width={1010}
        height={280}
        preload
        sizes="160px"
        className="h-9 w-auto object-contain lg:h-10"
      />
    </Link>
  );
}

type SearchResult = {
  id: string;
  sku: string;
  modelNumber: string;
  title: string;
  btu: number;
  voltage: string;
  available: number;
  availabilityStatus: string;
  purchaseEligible: boolean;
  href: string;
};

/* Shared search field + results. Rendered as the bar in row 2 and inside the
   mobile sheet. Fully keyboard-operable (arrows/Enter/Escape). */
function SearchField({
  onNavigate,
  autoFocus = false,
  inline = false,
  withButton = false,
}: {
  onNavigate?: () => void;
  autoFocus?: boolean;
  /** Inline lives in the nav bar, so results float over the page instead of
      pushing the bar taller as the user types. */
  inline?: boolean;
  /** Attaches the green submit button, which runs the query against the
      catalog rather than picking a single typeahead hit. */
  withButton?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [active, setActive] = React.useState(-1);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const requestRef = React.useRef(0);

  React.useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  React.useEffect(() => {
    const trimmed = query.trim();
    const requestId = ++requestRef.current;
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((payload) => {
          if (requestRef.current !== requestId) return;
          setResults(payload.results ?? []);
          setActive(-1);
        })
        .catch(() => undefined)
        .finally(() => {
          if (requestRef.current === requestId) setLoading(false);
        });
    }, 140);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const showResults = query.trim().length >= 2;
  const resultsId = React.useId();

  function onQueryChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setQuery(next);
    if (next.trim().length < 2) {
      setResults([]);
      setActive(-1);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showResults || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      router.push(results[active].href);
      onNavigate?.();
    }
  }

  /* Enter with a highlighted typeahead row is handled above and never reaches
     here; a bare Enter, or the button, runs the full catalog search. */
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    router.push(`/products?q=${encodeURIComponent(trimmed)}`);
    onNavigate?.();
  }

  return (
    <div className={inline ? "relative w-full" : undefined}>
      <form
        onSubmit={onSubmit}
        role="search"
        className="flex h-11 items-stretch overflow-hidden rounded-(--r-sm) border border-line-strong bg-surface-1 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5">
          <Search size={18} strokeWidth={ICON_STROKE} className="shrink-0 text-ink-3" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={onQueryChange}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={showResults && results.length > 0}
            aria-controls={resultsId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${resultsId}-${active}` : undefined}
            placeholder="Part #, model #, or product"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-1 outline-none placeholder:text-ink-4"
            aria-label="Search by SKU or model number"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setActive(-1);
                setLoading(false);
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="grid size-8 shrink-0 place-items-center rounded-(--r-sm) text-ink-2 hover:bg-surface-2 hover:text-ink-1"
            >
              <X size={16} strokeWidth={ICON_STROKE} />
            </button>
          )}
        </div>
        {withButton && (
          <button
            type="submit"
            className="inline-flex shrink-0 items-center px-7 text-sm font-medium text-brand-ink transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--brand)" }}
          >
            Search
          </button>
        )}
      </form>
      {showResults && (
        <ul
          id={resultsId}
          role="listbox"
          aria-label="Search results"
          className={`max-h-[60vh] overflow-y-auto overflow-hidden rounded-(--r-md) border border-line bg-surface-1 ${
            inline ? "absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 shadow-[0_8px_24px_rgba(28,28,26,0.10)]" : "mt-2"
          }`}
        >
          {loading && results.length === 0 && (
            <li className="px-3 py-3 text-sm text-ink-3">Searching…</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-4 text-sm text-ink-3">
              No matches for “{query.trim()}”. Try a model number, or{" "}
              <Link href="/contact" onClick={onNavigate} className="font-medium text-ink-1 underline underline-offset-4">
                contact our team
              </Link>
              .
            </li>
          )}
          {results.map((result, index) => (
            <li key={result.id} role="option" id={`${resultsId}-${index}`} aria-selected={index === active}>
              <Link
                href={result.href}
                onClick={onNavigate}
                onMouseEnter={() => setActive(index)}
                className={`block border-b border-line px-3 py-3 last:border-b-0 ${
                  index === active ? "bg-surface-2" : "hover:bg-surface-2"
                }`}
              >
                <span className="block font-mono text-[11px] font-medium text-ink-3">
                  {result.sku}
                </span>
                <span className="mt-0.5 block text-sm font-medium text-ink-1">{result.title}</span>
                <span className="mt-0.5 block text-xs text-ink-3">
                  {result.modelNumber}{result.btu ? ` · ${result.btu.toLocaleString()} BTU` : ""}{result.voltage ? ` · ${result.voltage}` : ""} · {result.purchaseEligible ? "available to order" : "contact for price"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Closes a popover on outside click and on Escape, returning focus to the
   trigger. Shared by the two row-3 menus so they behave identically. */
function useDismissable(
  open: boolean,
  close: () => void,
  wrapRef: React.RefObject<HTMLDivElement | null>,
  triggerRef?: React.RefObject<HTMLButtonElement | null>
) {
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        triggerRef?.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, wrapRef, triggerRef]);
}

/* "All products" is a mega-menu trigger, not a destination, so it sits apart
   from the category run behind a hairline divider. The panel is built from the
   catalog's own category list -- it cannot drift from the facets. */
function AllProductsMenu() {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismissable(open, close, wrapRef, triggerRef);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${NAV_ITEM} inline-flex items-center gap-3 text-ink-1 hover:bg-surface-2`}
      >
        <Menu size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
        All products
      </button>
      {open && (
        <div
          role="menu"
          aria-label="All product categories"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[560px] rounded-(--r-md) border border-line bg-surface-1 p-2 shadow-[0_8px_24px_rgba(28,28,26,0.10)]"
        >
          <div className="grid grid-cols-2 gap-x-1">
            {CATALOG_CATEGORIES.map((category) => (
              <Link
                key={category.value}
                href={`/products?category=${category.value}`}
                role="menuitem"
                onClick={close}
                className="rounded-(--r-sm) px-3 py-2 text-sm font-medium text-ink-1 hover:bg-surface-2"
              >
                {category.label}
              </Link>
            ))}
          </div>
          <Link
            href="/products"
            role="menuitem"
            onClick={close}
            className="mt-1 block border-t border-line px-3 pb-1 pt-2.5 text-sm font-medium text-brand hover:underline"
          >
            View the full catalog
          </Link>
        </div>
      )}
    </div>
  );
}

function ResourcesMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  const active =
    pathname.startsWith("/guides/") ||
    pathname.startsWith("/tools/") ||
    RESOURCE_HREFS.some((href) => pathname === href || pathname.startsWith(href + "/"));

  useDismissable(open, close, wrapRef, triggerRef);

  function onMenuKeyDown(event: React.KeyboardEvent) {
    if (!open || !menuRef.current) return;
    const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    if (items.length === 0) return;
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (current + 1) % items.length;
    if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next !== null) {
      event.preventDefault();
      items[next].focus();
    }
  }

  return (
    <div ref={wrapRef} className="relative" onKeyDown={onMenuKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            window.setTimeout(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
          }
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${NAV_ITEM} inline-flex items-center gap-1.5 ${
          active || open ? "text-ink-1 underline underline-offset-4" : "text-ink-1 hover:bg-surface-2"
        }`}
      >
        Resources
        <ChevronDown size={15} strokeWidth={ICON_STROKE} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-(--r-md) border border-line bg-surface-1 p-1.5 shadow-[0_8px_24px_rgba(28,28,26,0.10)]"
        >
          {RESOURCES.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={close}
              className="block rounded-(--r-sm) px-3 py-2.5 text-sm font-medium text-ink-1 hover:bg-surface-2"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CartButton() {
  const { count, toggle } = useQuote();
  // The count comes from localStorage (client-only), so defer showing it until
  // after mount -- otherwise SSR (count 0) and hydration (real count) mismatch.
  const mounted = useClientMounted();
  const showCount = mounted && count > 0;
  return (
    <button
      onClick={toggle}
      aria-label={showCount ? `Open your cart (${count} ${count === 1 ? "item" : "items"})` : "Open your cart"}
      className="relative grid size-11 shrink-0 place-items-center rounded-(--r-sm) text-ink-1 transition-colors hover:bg-surface-2"
    >
      <ShoppingCart size={24} strokeWidth={ICON_STROKE} />
      {showCount && (
        <span className="tnum absolute right-0 top-0 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 font-mono text-[10px] font-medium leading-[18px] text-brand-ink">
          {count}
        </span>
      )}
    </button>
  );
}

/* Row 1. Chrome, not navigation: a step down in size and into the muted ink so
   it never competes with the category run two rows below. */
function UtilityStrip() {
  return (
    <div className="hidden border-b border-line bg-surface-2 md:block">
      <div className="mx-auto flex h-9 w-full max-w-[var(--nav-max)] items-center gap-4 px-5 text-xs text-ink-3 sm:px-6 lg:px-[var(--counter-pad)]">
        <MapPin size={14} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden="true" />
        <span className="-ml-2.5 whitespace-nowrap">Newark — Open until 5:00 PM</span>
        <Link
          href="/locations/newark"
          className="whitespace-nowrap underline underline-offset-2 transition-colors hover:text-ink-1"
        >
          Change
        </Link>
        <div className="ml-auto flex items-center gap-6">
          <a href={SITE.phoneHref} className="tnum whitespace-nowrap transition-colors hover:text-ink-1">
            {SITE.phone}
          </a>
          <Link href="/dealers" className="whitespace-nowrap transition-colors hover:text-ink-1">
            Apply for trade account
          </Link>
          <Link href="/account" className="whitespace-nowrap transition-colors hover:text-ink-1">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const closeMobile = () => setMobileOpen(false);

  // Highlight the section, not the filter. Three primary entries share the
  // /products path and differ only by query string, which the server cannot
  // see -- resolving them client-side meant a post-hydration state flip that
  // raced anything reading the nav. Matching on pathname alone is decided at
  // render time, identical on server and client, and only ever marks one
  // entry: the first whose path matches wins.
  const activeHref = PRIMARY.map((item) => item.href).find((href) => {
    const path = href.split("?")[0];
    return pathname === path || pathname.startsWith(path + "/");
  });

  const isActive = (href: string) => href === activeHref;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface-1">
      <UtilityStrip />

      {/* Row 2. Height is the search field plus an even 10px above and below --
          the field owns the row, nothing pads around it. */}
      <div className="mx-auto flex w-full max-w-[var(--nav-max)] items-center gap-6 px-5 py-2.5 sm:px-6 lg:px-[var(--counter-pad)]">
        <Wordmark />
        <div className="hidden min-w-0 flex-1 md:block">
          <SearchField inline withButton />
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <CartButton />
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="grid size-11 place-items-center rounded-(--r-sm) text-ink-1 transition-colors hover:bg-surface-2 xl:hidden"
          >
            {mobileOpen ? <X size={22} strokeWidth={ICON_STROKE} /> : <Menu size={22} strokeWidth={ICON_STROKE} />}
          </button>
        </div>
      </div>

      {/* Row 3. Inline nav appears at xl, exactly where the hamburger above
          hides -- the two switch at the same breakpoint so navigation is never
          unreachable. */}
      <nav aria-label="Product categories" className="hidden border-t border-line xl:block">
        <div className="mx-auto flex w-full max-w-[var(--nav-max)] items-center px-5 py-1.5 sm:px-6 lg:px-[var(--counter-pad)]">
          {/* The trigger sits left of the divider; every destination link sits
              right of it, so the distinction is legible at a glance. */}
          <div className="-ml-3.5">
            <AllProductsMenu />
          </div>
          <span aria-hidden="true" className="mx-4 h-5 w-px shrink-0 bg-line" />
          <ul className="flex min-w-0 items-center">
            {PRIMARY.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${NAV_ITEM} block ${
                    isActive(item.href) ? "text-brand" : "text-ink-1 hover:bg-surface-2"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <ResourcesMenu pathname={pathname} />
            </li>
          </ul>
        </div>
      </nav>

      {/* Mobile / tablet sheet -- available at every width below xl. */}
      {mobileOpen && (
        <div className="border-t border-line bg-canvas xl:hidden">
          <div className="mx-auto flex w-full max-w-[var(--counter-max)] flex-col px-5 py-4 sm:px-6">
            <SearchField onNavigate={closeMobile} />
            <ul className="mt-4 flex flex-col">
              <li>
                <Link
                  href="/products"
                  onClick={closeMobile}
                  className="block rounded-(--r-sm) px-3 py-3 text-[15px] font-medium text-ink-1 hover:bg-surface-2"
                >
                  All products
                </Link>
              </li>
              {PRIMARY.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMobile}
                    className={`block rounded-(--r-sm) px-3 py-3 text-[15px] font-medium hover:bg-surface-2 ${
                      isActive(item.href) ? "text-ink-1 underline underline-offset-4" : "text-ink-1"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2 border-t border-line pt-2">
                <p className="px-3 pb-1 pt-2 text-sm font-medium text-ink-2">
                  Resources
                </p>
                {RESOURCES.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    className="block rounded-(--r-sm) px-3 py-2.5 text-[15px] font-medium text-ink-1 hover:bg-surface-2"
                  >
                    {item.label}
                  </Link>
                ))}
              </li>
              <li>
                <Link
                  href="/contact"
                  onClick={closeMobile}
                  className={`block rounded-(--r-sm) px-3 py-3 text-[15px] font-medium hover:bg-surface-2 ${
                    isActive("/contact") ? "text-ink-1 underline underline-offset-4" : "text-ink-1"
                  }`}
                >
                  Contact
                </Link>
              </li>
              <li className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                <Link
                  href="/quote"
                  onClick={closeMobile}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-(--r-sm) bg-brand text-sm font-medium text-brand-ink"
                >
                  Get help
                </Link>
                <Link
                  href="/account"
                  onClick={closeMobile}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-(--r-sm) border border-line-strong bg-surface-1 text-sm font-medium text-ink-1"
                >
                  <Lock size={14} strokeWidth={ICON_STROKE} /> Sign in
                </Link>
                <a
                  href={SITE.phoneHref}
                  className="flex h-11 items-center justify-center rounded-(--r-sm) bg-surface-2 text-sm font-medium text-ink-1"
                >
                  Call {SITE.phone}
                </a>
                <a
                  href={SITE.smsHref}
                  className="flex h-11 items-center justify-center rounded-(--r-sm) bg-surface-2 text-sm font-medium text-ink-1"
                >
                  Text us
                </a>
              </li>
            </ul>
          </div>
        </div>
      )}
    </header>
  );
}
