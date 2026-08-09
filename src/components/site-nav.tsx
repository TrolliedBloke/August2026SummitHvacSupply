"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Lock, Search, ChevronDown, Phone, ClipboardList } from "lucide-react";
import * as React from "react";
import { useQuote } from "./quote-context";
import { SITE } from "@/lib/site";

/* Primary nav is capped at 5 top-level targets. Rebates + Bay Area delivery
   live under the Resources menu so the bar never overflows. */
const PRIMARY = [
  { href: "/products", label: "Shop systems" },
  { href: "/homeowners", label: "For homeowners" },
  { href: "/dealers", label: "For contractors" },
];

const RESOURCES = [
  { href: "/resources", label: "Resources" },
  { href: "/tools/model-number-decoder", label: "Model number decoder" },
  { href: "/guides/bay-area-hvac-permits", label: "Permit and code guides" },
  { href: "/bay-area-heat-pump-rebates", label: "Bay area heat pump rebates" },
  { href: "/locations/newark", label: "Newark delivery and will-call" },
];

const RESOURCE_HREFS = RESOURCES.map((r) => r.href);

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
  href: string;
};

/* Shared search field + results. Rendered inside a desktop popover and inside
   the mobile sheet. Fully keyboard-operable (↑/↓/Enter/Escape). */
function SearchField({
  onNavigate,
  autoFocus = false,
}: {
  onNavigate?: () => void;
  autoFocus?: boolean;
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

  return (
    <div>
      <div className="flex h-11 items-center gap-2 rounded-(--r-sm) border border-line-strong bg-surface-1 px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25">
        <Search size={16} className="shrink-0 text-ink-3" />
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
          placeholder="Search model or SKU"
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
            className="grid size-9 shrink-0 place-items-center rounded-(--r-sm) text-ink-2 hover:bg-surface-2 hover:text-ink-1"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {showResults && (
        <ul
          id={resultsId}
          role="listbox"
          aria-label="Search results"
          className="mt-2 max-h-[60vh] overflow-y-auto overflow-hidden rounded-(--r-md) border border-line bg-surface-1"
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
                  {result.modelNumber}{result.btu ? ` · ${result.btu.toLocaleString()} BTU` : ""}{result.voltage ? ` · ${result.voltage}` : ""} · {result.availabilityStatus === "unknown" ? "availability confirmation required" : result.availabilityStatus.replaceAll("_", " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Desktop search: an icon trigger that opens a popover. One search surface for
   the whole site — the catalog page keeps its own dedicated sidebar search. */
function SearchPopover() {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Search products"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="grid size-11 place-items-center rounded-(--r-sm) text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink-1"
      >
        <Search size={18} strokeWidth={2.2} />
      </button>
      {open && (
        <div className="fixed left-4 right-4 top-[calc(var(--nav-height)+0.5rem)] z-50 rounded-(--r-md) border border-line bg-canvas p-3 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[min(380px,calc(100vw-2rem))]">
          <SearchField autoFocus onNavigate={() => setOpen(false)} />
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
  const active =
    pathname.startsWith("/guides/") ||
    pathname.startsWith("/tools/") ||
    RESOURCE_HREFS.some((href) => pathname === href || pathname.startsWith(href + "/"));

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
        className={`inline-flex items-center gap-1 rounded-(--r-sm) px-3 py-2 text-sm font-medium transition-colors ${
          active || open ? "text-ink-1 underline underline-offset-4" : "text-ink-1 hover:bg-surface-2"
        }`}
      >
        Resources
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute left-0 top-11 z-50 w-64 overflow-hidden rounded-(--r-md) border border-line bg-surface-1 p-1.5"
        >
          {RESOURCES.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
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
  // after mount — otherwise SSR (count 0) and hydration (real count) mismatch.
  const mounted = useClientMounted();
  const showCount = mounted && count > 0;
  return (
    <button
      onClick={toggle}
      aria-label={showCount ? `Open your quote list (${count} ${count === 1 ? "item" : "items"})` : "Open your quote list"}
      className="relative grid size-11 place-items-center rounded-(--r-sm) border border-line-strong bg-surface-1 text-ink-1 transition-colors hover:bg-surface-2"
    >
      <ClipboardList size={18} strokeWidth={2.1} />
      {showCount && (
        <span className="tnum absolute -right-1.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 font-mono text-[10px] font-medium leading-[18px] text-brand-ink">
          {count}
        </span>
      )}
    </button>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const closeMobile = () => setMobileOpen(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface-1">
      <nav className="mx-auto flex h-[var(--nav-height)] w-full max-w-[var(--counter-max)] items-center gap-4 px-5 sm:px-6 lg:px-[var(--counter-pad)]">
        <Wordmark />

        {/* Inline nav appears at xl, exactly where the hamburger hides — the two
            switch at the same breakpoint so navigation is never unreachable. */}
        <ul className="hidden flex-1 items-center gap-0.5 xl:flex">
          {PRIMARY.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`whitespace-nowrap rounded-(--r-sm) px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.href) ? "text-ink-1 underline underline-offset-4" : "text-ink-1 hover:bg-surface-2"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <ResourcesMenu pathname={pathname} />
          </li>
          <li>
            <Link
              href="/contact"
              className={`whitespace-nowrap rounded-(--r-sm) px-3 py-2 text-sm font-medium transition-colors ${
                isActive("/contact") ? "text-ink-1 underline underline-offset-4" : "text-ink-1 hover:bg-surface-2"
              }`}
            >
              Contact
            </Link>
          </li>
        </ul>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-1.5 xl:ml-0">
          <div>
            <SearchPopover />
          </div>
          <Link
            href="/portal/login"
            aria-label="Account portal"
            className="hidden size-11 place-items-center rounded-(--r-sm) text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink-1 sm:grid xl:hidden"
          >
            <Lock size={16} strokeWidth={2.2} />
          </Link>
          <Link
            href="/portal/login"
            className="hidden items-center gap-1.5 rounded-(--r-sm) px-2.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:text-ink-1 xl:inline-flex"
          >
            <Lock size={14} strokeWidth={2.2} />
            Account
          </Link>
          <CartButton />
          {/* Big-ticket, high-anxiety category — people call. The number is the CTA. */}
          <a
            href={SITE.phoneHref}
            className="hidden h-11 items-center gap-1.5 whitespace-nowrap rounded-(--r-sm) bg-brand px-3.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-hover md:inline-flex"
          >
            <Phone size={15} strokeWidth={2.2} />
            <span className="tnum">{SITE.phone}</span>
          </a>
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="grid size-11 place-items-center rounded-(--r-sm) text-ink-1 transition-colors hover:bg-surface-2 xl:hidden"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile / tablet sheet — available at every width below xl. */}
      {mobileOpen && (
        <div className="border-t border-line bg-canvas xl:hidden">
          <div className="mx-auto flex w-full max-w-[var(--counter-max)] flex-col px-5 py-4 sm:px-6">
            <SearchField onNavigate={closeMobile} />
            <ul className="mt-4 flex flex-col">
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
                  href="/portal/login"
                  onClick={closeMobile}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-(--r-sm) border border-line-strong bg-surface-1 text-sm font-medium text-ink-1"
                >
                  <Lock size={14} /> Account
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
