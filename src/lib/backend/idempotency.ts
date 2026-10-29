/**
 * Request idempotency for public form endpoints.
 *
 * A client sends a stable request id with every submit of the same draft; a
 * retry after a timeout returns the first outcome instead of creating a second
 * record. This in-process window is the first line of defense (and the only
 * one in seeded mode); the database's unique `client_request_id` column is the
 * durable one when Supabase is configured.
 */
const WINDOW_MS = 24 * 60 * 60_000;
const store = new Map<string, { at: number; value: unknown }>();

export function rememberedResult<T>(scope: string, key: string | undefined | null): T | null {
  if (!key) return null;
  const entry = store.get(`${scope}:${key}`);
  if (!entry) return null;
  if (Date.now() - entry.at > WINDOW_MS) {
    store.delete(`${scope}:${key}`);
    return null;
  }
  return entry.value as T;
}

export function rememberResult(scope: string, key: string | undefined | null, value: unknown) {
  if (!key) return;
  if (store.size > 5000) {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [entryKey, entry] of store) if (entry.at < cutoff) store.delete(entryKey);
  }
  store.set(`${scope}:${key}`, { at: Date.now(), value });
}
