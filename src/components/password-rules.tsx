"use client";

import { Check, Circle } from "lucide-react";
import { passwordRuleResults } from "@/lib/forms/auth";

/**
 * The password policy, shown before submit and updated as the person types.
 * Each rule says "met" or "not met" in words for screen readers; the icon is
 * a second signal, never the only one.
 */
export function PasswordRules({ id, password, email }: { id: string; password: string; email?: string }) {
  const results = passwordRuleResults(password, email);
  return (
    <ul id={id} className="mt-1 grid gap-1 text-meta sm:grid-cols-2">
      {results.map((rule) => (
        <li key={rule.id} className={`flex items-center gap-2 ${rule.met ? "text-state-success-ink" : "text-ink-3"}`}>
          {rule.met ? <Check size={14} aria-hidden="true" /> : <Circle size={10} aria-hidden="true" className="mx-0.5" />}
          <span>
            {rule.label}
            <span className="sr-only">{rule.met ? ", met" : ", not met yet"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
