"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-(--r-sm) border border-line-strong px-4 text-sm font-medium text-ink-1 hover:bg-surface-2 print:hidden">
      <Printer size={16} aria-hidden="true" /> Print or save as PDF
    </button>
  );
}
