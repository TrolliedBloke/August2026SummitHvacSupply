// Supabase Edge Function (Deno). Deploy:
//   supabase functions deploy quickbooks-inventory-sync
//   supabase secrets set QBO_CLIENT_ID=... QBO_CLIENT_SECRET=... QBO_REALM_ID=...
//
// Scheduled every 15 minutes by pg_cron (migration 024), through the same
// private.invoke_function indirection the email jobs use.
//
// What this does: copies QtyOnHand from QuickBooks Online onto catalog_products
// so the storefront can show real stock instead of "unknown".
//
// What this does NOT do, by design: make anything purchasable. Summit's catalog
// is quote-only. Every write goes through quickbooks_apply_inventory(), which
// can only move inventory_quantity and inventory_status -- purchase_eligible,
// retail_price and publication_status are unreachable from this function even
// if someone later edits this file carelessly.
import { createClient } from "npm:@supabase/supabase-js";
import { matchInventory, type CatalogRow, type QboItem } from "./matching.ts";

/**
 * Secrets are pasted into a dashboard by hand, and a copied line brings its
 * newline with it. The same trailing-whitespace failure that cost a debugging
 * session on the Stripe signing secret applies verbatim to Intuit's client
 * secret, so every value is trimmed on the way in. See stripe-webhook/index.ts.
 */
function env(name: string): string {
  const raw = Deno.env.get(name);
  if (!raw?.trim()) throw new Error(`${name} is not set`);
  return raw.trim();
}

function optionalEnv(name: string): string | undefined {
  return Deno.env.get(name)?.trim() || undefined;
}

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

/**
 * Exchange the stored refresh token for an access token, persisting a rotated
 * token before returning.
 *
 * Intuit rotates the refresh token on most exchanges and the previous value
 * dies immediately. The write-back happens here, before any sync work, on
 * purpose: if the QuickBooks query or the database update fails afterwards, the
 * rotation has already been saved and the next run can still authenticate. The
 * reverse order loses the credential permanently on the first transient error.
 */
async function accessToken(): Promise<string> {
  const { data: stored, error: readError } = await supabase.rpc("quickbooks_refresh_token_get");
  if (readError) throw new Error(`Could not read the stored refresh token: ${readError.message}`);
  const refreshToken = typeof stored === "string" ? stored.trim() : "";
  if (!refreshToken) {
    throw new Error(
      "private.quickbooks_token is empty. Seed it once with the initial refresh token from the Intuit OAuth playground."
    );
  }

  const clientId = env("QBO_CLIENT_ID");
  const clientSecret = env("QBO_CLIENT_SECRET");

  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });

  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(
      `QuickBooks token exchange failed (${response.status}): ${body.error ?? ""} ${body.error_description ?? ""}`.trim()
    );
  }

  if (body.refresh_token && body.refresh_token !== refreshToken) {
    const { error } = await supabase.rpc("quickbooks_refresh_token_set", { p_token: body.refresh_token });
    // A rotation we failed to store means every future run authenticates with a
    // token Intuit has already retired. Fail loudly now rather than at 03:00.
    if (error) throw new Error(`QuickBooks rotated the refresh token but it could not be saved: ${error.message}`);
  }

  return body.access_token;
}

/**
 * The realm id, reduced to digits.
 *
 * QuickBooks displays the Company ID grouped for readability ("9341 4548 1683
 * 6546"), and that is what people copy. The spaces survive `env()`, which only
 * trims the ends, and then land in the URL path -- where Intuit answers every
 * request with a generic SystemFault that names nothing. Same class of
 * copy-paste damage the secret trimming already guards against, so it gets the
 * same treatment rather than a comment telling the next person to be careful.
 */
function realmId(): string {
  const raw = env("QBO_REALM_ID");
  const digits = raw.replace(/\D/g, "");
  if (!digits) throw new Error("QBO_REALM_ID contains no digits");
  return digits;
}

/** Page through every inventory item. QuickBooks caps a query at 1000 rows. */
async function fetchItems(token: string): Promise<QboItem[]> {
  const realm = realmId();
  const host =
    (optionalEnv("QBO_ENVIRONMENT") ?? "production") === "sandbox"
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com";

  const items: QboItem[] = [];
  const pageSize = 500;
  for (let start = 1; ; start += pageSize) {
    const query = `SELECT * FROM Item WHERE Type = 'Inventory' STARTPOSITION ${start} MAXRESULTS ${pageSize}`;
    const url = `${host}/v3/company/${realm}/query?query=${encodeURIComponent(query)}&minorversion=75`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`QuickBooks query failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    }
    const body = (await response.json()) as { QueryResponse?: { Item?: QboItem[] } };
    const page = body.QueryResponse?.Item ?? [];
    items.push(...page);
    if (page.length < pageSize) return items;
  }
}

/**
 * Tell the website to drop its cached inventory map so the new counts appear
 * immediately instead of after the 60s page cache expires. Best effort: the
 * sync itself has already succeeded by this point, and the site would pick the
 * change up on its own shortly regardless.
 */
async function pingRevalidate(): Promise<void> {
  const url = optionalEnv("SITE_REVALIDATE_URL");
  const secret = optionalEnv("CRON_SECRET");
  if (!url || !secret) return;
  try {
    await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  } catch (error) {
    console.error("inventory revalidate ping failed:", error);
  }
}

/**
 * Read-only connectivity probe. Writes nothing, touches no table.
 *
 * A QuickBooks `SystemFault` (code 10000) is a catch-all that says nothing
 * about the cause -- a realm the token does not cover, a sandbox token sent to
 * the production host, and an unsupported minorversion all surface identically.
 * This walks the same request the sync makes, one variable at a time, so the
 * failing ingredient names itself instead of being guessed at.
 *
 * POST {"probe": true} to run it.
 */
async function probeQuickBooks(token: string) {
  const raw = env("QBO_REALM_ID");
  // Masked shape first: if the value is malformed, describing it is the
  // whole point of the probe, so sanitising must not be able to throw here.
  const shape = { realmShape: raw.replace(/\d/g, "#"), realmRawLength: raw.length };
  let realm: string;
  try {
    realm = realmId();
  } catch (error) {
    return { ...shape, realmSanitizedLength: 0, attempts: [], fatal: String(error) };
  }
  const environment = optionalEnv("QBO_ENVIRONMENT") ?? "production";
  const host =
    environment === "sandbox"
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com";

  const attempts: Array<Record<string, unknown>> = [];

  async function attempt(name: string, path: string) {
    try {
      const response = await fetch(`${host}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const body = await response.text();
      attempts.push({ name, status: response.status, ok: response.ok, body: body.slice(0, 240) });
    } catch (error) {
      attempts.push({ name, status: 0, ok: false, body: String(error).slice(0, 240) });
    }
  }

  const q = (sql: string, minor?: string) =>
    `/v3/company/${realm}/query?query=${encodeURIComponent(sql)}` + (minor ? `&minorversion=${minor}` : "");

  // Does the token cover this realm at all? A mismatch fails here and nowhere else.
  await attempt("companyinfo", `/v3/company/${realm}/companyinfo/${realm}`);
  // Is *any* query accepted?
  await attempt("item-any", q("SELECT * FROM Item MAXRESULTS 1"));
  // Is the Type filter the problem?
  await attempt("item-inventory", q("SELECT * FROM Item WHERE Type = 'Inventory' MAXRESULTS 1"));
  // Is the minorversion the problem? 75 is what the sync sends.
  await attempt("item-inventory-mv75", q("SELECT * FROM Item WHERE Type = 'Inventory' MAXRESULTS 1", "75"));
  await attempt("item-inventory-mv65", q("SELECT * FROM Item WHERE Type = 'Inventory' MAXRESULTS 1", "65"));
  // Exactly the sync's own query, pagination included.
  await attempt("sync-query", q("SELECT * FROM Item WHERE Type = 'Inventory' STARTPOSITION 1 MAXRESULTS 500", "75"));

  // A sample of the raw fields the matcher reads. When every product lands on
  // zero, the question is whether QuickBooks is reporting zero or whether we
  // are misreading it -- and only the untouched values answer that.
  let sample: unknown[] = [];
  try {
    const response = await fetch(
      `${host}${q("SELECT * FROM Item WHERE Type = 'Inventory' MAXRESULTS 8", "75")}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );
    const body = (await response.json()) as { QueryResponse?: { Item?: Record<string, unknown>[] } };
    sample = (body.QueryResponse?.Item ?? []).map((item) => ({
      Sku: item.Sku,
      Name: typeof item.Name === "string" ? item.Name.slice(0, 40) : item.Name,
      Type: item.Type,
      TrackQtyOnHand: item.TrackQtyOnHand,
      QtyOnHand: item.QtyOnHand,
      typeofQty: typeof item.QtyOnHand,
      InvStartDate: item.InvStartDate,
      Active: item.Active,
    }));
  } catch (error) {
    sample = [{ error: String(error) }];
  }

  return {
    environment,
    host,
    sample,
    // Digits masked: reveals stray spaces, dashes or letters without
    // disclosing the company id itself.
    realmShape: raw.replace(/\d/g, "#"),
    realmRawLength: raw.length,
    realmSanitizedLength: realm.length,
    attempts,
  };
}

Deno.serve(async (request: Request) => {
  const startedAt = new Date().toISOString();

  // Diagnostics run before anything else and never write.
  const body = await request.json().catch(() => ({}));
  if (body?.probe === true) {
    try {
      return Response.json(await probeQuickBooks(await accessToken()));
    } catch (error) {
      return Response.json(
        { ok: false, stage: "token", error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  }

  try {
    const items = await fetchItems(await accessToken());

    const { data: rows, error: rowsError } = await supabase
      .from("catalog_products")
      .select("id, catalog_sku, source_sku, name");
    if (rowsError) throw new Error(`Could not read catalog_products: ${rowsError.message}`);

    const report = matchInventory(items, (rows ?? []) as CatalogRow[]);

    const { data: updated, error: applyError } = await supabase.rpc("quickbooks_apply_inventory", {
      p_rows: report.updates,
    });
    if (applyError) throw new Error(`Inventory apply failed: ${applyError.message}`);

    // Bounded: the run log is a worksheet, not an archive. A catalog that has
    // drifted this far past the cap has a bigger problem than a truncated list,
    // and an unbounded jsonb column on a job that runs every 15 minutes is how
    // a table quietly becomes the largest thing in the database.
    const CAP = 250;
    const cap = <T>(list: T[]) => list.slice(0, CAP);

    const summary = {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ok: true,
      items_fetched: items.length,
      matched: report.matched,
      updated: Number(updated ?? 0),
      untracked: report.untracked.length,
      unmatched_catalog: report.unmatchedCatalog.length,
      unmatched_qbo: report.unmatchedQbo.length,
      ambiguous: report.ambiguous,
      untracked_skus: cap(report.untracked),
      unmatched_catalog_skus: cap(report.unmatchedCatalog),
      unmatched_qbo_skus: cap(report.unmatchedQbo),
      skuless_items: cap(report.skuless),
    };
    await supabase.from("quickbooks_sync_runs").insert(summary);

    if (summary.updated > 0) await pingRevalidate();

    return Response.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("quickbooks-inventory-sync failed:", message);

    // Record the failure. A run log with only successes in it cannot answer the
    // question this table exists for -- "is the sync still working?"
    await supabase.from("quickbooks_sync_runs").insert({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ok: false,
      error: message.slice(0, 1000),
    });

    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
