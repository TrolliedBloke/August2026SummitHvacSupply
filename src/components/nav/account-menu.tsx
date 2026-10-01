"use client";

import Link from "next/link";
import { Check, LogOut, UserRound, X } from "lucide-react";
import * as React from "react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/lib/backend/auth-actions";
import type { NavAccount } from "@/lib/access-state";
import { ICON_STROKE } from "./search-field";

/**
 * The header account control, as a projection of server authorization.
 *
 * Public pages are cached and shared, so the header cannot be rendered with a
 * session. This island asks the private /api/session/summary endpoint after
 * mount -- only when a session cookie exists -- and renders one of six
 * explicit variants. Until it knows, it shows a neutral "Account" label rather
 * than flashing "Sign in" at a signed-in person.
 *
 * It is a disclosure, not an ARIA menu: a button with aria-expanded controlling
 * a labelled panel of ordinary links, so Tab and Shift+Tab work as on any
 * page. Escape and an outside click close it and focus returns to the button.
 */

function hasSessionCookie() {
  return /sb-[^=]+-auth-token/.test(document.cookie);
}

export function useNavAccount(): NavAccount | null {
  const [account, setAccount] = React.useState<NavAccount | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    const resolve = hasSessionCookie()
      ? fetch("/api/session/summary", { cache: "no-store" })
          .then((response) => response.json())
          .then((payload) => (payload?.nav as NavAccount) ?? { variant: "signedOut" as const })
          .catch(() => ({ variant: "signedOut" as const }))
      : Promise.resolve({ variant: "signedOut" as const });
    resolve.then((nav) => {
      if (!cancelled) setAccount(nav);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return account;
}

type Action = { href: string; label: string };

export function accountActions(account: NavAccount): Action[] {
  switch (account.variant) {
    case "signedOut":
      return [];
    case "homeowner":
      return [
        { href: "/portal/homeowner", label: "Your account" },
        { href: "/quote", label: "Requests and quotes" },
        { href: "/dealers", label: "Apply for trade pricing" },
      ];
    case "tradePending":
      return [
        { href: "/portal/status", label: "Application status" },
        { href: "/quote", label: "Requests and quotes" },
      ];
    case "tradeApproved":
      return [
        { href: "/portal/dealer", label: "Dealer portal" },
        { href: "/products", label: "Shop with account pricing" },
        { href: "/quote", label: "Requests and quotes" },
      ];
    case "staff":
      return [
        { href: "/admin", label: "Operations" },
        { href: "/admin/dealers", label: "Dealer applications" },
        { href: "/admin/fulfillment", label: "Fulfillment" },
        { href: "/admin/catalog", label: "Catalog" },
      ];
    case "disabled":
      return [
        { href: "/portal/status", label: "Why access is paused" },
        { href: "/contact?topic=account", label: "Contact the counter" },
      ];
  }
}

export function triggerLabel(account: NavAccount | null): string {
  if (!account) return "Account";
  if (account.variant === "signedOut") return "Sign in";
  return account.name.split(/[\s@]/)[0] || "Account";
}

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-sm font-medium text-ink-1 transition-colors hover:bg-surface-2 disabled:opacity-60"
    >
      <LogOut size={16} aria-hidden="true" />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function AccountMenu() {
  const account = useNavAccount();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = triggerLabel(account);
  const signedIn = account && account.variant !== "signedOut";

  return (
    <div
      ref={wrapRef}
      className="relative hidden lg:block"
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={signedIn ? `Account menu for ${account.name}` : undefined}
        className={`inline-flex h-11 max-w-[12rem] items-center gap-2 whitespace-nowrap rounded-(--r-sm) px-3 text-sm font-medium text-ink-1 transition-colors ${open ? "bg-surface-1" : "hover:bg-surface-1"}`}
      >
        <UserRound size={20} strokeWidth={ICON_STROKE} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{label}</span>
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={signedIn ? "Your account" : "Sign in"}
          className="absolute right-[-60px] top-[calc(100%+1rem)] z-50 w-[min(360px,calc(100vw-2.5rem))] rounded-(--r-sm) border border-line-strong bg-surface-1 p-6 shadow-[0_12px_32px_rgba(28,28,26,0.14)]"
        >
          <span aria-hidden="true" className="absolute -top-[9px] right-[99px] size-4 rotate-45 border-l border-t border-line-strong bg-surface-1" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            aria-label="Close account panel"
            className="absolute right-3 top-3 grid size-11 place-items-center rounded-(--r-sm) text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-1"
          >
            <X size={20} strokeWidth={ICON_STROKE} aria-hidden="true" />
          </button>
          {account && account.variant !== "signedOut" ? (
            <SignedInPanel account={account} onNavigate={() => setOpen(false)} />
          ) : (
            <SignedOutPanel onNavigate={() => setOpen(false)} />
          )}
        </div>
      )}
    </div>
  );
}

function SignedOutPanel({ onNavigate }: { onNavigate: () => void }) {
  return (
    <>
      <p className="pr-8 text-base leading-6 text-ink-2">
        <strong className="font-semibold text-ink-1">Sign in</strong> for a better buying experience:
      </p>
      <ul className="mt-3 space-y-2.5 text-sm leading-5 text-ink-2">
        {["Faster checkout", "Order tracking and saved equipment", "Account pricing for approved trade customers"].map((benefit) => (
          <li key={benefit} className="flex items-start gap-2.5">
            <Check size={17} strokeWidth={2.25} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-col gap-2.5">
        <Link href="/account" onClick={onNavigate} className="flex h-12 items-center justify-center rounded-(--r-sm) bg-brand px-4 text-base font-semibold text-white transition-colors hover:bg-brand-hover">
          Create account
        </Link>
        <Link href="/portal/login" onClick={onNavigate} className="flex h-12 items-center justify-center rounded-(--r-sm) border border-line-strong bg-surface-1 px-4 text-base font-semibold text-ink-1 transition-colors hover:bg-surface-2">
          Sign in
        </Link>
      </div>
    </>
  );
}

function SignedInPanel({ account, onNavigate }: { account: Exclude<NavAccount, { variant: "signedOut" }>; onNavigate: () => void }) {
  return (
    <>
      <p className="pr-8 text-base font-semibold leading-6 text-ink-1">{account.name}</p>
      <p className="break-all text-meta text-ink-3">{account.email}</p>
      {account.variant === "tradeApproved" && (
        <p className="mt-3 rounded-(--r-sm) bg-state-success px-3 py-2 text-sm text-ink-1">
          {account.accountName}
          <span className="block text-meta text-state-success-ink">{account.priceTierLabel} pricing</span>
        </p>
      )}
      {account.variant === "tradePending" && (
        <p className="mt-3 rounded-(--r-sm) bg-state-info px-3 py-2 text-sm text-ink-2">
          Your trade application is being reviewed. You shop at list prices until it is approved.
        </p>
      )}
      {account.variant === "disabled" && (
        <p className="mt-3 rounded-(--r-sm) bg-state-warning px-3 py-2 text-sm text-state-warning-ink">Access to this account is paused.</p>
      )}
      <nav aria-label="Account" className="mt-4">
        <ul className="divide-y divide-line border-y border-line">
          {accountActions(account).map((action) => (
            <li key={action.href}>
              <Link href={action.href} onClick={onNavigate} className="flex min-h-11 items-center text-sm font-medium text-ink-1 hover:text-brand">
                {action.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form action={signOut} className="mt-4">
        <SignOutButton />
      </form>
    </>
  );
}
