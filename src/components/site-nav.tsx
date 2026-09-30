"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Check, Menu, X, Lock, Search, ShoppingCart, MapPin, Phone, UserRound } from "lucide-react";
import * as React from "react";
import { useQuote } from "./quote-context";
import { branchStatus, formatHour } from "@/lib/branch-hours";
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
  { href: "/tools/model-number-decoder", label: "Model number decoder" },
  { href: "/guides/bay-area-hvac-permits", label: "Permit and code guides" },
  { href: "/bay-area-heat-pump-rebates", label: "Bay Area Heat Pump Rebates" },
  { href: "/locations/newark", label: "Newark delivery and will-call" },
];

const CATEGORY_RAIL = [
  { href: "/products?category=mini-splits", label: "Mini splits" },
  { href: "/products?q=condenser", label: "Condensers" },
  { href: "/products?category=furnaces", label: "Furnaces" },
  { href: "/products?category=air-handlers", label: "Air handlers" },
  { href: "/products?category=evaporator-coils", label: "Coils" },
  { href: "/products?category=line-sets", label: "Line sets" },
  { href: "/products?refrigerant=R-454B", label: "Refrigerant" },
  { href: "/products?category=controls", label: "Thermostats" },
] as const;

/* Shared by every row-3 entry so the run reads as an even rhythm: the spacing
   is padding carried by each item, not a fixed gap between labels of very
   different widths. */
const NAV_ITEM =
  "inline-flex h-16 items-center whitespace-nowrap px-4 text-base font-medium text-ink-1 transition-colors duration-120";
/* The 2px green underline is a state, not decoration: it shows on hover, while
   the menu is open, and on the current category page (aria-current). The
   homepage therefore carries none, because "All products" is a menu trigger and
   no category is current. */
const NAV_UNDERLINE =
  "relative after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-brand after:opacity-0 after:transition-opacity after:duration-120 hover:after:opacity-100";
const NAV_UNDERLINE_ON = "after:opacity-100";

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
        sizes="(min-width: 1024px) 270px, 160px"
        className="h-9 w-auto object-contain md:h-12 lg:h-16"
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
        className="flex h-13 items-stretch overflow-hidden rounded-(--r-sm) border border-line-strong bg-surface-1 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25"
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
            placeholder="Search products, models, or SKUs"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-1 outline-none placeholder:text-ink-4"
            aria-label="Search products, models, or SKUs"
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
            className="inline-flex w-30 shrink-0 items-center justify-center text-base font-medium text-brand-ink transition-colors duration-120 hover:bg-[var(--green-deep)]"
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
                <span className="block text-xs font-medium text-ink-3">
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
        className={`${NAV_ITEM} inline-flex items-center gap-4 text-ink-1 hover:bg-surface-2`}
      >
        {/* The header already carries a menu button on mobile; two hamburgers
            side by side read as two different menus. */}
        <Menu size={22} strokeWidth={2} aria-hidden="true" className="hidden md:block" />
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

function AccountMenu() {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismissable(open, close, wrapRef, triggerRef);

  return (
    <div ref={wrapRef} className="relative hidden lg:block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="account-menu-panel"
        className={`inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-(--r-sm) px-3 text-sm font-medium text-ink-1 transition-colors ${
          open ? "bg-surface-1" : "hover:bg-surface-1"
        }`}
      >
        <UserRound size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
        Sign in
      </button>

      {open && (
        <div
          id="account-menu-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="account-menu-title"
          className="absolute right-[-60px] top-[calc(100%+1rem)] z-50 w-[360px] rounded-(--r-sm) border border-line-strong bg-surface-1 p-6 shadow-[0_12px_32px_rgba(28,28,26,0.14)]"
        >
          <span
            aria-hidden="true"
            className="absolute -top-[9px] right-[99px] size-4 rotate-45 border-l border-t border-line-strong bg-surface-1"
          />
          <button
            type="button"
            onClick={() => {
              close();
              triggerRef.current?.focus();
            }}
            aria-label="Close account menu"
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-(--r-sm) text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-1"
          >
            <X size={20} strokeWidth={ICON_STROKE} />
          </button>

          <p id="account-menu-title" className="pr-8 text-base leading-6 text-ink-2">
            <strong className="font-semibold text-ink-1">Sign in</strong> for a better buying experience:
          </p>
          <ul className="mt-3 space-y-2.5 text-sm leading-5 text-ink-2">
            {[
              "Faster checkout",
              "Order tracking and saved equipment",
              "Account pricing for approved trade customers",
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5">
                <Check size={17} strokeWidth={2.25} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-2.5">
            <Link
              href="/account"
              onClick={close}
              className="flex h-12 items-center justify-center rounded-(--r-sm) bg-brand px-4 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Create account
            </Link>
            <Link
              href="/portal/login"
              onClick={close}
              className="flex h-12 items-center justify-center rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-base font-semibold text-ink-1 transition-colors hover:bg-surface-2"
            >
              Sign in
            </Link>
          </div>
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
      className="relative flex h-11 shrink-0 items-center gap-2 rounded-(--r-sm) px-2.5 text-sm font-medium text-ink-1 transition-colors hover:bg-surface-2 lg:px-3"
    >
      <span className="relative grid size-6 place-items-center">
        <ShoppingCart size={24} strokeWidth={ICON_STROKE} />
        {showCount && (
          <span className="tnum absolute -right-2 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-ink-1 px-1 text-xs font-medium leading-[18px] text-white">
            {count}
          </span>
        )}
      </span>
      {/* Labelled from lg, matching Sign in beside it. Two labelled controls
          give the right side enough weight to sit opposite the wordmark; a lone
          glyph did not. Below lg the label drops and the icon stands alone. */}
      <span className="hidden lg:inline">Cart</span>
    </button>
  );
}

/* Row 1. Chrome, not navigation -- but on the ink panel rather than a light
   tint. Three white bands stacked (utility, search, category) separated only by
   hairlines gave the page no top edge at all: the strip receded instead of
   capping. Dark ink caps it, and by contrast pushes the white search row below
   it forward.
   
   This is not a new colour. --ink-panel is already the full-width footer, so
   the same token now bookends the page top and bottom. It also raises the
   strip's contrast from 5.11:1 (muted ink on white -- AA, but quiet enough to
   disappear) to 11.3:1. */
function UtilityStrip() {
  // The status line is time-dependent, so it renders the stable closing-hour
  // label on the server and swaps to live open/closed state after mount. Both
  // strings come from BRANCH_HOURS; neither is written by hand.
  const mounted = useClientMounted();
  const status = mounted ? branchStatus().label : `Open until ${formatHour(17)}`;

  return (
    <div className="hidden bg-[var(--green-deep)] md:block">
      <div className="mx-auto flex h-12 w-full max-w-[var(--page-max)] items-center gap-3 px-5 text-meta font-medium text-white">
        <MapPin size={14} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">Newark, CA</span>
        <span aria-hidden="true" className="text-white/50">·</span>
        <span className="whitespace-nowrap">{status}</span>
        <Link
          href="/locations/newark"
          className="ml-1 inline-flex items-center whitespace-nowrap py-3 underline underline-offset-2 transition-colors hover:text-white/80"
        >
          Change
        </Link>
        {/* Sign in lives in the row below, beside the cart, where an account
            control is looked for. Carrying it here as well put the same link on
            screen twice. */}
        <div className="ml-auto flex items-center gap-5">
          <a
            href={SITE.phoneHref}
            className="tnum inline-flex items-center gap-2 whitespace-nowrap py-3 transition-colors hover:text-white/80"
          >
            <Phone size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
            {SITE.phone}
          </a>
          <Link href="/resources" className="inline-flex items-center whitespace-nowrap py-3 transition-colors hover:text-white/80">
            Resources
          </Link>
          <span className="h-5 w-px bg-white/35" aria-hidden="true" />
          <Link href="/dealers" className="inline-flex items-center whitespace-nowrap py-3 transition-colors hover:text-white/80">
            Apply for trade account
          </Link>
        </div>
      </div>
    </div>
  );
}


/* The category run. `query` is null until the client provides it, so the server
   can prerender the links and only the current-page marking waits. */
function CategoryLinks({ pathname, query }: { pathname: string; query: string | null }) {
  const isCurrent = (href: string) => {
    if (query === null) return false;
    const [path, itemQuery = ""] = href.split("?");
    if (pathname !== path) return false;
    return itemQuery ? query === itemQuery : query === "";
  };

  return (
    <ul className="flex shrink-0 items-center">
      {CATEGORY_RAIL.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={isCurrent(item.href) ? "page" : undefined}
            className={`${NAV_ITEM} ${NAV_UNDERLINE} block ${isCurrent(item.href) ? NAV_UNDERLINE_ON : ""}`}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CategoryRail({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  return <CategoryLinks pathname={pathname} query={searchParams.toString()} />;
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
    <header className="relative z-30 bg-surface-2">
      <UtilityStrip />

      {/* Row 2 follows the approved retail-header proportion: compact on
          phones, then an 80px light band on larger screens. The larger Summit
          lockup lets the mountain do the same visual work as the reference
          mark without redrawing or altering the brand asset. */}
      <div className="mx-auto flex w-full max-w-[var(--page-max)] items-center gap-6 bg-surface-2 px-5 py-2.5 md:py-[18px] lg:py-[15px]">
        <Wordmark />
        {/* The field is capped rather than greedy. Left to flex-1 it ran 1092px
            of a 1400px row -- 78% of the header against a right cluster of one
            bare icon -- so the row read as a search bar with a logo stuck to it.
            Capped and centred, the three groups (mark / search / account) each
            hold their own space, which is what makes a retail header feel
            balanced rather than empty on the right. */}
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <div className="w-full max-w-[827px]">
            <SearchField inline withButton />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <AccountMenu />
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

      {/* Primary destinations and the product rail are one navigation zone.
          Only the content-width rule after row one separates their hierarchy;
          there is no full-width bar between them or rule beneath the rail. */}
      {/* One navigation row, as the reference has it: the All-products trigger,
          then the category run, with Brands pinned right. Equipment/Parts/Tools
          were query filters on /products and live in the trigger's menu, which
          lists every category -- a second row of them was the same links twice.
          Every gap is identical because the spacing is fixed padding carried by
          each item (NAV_ITEM), never space-between. */}
      <nav aria-label="Store navigation" className="border-b border-line bg-surface-2">
        <div className="mx-auto w-full max-w-[var(--page-max)] px-5">
          <div className="flex items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="-ml-4 shrink-0">
              <AllProductsMenu />
            </div>
            <Suspense fallback={<CategoryLinks pathname={pathname} query={null} />}>
              <CategoryRail pathname={pathname} />
            </Suspense>
            <Link
              href="/brands"
              aria-current={pathname === "/brands" ? "page" : undefined}
              className={`${NAV_ITEM} ${NAV_UNDERLINE} ml-auto -mr-4 shrink-0 ${
                pathname === "/brands" ? NAV_UNDERLINE_ON : ""
              }`}
            >
              Brands
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile / tablet sheet -- available at every width below xl. */}
      {mobileOpen && (
        <div className="border-t border-line bg-canvas xl:hidden">
          <div className="mx-auto flex w-full max-w-[var(--page-max)] flex-col px-5 py-4">
            <SearchField onNavigate={closeMobile} />
            <ul className="mt-4 flex flex-col">
              <li>
                <Link
                  href="/products"
                  onClick={closeMobile}
                  className="block rounded-(--r-sm) px-3 py-3 text-base font-medium text-ink-1 hover:bg-surface-2"
                >
                  All products
                </Link>
              </li>
              {PRIMARY.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMobile}
                    className={`block rounded-(--r-sm) px-3 py-3 text-base font-medium hover:bg-surface-2 ${
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
                    className="block rounded-(--r-sm) px-3 py-2.5 text-base font-medium text-ink-1 hover:bg-surface-2"
                  >
                    {item.label}
                  </Link>
                ))}
              </li>
              <li>
                <Link
                  href="/contact"
                  onClick={closeMobile}
                  className={`block rounded-(--r-sm) px-3 py-3 text-base font-medium hover:bg-surface-2 ${
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
