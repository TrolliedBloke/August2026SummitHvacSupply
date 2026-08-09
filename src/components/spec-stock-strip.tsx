import { Truck, Clock } from "lucide-react";
import { type Series, btuLabel } from "@/lib/products";

/* SIGNATURE ELEMENT -- the Spec & Stock strip.
   A horizontal data rail (mono, tabular) of the four numbers a contractor
   decides on, terminated by a live stock chip. It appears on every product
   card, every product page, and (future) the reorder portal, one consistent
   object across the whole site. Numbers are tabular mono so columns align. */

function StockChip({ series }: { series: Series }) {
  const ready = series.stock === "ready";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold
        ${ready ? "bg-stock-ready-tint text-stock-ready-ink" : "bg-surface-2 text-ink-3 border border-line"}`}
    >
      {ready ? <Truck size={13} strokeWidth={2.5} /> : <Clock size={13} strokeWidth={2} />}
      {series.leadTime}
    </span>
  );
}

function SpecCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-4">
        {label}
      </span>
      <span className="tnum font-mono text-[15px] font-semibold leading-none text-ink-1">
        {value}
      </span>
    </div>
  );
}

export function SpecStockStrip({
  series,
  className = "",
}: {
  series: Series;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-4 rounded-(--r-sm) border border-line bg-surface-2 px-4 py-3 ${className}`}
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <SpecCell label="SEER2" value={`${series.seer2}`} />
        <SpecCell label="HSPF2" value={series.hspf2 ? `${series.hspf2}` : "n/a"} />
        <SpecCell label="BTU" value={btuLabel(series)} />
        <SpecCell label="Min temp" value={series.minTemp} />
      </div>
      <StockChip series={series} />
    </div>
  );
}
