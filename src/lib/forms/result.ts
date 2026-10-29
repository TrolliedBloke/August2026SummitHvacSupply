import type { ZodError } from "zod";

/**
 * One result shape for every public form endpoint, so each form maps a 400 to
 * field messages, a 429 to a wait, and a 500 or network failure to a retry --
 * without parsing prose. Field keys match the shared schema's keys.
 */
export type FieldErrors<Field extends string = string> = Partial<Record<Field, string>>;

export type FormSuccess<T = Record<string, unknown>> = { ok: true } & T;

export type FormFailure<Field extends string = string> = {
  ok: false;
  kind: "validation" | "rate_limited" | "conflict" | "unavailable" | "network";
  fieldErrors: FieldErrors<Field>;
  formError: string | null;
  retryAfterSeconds?: number;
};

/** First message per top-level field, in schema order. */
export function fieldErrorsFrom<Field extends string>(error: ZodError): FieldErrors<Field> {
  const out: FieldErrors<Field> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "") as Field;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * POST JSON and classify the outcome. Never throws: the caller always gets a
 * typed result, and entered values stay where they are.
 */
export async function submitForm<T extends Record<string, unknown>, Field extends string = string>(
  url: string,
  body: unknown
): Promise<FormSuccess<T> | FormFailure<Field>> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return {
      ok: false,
      kind: "network",
      fieldErrors: {},
      formError: "We could not reach the server. Check your connection; your entries are still here.",
    };
  }
  const payload = (await response.json().catch(() => null)) as (Record<string, unknown> & { ok?: boolean }) | null;
  if (response.ok && payload?.ok) return payload as FormSuccess<T>;
  const fieldErrors = ((payload?.fieldErrors as FieldErrors<Field>) ?? {}) as FieldErrors<Field>;
  if (response.status === 429) {
    const retryAfterSeconds = Number(response.headers.get("Retry-After") ?? payload?.retryAfterSeconds ?? 60);
    return {
      ok: false,
      kind: "rate_limited",
      fieldErrors: {},
      formError: `Too many attempts. Wait about ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} minute${retryAfterSeconds > 60 ? "s" : ""} and send it again.`,
      retryAfterSeconds,
    };
  }
  if (response.status === 400 || response.status === 422) {
    return {
      ok: false,
      kind: "validation",
      fieldErrors,
      formError: Object.keys(fieldErrors).length ? null : String(payload?.error ?? "Check the highlighted fields."),
    };
  }
  if (response.status === 409) {
    return { ok: false, kind: "conflict", fieldErrors, formError: String(payload?.error ?? "This was already submitted.") };
  }
  return {
    ok: false,
    kind: "unavailable",
    fieldErrors: {},
    formError: String(payload?.error ?? "Something went wrong on our side. Your entries are still here -- try again."),
  };
}

/** A short, human reference: prefix + base36 time + random suffix. */
export function makeReference(prefix: string, now = Date.now()): string {
  const random = Math.floor(Math.random() * 36 ** 3).toString(36).padStart(3, "0");
  return `${prefix}-${now.toString(36).toUpperCase().slice(-6)}${random.toUpperCase()}`;
}
