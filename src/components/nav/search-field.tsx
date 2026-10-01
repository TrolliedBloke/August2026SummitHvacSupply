"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import * as React from "react";

/* Header typeahead.

   States are explicit -- idle, loading, success, empty, error -- and the
   concurrency guards stay: requests are debounced, the previous fetch is
   aborted, and a sequence number drops any response that is not the newest.
   While a new request is in flight the previous options stay visible but are
   marked as updating (aria-busy, dimmed), so an old answer never poses as the
   new one. Escape closes the list without submitting; a second Escape clears
   the field. */

export const ICON_STROKE = 1.75;

type ProductResult = {
  kind: "product";
  match: "exact_sku" | "exact_model" | "related";
  id: string;
  sku: string;
  modelNumber: string;
  title: string;
  btu: number;
  voltage: string;
  purchaseEligible: boolean;
  priced: boolean;
  href: string;
};
type CategoryResult = { kind: "category"; id: string; title: string; detail: string; href: string };
type Option = ProductResult | CategoryResult;

type Status = "idle" | "loading" | "success" | "empty" | "error";

function optionName(option: Option): string {
  if (option.kind === "category") return `Category: ${option.title}, ${option.detail}`;
  const match = option.match === "exact_sku" ? "Exact SKU match: " : option.match === "exact_model" ? "Exact model match: " : "";
  return `${match}${option.title}, SKU ${option.sku}`;
}

export function SearchField({
  onNavigate,
  inline = false,
  withButton = false,
  mobileMenu = false,
}: {
  onNavigate?: () => void;
  /** Inline lives in the nav bar, so results float over the page. */
  inline?: boolean;
  /** Attaches the green submit button, which runs the query against the catalog. */
  withButton?: boolean;
  /** Larger touch target and type used by the mobile menu. */
  mobileMenu?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<Option[]>([]);
  const [status, setStatus] = React.useState<Status>("idle");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [announcement, setAnnouncement] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const requestRef = React.useRef(0);
  const listId = React.useId();

  React.useEffect(() => {
    const trimmed = query.trim();
    const requestId = ++requestRef.current;
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("search failed");
          return response.json();
        })
        .then((payload) => {
          if (requestRef.current !== requestId) return;
          const next: Option[] = [...(payload.categories ?? []), ...(payload.results ?? [])];
          setOptions(next);
          setActive(-1);
          setStatus(next.length ? "success" : "empty");
          setAnnouncement(
            next.length ? `${next.length} ${next.length === 1 ? "suggestion" : "suggestions"} available` : `No matches for ${trimmed}`
          );
        })
        .catch((error: unknown) => {
          if ((error as Error)?.name === "AbortError" || requestRef.current !== requestId) return;
          setOptions([]);
          setActive(-1);
          setStatus("error");
          setAnnouncement("Suggestions are unavailable. Press Enter to search the catalog.");
        });
    }, 140);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const showList = open && query.trim().length >= 2;

  function onQueryChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setQuery(next);
    setOpen(true);
    if (next.trim().length < 2) {
      setOptions([]);
      setActive(-1);
      setStatus("idle");
    } else {
      setStatus("loading");
    }
  }

  function go(option: Option) {
    router.push(option.href);
    setOpen(false);
    onNavigate?.();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (showList) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (query) {
        event.preventDefault();
        setQuery("");
        setOptions([]);
        setStatus("idle");
      }
      return;
    }
    if (!showList || options.length === 0) {
      if (event.key === "ArrowDown" && options.length > 0) {
        event.preventDefault();
        setOpen(true);
        setActive(0);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? options.length - 1 : index - 1));
    } else if (event.key === "Enter" && active >= 0 && options[active]) {
      event.preventDefault();
      go(options[active]);
    } else if (event.key === "Tab") {
      setOpen(false);
      setActive(-1);
    }
  }

  /* Enter with a highlighted option is handled above; a bare Enter, or the
     button, runs the full catalog search. */
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    setOpen(false);
    router.push(`/products?q=${encodeURIComponent(trimmed)}`);
    onNavigate?.();
  }

  const categories = options.filter((option): option is CategoryResult => option.kind === "category");
  const exact = options.filter((option): option is ProductResult => option.kind === "product" && option.match !== "related");
  const related = options.filter((option): option is ProductResult => option.kind === "product" && option.match === "related");
  const groups: Array<{ key: string; label: string; items: Option[] }> = [
    { key: "exact", label: "Exact match", items: exact },
    { key: "categories", label: "Categories", items: categories },
    { key: "products", label: exact.length ? "Related products" : "Products", items: related },
  ].filter((group) => group.items.length > 0);
  const indexOf = (option: Option) => options.indexOf(option);
  const updating = status === "loading" && options.length > 0;

  return (
    <div
      className={inline ? "relative w-full" : undefined}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <form
        onSubmit={onSubmit}
        role="search"
        className={`flex items-stretch overflow-hidden rounded-(--r-sm) border border-line-strong bg-surface-1 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25 ${mobileMenu ? "h-12" : "h-13"}`}
      >
        <div className={`flex min-w-0 flex-1 items-center ${mobileMenu ? "gap-4 px-4" : "gap-2.5 px-3.5"}`}>
          <Search size={mobileMenu ? 22 : 18} strokeWidth={ICON_STROKE} className={mobileMenu ? "shrink-0 text-ink-1" : "shrink-0 text-ink-3"} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={onQueryChange}
            onKeyDown={onKeyDown}
            onFocus={() => setOpen(true)}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 && options[active] ? `${listId}-${options[active].id}` : undefined}
            placeholder="Search products, models, or SKUs"
            enterKeyHint="search"
            className={`min-w-0 flex-1 bg-transparent text-ink-1 outline-none placeholder:text-ink-3 ${mobileMenu ? "text-[17px]" : "text-sm"}`}
            aria-label="Search products, models, or SKUs"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setOptions([]);
                setActive(-1);
                setStatus("idle");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="grid size-9 shrink-0 place-items-center rounded-(--r-sm) text-ink-2 hover:bg-surface-2 hover:text-ink-1"
            >
              <X size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
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

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {showList && (
        <div
          className={`max-h-[min(60vh,32rem)] overflow-y-auto overscroll-contain rounded-(--r-md) border border-line bg-surface-1 ${
            inline ? "absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 shadow-[0_8px_24px_rgba(28,28,26,0.10)]" : "mt-2"
          }`}
        >
          {(status === "loading" && options.length === 0) || updating ? (
            <p className="border-b border-line px-3 py-2 text-xs text-ink-3">{updating ? "Updating suggestions…" : "Searching…"}</p>
          ) : null}
          {status === "empty" && (
            <p className="px-3 py-4 text-sm text-ink-3">
              No matches for “{query.trim()}”. Try a model number, or{" "}
              <Link href="/contact?topic=product" onClick={onNavigate} className="font-medium text-ink-1 underline underline-offset-4">
                ask the counter
              </Link>
              .
            </p>
          )}
          {status === "error" && (
            <p className="px-3 py-4 text-sm text-ink-2">Suggestions are unavailable right now. Press Enter to search the full catalog.</p>
          )}
          <div id={listId} role="listbox" aria-label="Search suggestions" aria-busy={status === "loading"} className={updating ? "opacity-60" : undefined}>
            {groups.map((group) => (
              <div key={group.key} role="group" aria-labelledby={`${listId}-${group.key}`}>
                <p id={`${listId}-${group.key}`} role="presentation" className="bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-3">
                  {group.label}
                </p>
                {group.items.map((option) => {
                  const index = indexOf(option);
                  return (
                    <div
                      key={option.id}
                      id={`${listId}-${option.id}`}
                      role="option"
                      aria-selected={index === active}
                      aria-label={optionName(option)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => go(option)}
                      onMouseEnter={() => setActive(index)}
                      className={`block cursor-pointer border-b border-line px-3 py-3 last:border-b-0 ${index === active ? "bg-surface-2" : "hover:bg-surface-2"}`}
                    >
                      {option.kind === "category" ? (
                        <>
                          <span className="block text-sm font-medium text-ink-1">{option.title}</span>
                          <span className="mt-0.5 block text-xs text-ink-3">{option.detail}</span>
                        </>
                      ) : (
                        <>
                          <span className="part-number block text-xs font-medium text-ink-3">
                            {option.sku}
                            {option.match !== "related" && <span className="ml-2 font-sans text-brand">{option.match === "exact_sku" ? "Exact SKU" : "Exact model"}</span>}
                          </span>
                          <span className="mt-0.5 block text-sm font-medium text-ink-1">{option.title}</span>
                          <span className="mt-0.5 block text-xs text-ink-3">
                            {option.modelNumber}
                            {option.btu ? ` · ${option.btu.toLocaleString()} BTU` : ""}
                            {option.voltage ? ` · ${option.voltage}` : ""} · {option.purchaseEligible ? "available to order" : option.priced ? "confirm availability" : "price on request"}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
