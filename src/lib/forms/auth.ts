import { z } from "zod";

/**
 * One password policy and one signup schema, used by the browser (live rule
 * checklist and pre-submit validation) and by the server actions (authoritative
 * validation). Supabase's own minimum in supabase/config.toml matches
 * PASSWORD_MIN_LENGTH so the provider never rejects what this accepts.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRule = { id: string; label: string; test: (password: string, context: { email?: string }) => boolean };

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (password) => password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH },
  { id: "letter", label: "A letter", test: (password) => /[A-Za-z]/.test(password) },
  { id: "number", label: "A number", test: (password) => /\d/.test(password) },
  {
    id: "not-email",
    label: "Not your email address",
    test: (password, { email }) => !email || password.trim().toLowerCase() !== email.trim().toLowerCase(),
  },
];

export function passwordRuleResults(password: string, email?: string) {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(password, { email }) }));
}

const passwordField = z
  .string()
  .max(PASSWORD_MAX_LENGTH, `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`)
  .min(1, "Create a password.");

function checkPassword(value: { password: string; email?: string }, ctx: z.RefinementCtx, path = "password") {
  const failed = passwordRuleResults(value.password, value.email).filter((rule) => !rule.met);
  if (value.password && failed.length) {
    ctx.addIssue({ code: "custom", path: [path], message: `Password needs: ${failed.map((rule) => rule.label.toLowerCase()).join(", ")}.` });
  }
}

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Use 254 characters or fewer.")
  .email("Enter an email address like you@example.com.");

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(120, "Use 120 characters or fewer."),
    email: emailField,
    password: passwordField,
  })
  .superRefine((value, ctx) => checkPassword(value, ctx));

export type SignupField = "name" | "email" | "password";

export const resetPasswordSchema = z
  .object({ password: passwordField, confirm: z.string().min(1, "Enter the new password again.") })
  .superRefine((value, ctx) => {
    checkPassword(value, ctx);
    if (value.confirm && value.password !== value.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Both passwords must match." });
  });

export type ResetField = "password" | "confirm";

export const forgotPasswordSchema = z.object({ email: emailField });

/**
 * The only shape auth server actions return. Provider messages never cross
 * this boundary: they are mapped to these codes and fixed copy.
 */
export type AuthResult<Field extends string = string> =
  | { status: "idle" }
  | { status: "success"; message?: string }
  | {
      status: "error";
      fieldErrors: Partial<Record<Field, string>>;
      formError: string | null;
      /** Non-secret values to put back in the form. Passwords are never echoed. */
      values?: Partial<Record<Field, string>>;
      retryAfterSeconds?: number;
    };

export const AUTH_IDLE = { status: "idle" } as const;

/** Mask an address for display: "pat.lee@example.com" -> "p•••@example.com". */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "your email address";
  return `${local.slice(0, 1)}•••@${domain}`;
}
