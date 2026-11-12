# Phase 1 inventory root cause

The `/products` warning was produced by two application-level failure modes:

- `getLiveInventoryResult()` treated every anonymous Supabase read failure or 2.5-second timeout as an `error`/`timeout` result, but swallowed the underlying error and did not log it server-side.
- `SkuCatalogClient` rendered either result as a prominent yellow warning, even though the catalog records and commerce state already safely fall back to unverified availability.

The public read path also had no server-only retry when a transient anonymous grant, schema-cache, or network issue affected `catalog_products`. The fix keeps the public read as the normal path, retries with the existing server-only client when available, logs the failure without exposing credentials, and presents a small neutral confirmation message when counts remain unavailable.
