import Link from "next/link";
import * as React from "react";

/* Shared primitives. One button system, one chip system -- reused everywhere
   so the surface treatment stays consistent (skill: same border weight, radius,
   shadow depth across cards/controls). */

type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet";
type ButtonSize = "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 font-medium rounded-(--r-sm) " +
  "transition-[background-color,border-color,color] duration-150 ease-out " +
  "active:translate-y-px disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-brand-ink hover:bg-brand-hover",
  secondary:
    "bg-surface-1 text-ink-1 border border-line-strong hover:bg-surface-2 hover:border-ink-4",
  ghost:
    "bg-transparent text-ink-1 border border-line hover:bg-surface-2",
  quiet: "bg-transparent text-ink-2 hover:text-ink-1 hover:bg-surface-2",
};

const buttonSizes: Record<ButtonSize, string> = {
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  size = "md",
  full = false,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${full ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
}

type LinkButtonProps = {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">;

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: LinkButtonProps) {
  const external = href.startsWith("http") || href.startsWith("tel:") || href.startsWith("mailto:");
  const cls = `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`;
  if (external) {
    return (
      <a
        href={href}
        className={cls}
        target={href.startsWith("http") ? "_blank" : props.target}
        rel={href.startsWith("http") ? "noopener noreferrer" : props.rel}
        {...props}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...props}>
      {children}
    </Link>
  );
}

/* Chips ------------------------------------------------------------------- */

type ChipTone = "neutral" | "brand" | "eco" | "stock" | "lead" | "copper";

const chipTones: Record<ChipTone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  brand: "bg-brand-tint text-brand border-transparent",
  eco: "bg-eco-tint text-eco-ink border-transparent",
  stock: "bg-stock-ready-tint text-stock-ready-ink border-transparent",
  lead: "bg-surface-2 text-ink-3 border-line",
  copper: "bg-copper-tint text-copper border-transparent",
};

export function Chip({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${chipTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* Section scaffolding ----------------------------------------------------- */

export function Container({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1180px] px-5 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}

/* Plain semibold label -- the old all-caps letterspaced mono eyebrow read as
   SaaS-dashboard chrome; a supply house says it straight. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium text-ink-1">
      {children}
    </span>
  );
}
