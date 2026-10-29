"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Menu, MessageSquare, X, ShoppingCart, MapPin, Phone, UserRound, LayoutGrid, FileText } from "lucide-react";
import * as React from "react";
import { useQuote } from "./quote-context";
import { Modal } from "./dialog";
import { BranchStatusText } from "./branch-status";
import { ICON_STROKE, SearchField } from "./nav/search-field";
import { AccountMenu, accountActions, triggerLabel, useNavAccount } from "./nav/account-menu";
import { SITE } from "@/lib/site";
import { CATEGORY_RAIL } from "@/lib/nav-links";
import { shellVariantForPathname } from "@/lib/shell-variant";
import type { CategoryDestination } from "@/lib/storefront/catalog";

/* Shared by every row-3 entry so the run reads as an even rhythm. */
const NAV_ITEM =
  "inline-flex h-16 items-center whitespace-nowrap px-4 text-base font-medium text-ink-1 transition-colors duration-120";
/* The 2px green underline is a state, not decoration: hover, open, and the
   current category page (aria-current). */
const NAV_UNDERLINE =
  "relative after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-brand after:opacity-0 after:transition-opacity after:duration-120 hover:after:opacity-100";
const NAV_UNDERLINE_ON = "after:opacity-100";

/** Past this many categories the panel offers a filter field instead of a bare list. */
const CATEGORY_SEARCH_THRESHOLD = 16;

function useClientMounted() {
  return React.useSyncExternalStore(
    React.useCallback(() => () => undefined, []),
    () => true,
    () => false
  );
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 items-center" aria-label="Summit HVAC Supply home">
      <Image
        src="/logo-summit-lockup.png"
        alt="Summit HVAC Supply"
        width={1010}
        height={280}
        preload
        sizes="(min-width: 1024px) 270px, 160px"
        className={`${compact ? "h-[39px]" : "h-9 md:h-12 lg:h-16"} w-auto object-contain`}
      />
    </Link>
  );
}

/* "All products" is a disclosure: a button controlling a labelled navigation
   region of ordinary links (no role="menu", so Tab works as everywhere else).
   The panel is bound to the viewport -- width, columns and height -- and
   scrolls inside itself when categories outgrow it. */
function AllProductsPanel({
  id,
  categories,
  onNavigate,
}: {
  id: string;
  categories: CategoryDestination[];
  onNavigate: () => void;
}) {
  const [filter, setFilter] = React.useState("");
  const available = categories.filter((category) => category.status === "available");
  const shown = filter ? available.filter((category) => category.label.toLowerCase().includes(filter.toLowerCase())) : available;
  return (
    <nav
      id={id}
      aria-label="All product categories"
      className="absolute left-5 top-[calc(100%-0.25rem)] z-50 flex max-h-[min(32rem,calc(100dvh-14rem))] w-[min(36rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-(--r-md) border border-line bg-surface-1 shadow-[0_8px_24px_rgba(28,28,26,0.10)]"
    >
      {available.length > CATEGORY_SEARCH_THRESHOLD && (
        <div className="border-b border-line p-2">
          <label className="sr-only" htmlFor={`${id}-filter`}>
            Filter categories
          </label>
          <input
            id={`${id}-filter`}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter categories"
            className="h-11 w-full rounded-(--r-sm) border border-control-border px-3 text-sm outline-none focus:border-brand"
          />
        </div>
      )}
      <ul className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-x-1 overflow-y-auto overscroll-contain p-2">
        {shown.map((category) => (
          <li key={category.value} className="min-w-0">
            <Link
              href={category.href}
              onClick={onNavigate}
              className="flex min-h-11 items-center justify-between gap-3 rounded-(--r-sm) px-3 py-2 text-sm font-medium text-ink-1 hover:bg-surface-2"
            >
              <span className="min-w-0 break-words">{category.label}</span>
              <span className="part-number shrink-0 text-xs font-normal text-ink-3">
                <span className="sr-only">, </span>
                {category.productCount}
                <span className="sr-only">{category.productCount === 1 ? " product" : " products"}</span>
              </span>
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-2 text-sm text-ink-3">No category matches “{filter}”.</li>}
      </ul>
      <Link
        href="/products"
        onClick={onNavigate}
        className="flex min-h-11 items-center border-t border-line px-5 text-sm font-medium text-brand hover:underline"
      >
        View the full catalog
      </Link>
    </nav>
  );
}

function CartButton({ onOpen }: { onOpen?: () => void }) {
  const { count, toggle } = useQuote();
  // The count comes from localStorage (client-only), so defer showing it
  // until after mount to keep server and client markup identical.
  const mounted = useClientMounted();
  const showCount = mounted && count > 0;
  return (
    <button
      type="button"
      onClick={() => {
        onOpen?.();
        toggle();
      }}
      aria-label={showCount ? `Open your cart (${count} ${count === 1 ? "item" : "items"})` : "Open your cart"}
      className="relative flex h-11 shrink-0 items-center gap-2 rounded-(--r-sm) px-2.5 text-sm font-medium text-ink-1 transition-colors hover:bg-surface-2 lg:px-3"
    >
      <span className="relative grid size-6 place-items-center">
        <ShoppingCart size={24} strokeWidth={ICON_STROKE} aria-hidden="true" />
        {showCount && (
          <span className="tnum absolute -right-2 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-ink-1 px-1 text-xs font-medium leading-[18px] text-white">
            {count}
          </span>
        )}
      </span>
      <span className="hidden lg:inline">Cart</span>
    </button>
  );
}

/* Row 1: chrome on the deep green band. The branch status is live and comes
   from the Branch model; server HTML carries the weekly hours, never a guessed
   "open". */
function UtilityStrip() {
  return (
    <div className="hidden bg-[var(--chrome)] md:block">
      <div className="mx-auto flex h-12 w-full max-w-[var(--page-max)] items-center gap-3 px-5 text-meta font-medium text-white">
        <MapPin size={14} strokeWidth={ICON_STROKE} className="shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">Newark, CA</span>
        <span aria-hidden="true" className="text-white/50">
          ·
        </span>
        <BranchStatusText className="whitespace-nowrap" />
        <Link href="/locations/newark" className="ml-1 inline-flex items-center whitespace-nowrap py-3 underline underline-offset-2 transition-colors hover:text-white/80">
          Change
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-4 lg:gap-5">
          <a href={SITE.phoneHref} className="tnum inline-flex items-center gap-2 whitespace-nowrap py-3 transition-colors hover:text-white/80">
            <Phone size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
            {SITE.phone}
          </a>
          <Link href="/resources" className="hidden items-center whitespace-nowrap py-3 transition-colors hover:text-white/80 lg:inline-flex">
            Resources
          </Link>
          <span className="hidden h-5 w-px bg-white/35 lg:block" aria-hidden="true" />
          <Link href="/dealers" className="hidden items-center whitespace-nowrap py-3 transition-colors hover:text-white/80 lg:inline-flex">
            Apply for trade account
          </Link>
        </div>
      </div>
    </div>
  );
}

/* The category run. `query` is null until the client provides it, so the
   server can prerender the links and only the current-page marking waits. */
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

export function SiteNav({ categories }: { categories: CategoryDestination[] }) {
  const pathname = usePathname();
  const shellVariant = shellVariantForPathname(pathname);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [productsOpen, setProductsOpen] = React.useState(false);
  const productsWrapRef = React.useRef<HTMLDivElement>(null);
  const productsTriggerRef = React.useRef<HTMLButtonElement>(null);
  const productsPanelId = React.useId();

  // Close the desktop disclosure on Escape (focus back to the trigger) and on
  // a click anywhere outside it.
  React.useEffect(() => {
    if (!productsOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (productsWrapRef.current && !productsWrapRef.current.contains(event.target as Node)) setProductsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProductsOpen(false);
        productsTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [productsOpen]);

  return (
    <header className="relative z-30 bg-surface-2" data-shell-variant={shellVariant}>
      {shellVariant === "commerce" && <UtilityStrip />}

      <div
        className={`mx-auto flex w-full max-w-[var(--page-max)] items-center gap-3 bg-surface-2 px-5 py-2.5 lg:gap-6 ${shellVariant === "commerce" ? "md:py-[18px] lg:py-[15px]" : "md:py-3"}`}
      >
        <Wordmark compact={shellVariant !== "commerce"} />
        {/* Capped and centred, so mark / search / account each hold their space. */}
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <div className="w-full max-w-[827px]">
            <SearchField inline withButton />
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
          {shellVariant === "focused" && (
            <Link href="/products" className="hidden h-11 items-center rounded-(--r-sm) px-3 text-sm font-medium text-brand hover:bg-surface-2 md:inline-flex">
              Catalog
            </Link>
          )}
          <AccountMenu />
          <CartButton />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={mobileOpen}
            className="grid size-11 place-items-center rounded-(--r-sm) text-ink-1 transition-colors hover:bg-surface-2 xl:hidden"
          >
            <Menu size={22} strokeWidth={ICON_STROKE} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* One navigation row: the All-products disclosure, the category run, and
          Brands pinned right. The disclosure's panel is positioned against this
          nav (not inside the horizontally scrolling row), so it is never
          clipped by the row's overflow. */}
      {shellVariant === "commerce" ? (
        <nav aria-label="Store navigation" className="relative border-b border-line bg-surface-2">
          <div ref={productsWrapRef}>
            <div className="mx-auto w-full max-w-[var(--page-max)] px-5">
              <div className="flex items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="-ml-4 shrink-0">
                  <button
                    ref={productsTriggerRef}
                    type="button"
                    onClick={() => setProductsOpen((current) => !current)}
                    aria-expanded={productsOpen}
                    aria-controls={productsPanelId}
                    className={`${NAV_ITEM} inline-flex items-center gap-4 text-ink-1 hover:bg-surface-2`}
                  >
                    <Menu size={22} strokeWidth={2} aria-hidden="true" className="hidden md:block" />
                    All products
                  </button>
                </div>
                <Suspense fallback={<CategoryLinks pathname={pathname} query={null} />}>
                  <CategoryRail pathname={pathname} />
                </Suspense>
                <Link
                  href="/brands"
                  aria-current={pathname === "/brands" ? "page" : undefined}
                  className={`${NAV_ITEM} ${NAV_UNDERLINE} ml-auto -mr-4 shrink-0 ${pathname === "/brands" ? NAV_UNDERLINE_ON : ""}`}
                >
                  Brands
                </Link>
              </div>
            </div>
            <div className="mx-auto w-full max-w-[var(--page-max)]">
              <div className="relative">
                {productsOpen && <AllProductsPanel id={productsPanelId} categories={categories} onNavigate={() => setProductsOpen(false)} />}
              </div>
            </div>
          </div>
        </nav>
      ) : shellVariant === "service" ? (
        <nav aria-label="Service navigation" className="border-b border-line bg-surface-2">
          <div className="mx-auto hidden h-12 w-full max-w-[var(--page-max)] items-center gap-7 px-5 text-sm font-medium text-ink-1 md:flex">
            <Link href="/products" className="hover:text-brand">Catalog</Link>
            <Link href="/finder" aria-current={pathname.startsWith("/finder") ? "page" : undefined} className="hover:text-brand aria-[current=page]:text-brand">System finder</Link>
            <Link href="/resources" aria-current={pathname.startsWith("/resources") || pathname.startsWith("/guides") ? "page" : undefined} className="hover:text-brand aria-[current=page]:text-brand">Resources</Link>
            <Link href="/contact" aria-current={pathname.startsWith("/contact") ? "page" : undefined} className="hover:text-brand aria-[current=page]:text-brand">Contact</Link>
            <a href={SITE.phoneHref} className="tnum ml-auto inline-flex items-center gap-2 hover:text-brand">
              <Phone size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
              {SITE.phone}
            </a>
          </div>
        </nav>
      ) : (
        <div className="border-b border-line" aria-hidden="true" />
      )}

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} categories={categories} />
    </header>
  );
}

/* The mobile navigation is a real modal surface on the shared dialog
   primitive: labelled, focus moved in and trapped, background inert, Escape
   and the close button dismiss it, page scroll is restored, and focus returns
   to the menu button. Top tasks come first; product families sit one level
   down behind "Shop by category", with a Back button -- an in-panel view, not
   a fake history entry. */
function MobileNav({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: CategoryDestination[] }) {
  const [view, setView] = React.useState<"main" | "categories">("main");
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const backRef = React.useRef<HTMLButtonElement>(null);
  const categoriesTriggerRef = React.useRef<HTMLButtonElement>(null);
  const account = useNavAccount();
  const close = React.useCallback(() => {
    onClose();
    setView("main");
  }, [onClose]);

  // Moving between levels moves focus with it.
  const [focusTarget, setFocusTarget] = React.useState<"back" | "categories" | null>(null);
  React.useEffect(() => {
    if (focusTarget === "back") backRef.current?.focus();
    if (focusTarget === "categories") categoriesTriggerRef.current?.focus();
  }, [focusTarget, view]);

  const available = categories.filter((category) => category.status === "available");
  const signedIn = account && account.variant !== "signedOut";

  return (
    <Modal open={open} onClose={close} label="Menu" placement="full" initialFocusRef={closeRef} className="xl:hidden" backdropClassName="xl:hidden">
      <div className="flex h-16 shrink-0 items-center gap-3 px-3.5" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <button ref={closeRef} type="button" onClick={close} aria-label="Close menu" className="grid size-11 shrink-0 place-items-center text-ink-1">
          <X size={28} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <Wordmark compact />
        <div className="ml-auto flex items-center gap-1.5">
          <CartButton onOpen={close} />
        </div>
      </div>

      {view === "main" ? (
        <>
          <div className="shrink-0 border-b border-line px-5 pb-3 pt-1">
            <SearchField onNavigate={close} mobileMenu />
          </div>
          <nav aria-label="Menu" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
            <ul className="flex flex-col">
              <li>
                <button
                  ref={categoriesTriggerRef}
                  type="button"
                  onClick={() => {
                    setView("categories");
                    setFocusTarget("back");
                  }}
                  className="flex min-h-[52px] w-full items-center justify-between border-b border-line px-0.5 text-left text-[18px] font-medium leading-6 text-ink-1"
                >
                  <span className="flex items-center gap-3">
                    <LayoutGrid size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    Shop by category
                  </span>
                  <ChevronRight size={21} strokeWidth={1.9} aria-hidden="true" />
                </button>
              </li>
              <MobileMenuLink href="/products" onClick={close} trailing>
                All products
              </MobileMenuLink>
              <MobileMenuLink href="/quote" onClick={close} icon={<FileText size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />}>
                Requests and quotes
              </MobileMenuLink>
              {signedIn ? (
                <>
                  {accountActions(account).slice(0, 2).map((action) => (
                    <MobileMenuLink key={action.href} href={action.href} onClick={close} icon={<UserRound size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />}>
                      {action.label}
                    </MobileMenuLink>
                  ))}
                </>
              ) : (
                <MobileMenuLink href="/portal/login" onClick={close} icon={<UserRound size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />}>
                  {account ? triggerLabel(account) : "Account"}
                </MobileMenuLink>
              )}
              <MobileMenuLink href="/brands" onClick={close} trailing>
                Brands
              </MobileMenuLink>
              <MobileMenuLink href="/resources" onClick={close} trailing>
                Resources
              </MobileMenuLink>
              <MobileMenuLink href="/dealers" onClick={close}>
                Apply for a trade account
              </MobileMenuLink>
            </ul>
          </nav>
        </>
      ) : (
        <nav aria-label="Product categories" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-line px-3.5">
            <button
              ref={backRef}
              type="button"
              onClick={() => {
                setView("main");
                setFocusTarget("categories");
              }}
              className="flex min-h-[52px] items-center gap-2 px-1.5 text-base font-medium text-ink-1"
            >
              <ChevronLeft size={20} strokeWidth={1.9} aria-hidden="true" />
              Back to menu
            </button>
          </div>
          <h2 className="px-5 pb-1 pt-4 text-meta font-medium text-ink-3">Shop by category</h2>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
            {available.map((category) => (
              <MobileMenuLink key={category.value} href={category.href} onClick={close} meta={`${category.productCount}`}>
                {category.label}
              </MobileMenuLink>
            ))}
            <MobileMenuLink href="/products" onClick={close} trailing>
              All products
            </MobileMenuLink>
          </ul>
        </nav>
      )}

      <div className="shrink-0 border-t border-line bg-canvas px-5 pt-3" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
        <p className="flex items-center gap-1.5 px-1 text-base font-medium text-ink-1">
          <MapPin size={18} strokeWidth={2} className="shrink-0 text-ink-1" aria-hidden="true" />
          <span>Newark ·</span>
          <BranchStatusText className="font-normal text-ink-2" />
        </p>
        <div className="mt-2 grid grid-cols-[3.1fr_2fr] gap-2.5">
          <a href={SITE.phoneHref} className="flex h-[46px] min-w-0 items-center justify-center gap-3 whitespace-nowrap rounded-(--r-sm) bg-brand px-3 text-base font-medium text-white">
            <Phone size={20} strokeWidth={2.2} aria-hidden="true" />
            Call {SITE.phone}
          </a>
          <a href={SITE.smsHref} className="flex h-[46px] min-w-0 items-center justify-center gap-3 rounded-(--r-sm) border border-line-strong bg-surface-1 px-3 text-base font-medium text-brand">
            <MessageSquare size={20} strokeWidth={2} aria-hidden="true" />
            Text us
          </a>
        </div>
      </div>
    </Modal>
  );
}

function MobileMenuLink({
  href,
  onClick,
  trailing = false,
  icon,
  meta,
  children,
}: {
  href: string;
  onClick: () => void;
  trailing?: boolean;
  icon?: React.ReactNode;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link href={href} onClick={onClick} className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line px-0.5 py-2 text-[18px] font-medium leading-6 text-ink-1">
        <span className="flex min-w-0 items-center gap-3">
          {icon}
          <span className="min-w-0 break-words">{children}</span>
        </span>
        {meta && (
          <span className="part-number shrink-0 text-sm font-normal text-ink-3">
            <span className="sr-only">, </span>
            {meta}
            <span className="sr-only">{meta === "1" ? " product" : " products"}</span>
          </span>
        )}
        {trailing && <ChevronRight size={21} strokeWidth={1.9} aria-hidden="true" className="shrink-0" />}
      </Link>
    </li>
  );
}
