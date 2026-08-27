import * as React from "react";
export { CustomSelect as Select } from "./custom-select";

/* Form primitives -- inset control surface (darker than card), brand focus ring.
   Inputs are "wells" that receive content, per the depth system. */

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink-1">
        {label}
        {required && <span className="ml-0.5 text-copper">*</span>}
        {hint && <span className="ml-2 font-normal text-ink-3">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const controlClass =
  "w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3.5 text-[15px] text-ink-1 " +
  "placeholder:text-ink-4 transition-colors hover:border-ink-4 focus:border-brand focus:bg-surface-1 " +
  "focus:outline-none focus:ring-2 focus:ring-brand/25";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} h-11 ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlClass} resize-y py-2.5 ${props.className ?? ""}`} />;
}
