"use client";

import { ListChecks, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useQuote } from "./quote-context";
import type { SavedListItem, SavedList } from "@/lib/backend/lists";

/* Truck-stock lists in the portal: one click restocks the cart. */
export function SavedListsPanel() {
  const { add, setQty } = useQuote();
  const [lists, setLists] = React.useState<SavedList[] | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/saved-lists")
      .then((res) => res.json())
      .then((data) => setLists(data.ok ? data.lists : []))
      .catch(() => setLists([]));
  }, []);

  function addAll(list: SavedList) {
    for (const item of list.items) {
      add({
        skuId: item.skuId,
        sku: item.sku,
        modelNumber: item.modelNumber,
        title: item.title,
        image: item.image,
        available: item.available,
        unitPrice: item.unitPrice,
      });
      if (item.qty > 1) setQty(item.skuId, item.qty);
    }
    setNotice(`"${list.name}" added to cart (${list.items.length} items).`);
  }

  async function remove(id: string) {
    setLists((prev) => (prev ?? []).filter((list) => list.id !== id));
    await fetch(`/api/saved-lists?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <section className="rounded-(--r-md) border border-line bg-surface-1 p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-ink-1">
          <ListChecks size={17} className="text-brand" /> Saved lists
        </h2>
        <span className="text-xs font-medium text-ink-3">Truck stock</span>
      </div>
      {lists === null ? (
        <p className="text-sm text-ink-3">Loading…</p>
      ) : lists.length === 0 ? (
        <p className="text-sm leading-relaxed text-ink-3">
          No lists yet. Build a cart, then use &ldquo;Save cart as list&rdquo; in the cart
          drawer — one click restocks the truck next time.
        </p>
      ) : (
        <div className="divide-y divide-line">
          {lists.map((list) => (
            <div key={list.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-1">{list.name}</p>
                <p className="mt-0.5 text-xs text-ink-3">
                  {list.items.length} item{list.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => addAll(list)}
                  data-conversion-hook="saved-list-add-all"
                  className="inline-flex items-center gap-1 rounded-(--r-sm) border border-line bg-surface-1 px-2.5 py-1.5 text-xs font-semibold text-brand hover:border-brand"
                >
                  <Plus size={12} /> Add all
                </button>
                <button
                  type="button"
                  onClick={() => void remove(list.id)}
                  aria-label={`Delete list ${list.name}`}
                  className="grid size-8 place-items-center rounded-(--r-sm) text-ink-3 hover:bg-surface-2 hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {notice && <p className="mt-3 text-xs font-medium text-eco-ink">{notice}</p>}
    </section>
  );
}

/* Drawer affordance: snapshot the current cart into a named list. */
export function SaveCartAsList({ items }: { items: SavedListItem[] }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  if (items.length === 0) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/saved-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, items }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="text-xs font-medium text-eco-ink">List saved — find it in your portal.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-brand"
      >
        <ListChecks size={12} /> Save cart as list
      </button>
    );
  }

  return (
    <form onSubmit={save} className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="List name (e.g. Truck stock)"
        aria-label="List name"
        className="h-8 min-w-0 flex-1 rounded-(--r-sm) border border-control-border bg-control-bg px-2 text-xs text-ink-1 outline-none placeholder:text-ink-4 focus:border-brand focus:ring-2 focus:ring-brand/25"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="h-8 shrink-0 rounded-(--r-sm) bg-brand px-2.5 text-xs font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-50"
      >
        Save
      </button>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </form>
  );
}
