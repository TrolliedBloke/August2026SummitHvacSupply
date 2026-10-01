import * as React from "react";
import { AlertCircle } from "lucide-react";
export { CustomSelect as Select } from "./custom-select";

/* Form primitives. One field contract for every form: a stable control id, a
   visible label, an optional hint, an error that is programmatically tied to
   its control (aria-describedby), aria-invalid, and the required state. The
   control renders through a render prop so native inputs, textareas and the
   custom select all receive the same wiring. */

export type ControlProps = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
};

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  className = "",
  labelClassName = "",
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  labelClassName?: string;
  children: (control: ControlProps) => React.ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={`text-sm font-medium text-ink-1 ${labelClassName}`}>
        {label}
        {required ? (
          <span className="ml-0.5 text-ink-3" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1.5 font-normal text-ink-3">(optional)</span>
        )}
      </label>
      {hint && (
        <p id={hintId!} className="-mt-0.5 text-meta leading-5 text-ink-3">
          {hint}
        </p>
      )}
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required ? true : undefined,
      })}
      {error && (
        <p id={errorId!} className="flex items-start gap-1.5 text-sm leading-5 text-state-danger-ink">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/**
 * The list of problems after a submit with more than one, each a link to its
 * field. Rendered as an alert so it is announced once; focus stays with the
 * first invalid field, which the form moves itself.
 */
export function ErrorSummary({
  errors,
  labels,
  formError,
  id = "form-error-summary",
}: {
  errors: Partial<Record<string, string>>;
  labels: Record<string, string>;
  formError?: string | null;
  id?: string;
}) {
  const entries = Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (entries.length === 0 && !formError) return null;
  return (
    <div id={id} role="alert" className="rounded-(--r-sm) border border-state-danger-line bg-state-danger px-4 py-3 text-sm leading-6">
      {formError && <p className="font-medium text-state-danger-ink">{formError}</p>}
      {entries.length > 1 && (
        <>
          <p className="font-medium text-state-danger-ink">
            {entries.length} fields need attention
          </p>
          <ul className="mt-1 list-disc pl-5 text-ink-1">
            {entries.map(([field, message]) => (
              <li key={field}>
                <a href={`#${field}`} className="underline underline-offset-4">
                  {labels[field] ?? field}: {message}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Focus the first invalid control in DOM order, without scrolling past it. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  // data-invalid marks containers (a list of lines, a radio group) whose role
  // does not take aria-invalid; their messages are tied in by aria-describedby.
  const target = form?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
  if (!target) return;
  // Bring the field to the middle of the viewport, never to the page bottom.
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "center" });
}

/* Legacy wrapper kept for existing callers: a label that wraps its control. */
export function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium text-ink-1">
        {label}
        {required && <span className="ml-0.5 text-copper">*</span>}
        {hint && <span className="ml-2 font-normal text-ink-3">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const controlClass =
  "w-full rounded-(--r-sm) border border-control-border bg-control-bg px-3.5 text-base text-ink-1 " +
  "placeholder:text-ink-4 transition-colors hover:border-ink-4 focus:border-brand focus:bg-surface-1 " +
  "focus:outline-none focus:ring-2 focus:ring-brand/25 " +
  "aria-[invalid=true]:border-state-danger-ink aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-state-danger-ink/40";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return <input ref={ref} {...props} className={`${controlClass} h-11 ${props.className ?? ""}`} />;
  }
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea(props, ref) {
    return <textarea ref={ref} {...props} className={`${controlClass} resize-y py-2.5 ${props.className ?? ""}`} />;
  }
);
