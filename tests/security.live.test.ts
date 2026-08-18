import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Live security regression tests, run against the configured Supabase project.
 *
 * Every assertion here corresponds to a vulnerability that was actually
 * exploitable against this database on 2026-08-10 and was verified fixed. They
 * exist so a future migration, a regenerated policy or a Supabase default
 * cannot quietly reopen one of them.
 *
 * These talk to the network. They skip themselves when .env.local is absent so
 * `npm test` still works on a machine with no credentials -- run them with
 * `npm run test:security`.
 */

function loadEnv(): { url: string; anon: string; service: string } | null {
  try {
    const raw = readFileSync(".env.local", "utf8");
    const env: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const service = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon) return null;
    return { url, anon, service: service ?? "" };
  } catch {
    return null;
  }
}

const env = loadEnv();
const skip = env ? false : "no .env.local; skipping live security tests";

const DEAD_UUID = "00000000-0000-0000-0000-000000000000";

function anonHeaders(): Record<string, string> {
  return {
    apikey: env!.anon,
    Authorization: `Bearer ${env!.anon}`,
    "Content-Type": "application/json",
  };
}

async function anonGet(query: string): Promise<{ status: number; body: string }> {
  const r = await fetch(`${env!.url}/rest/v1/${query}`, { headers: anonHeaders() });
  return { status: r.status, body: await r.text() };
}

async function anonRpc(name: string, args: unknown): Promise<number> {
  const r = await fetch(`${env!.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: anonHeaders(),
    body: JSON.stringify(args),
  });
  return r.status;
}

describe("live: anonymous cannot read commercially sensitive columns", { skip }, () => {
  it("cannot read acquisition cost", async () => {
    const r = await anonGet("skus?select=cost&limit=1");
    assert.notEqual(r.status, 200, `cost readable: ${r.body.slice(0, 120)}`);
  });

  it("cannot read dealer price", async () => {
    const r = await anonGet("skus?select=dealer_price&limit=1");
    assert.notEqual(r.status, 200, `dealer_price readable: ${r.body.slice(0, 120)}`);
  });

  it("cannot wildcard around the column grant", async () => {
    // select=* must fail rather than silently omitting the revoked columns.
    const r = await anonGet("skus?select=*&limit=1");
    assert.notEqual(r.status, 200, `select=* readable: ${r.body.slice(0, 120)}`);
  });

  it("cannot read supplier unit costs", async () => {
    const r = await anonGet("purchase_order_lines?select=unit_cost&limit=1");
    assert.notEqual(r.status, 200);
  });

  it("still serves the public catalog", async () => {
    const r = await anonGet("skus?select=sku,title,msrp&limit=1");
    assert.equal(r.status, 200, "public catalog must keep working");
    assert.notEqual(r.body, "[]");
  });
});

describe("live: anonymous cannot read internal inventory", { skip }, () => {
  for (const table of ["inventory_lots", "bins"]) {
    it(`${table} returns no rows`, async () => {
      const r = await anonGet(`${table}?select=*&limit=1`);
      assert.ok(r.status !== 200 || r.body === "[]", `${table} leaked: ${r.body.slice(0, 120)}`);
    });
  }

  it("low_stock_skus view is not reachable", async () => {
    // SECURITY DEFINER views bypass RLS on the underlying table, so this has to
    // be checked separately from inventory_lots.
    const r = await anonGet("low_stock_skus?select=*&limit=1");
    assert.notEqual(r.status, 200);
  });

  it("trial_balance (general ledger) is not reachable", async () => {
    const r = await anonGet("trial_balance?select=*&limit=1");
    assert.notEqual(r.status, 200);
  });
});

describe("live: anonymous cannot execute operational RPCs", { skip }, () => {
  const cases: Array<[string, unknown]> = [
    ["apply_payment", { p_invoice_id: DEAD_UUID, p_amount: 0, p_method: "x", p_reference: null, p_stripe_event_id: null }],
    ["post_journal", { p_memo: "x", p_source_type: "x", p_source_id: DEAD_UUID, p_lines: [] }],
    ["adjust_inventory", { p_lot_id: DEAD_UUID, p_delta: 0, p_note: "x" }],
    ["ship_order", { p_order_id: DEAD_UUID, p_carrier: "x", p_tracking: "x" }],
    ["invoice_order", { p_order_id: DEAD_UUID, p_due_date: "2026-01-01" }],
    ["convert_quote_to_order", { p_quote_id: DEAD_UUID }],
    ["reserve_order", { p_order_id: DEAD_UUID }],
    ["receive_purchase_order", { p_po_id: DEAD_UUID, p_warehouse_id: DEAD_UUID }],
  ];

  for (const [name, args] of cases) {
    it(`${name} is refused`, async () => {
      const status = await anonRpc(name, args);
      assert.ok(status >= 400, `${name} was reachable (HTTP ${status})`);
    });
  }
});

describe("live: tables added by migrations 005-014 are not anon-readable", { skip }, () => {
  // These were created after the first lockdown. Supabase's default privileges
  // grant anon full DML on every new table in `public`, so each migration is an
  // opportunity to reopen the hole -- which is exactly what happened with
  // mark_order_paid. These assertions catch it next time.
  const mustBeClosed = [
    "contact_requests",
    "order_payments",
    "back_in_stock_subscriptions",
    "cart_snapshots",
    "chat_transcripts",
    "site_events",
    "saved_lists",
    "catalog_product_costs",
    "catalog_product_trade_pricing",
    "catalog_import_runs",
    "payment_disputes",
  ];

  for (const table of mustBeClosed) {
    it(`${table} is not readable`, async () => {
      const r = await anonGet(`${table}?select=*&limit=1`);
      assert.ok(r.status !== 200 || r.body === "[]", `${table} leaked: ${r.body.slice(0, 120)}`);
    });
  }

  it("catalog_products serves the public catalog", async () => {
    const r = await anonGet("catalog_products?select=catalog_sku,name&limit=1");
    assert.equal(r.status, 200);
    assert.notEqual(r.body, "[]");
  });

  it("catalog_products carries no cost or trade-price column", async () => {
    for (const column of ["contractor_price", "unit_cost", "cost"]) {
      const r = await anonGet(`catalog_products?select=${column}&limit=1`);
      assert.notEqual(r.status, 200, `catalog_products.${column} is selectable`);
    }
  });
});

describe("live: functions added by migrations 006-014 are not anon-executable", { skip }, () => {
  const cases: Array<[string, unknown]> = [
    ["mark_order_paid", { p_order_id: DEAD_UUID, p_amount: 0, p_stripe_event_id: null }],
    ["release_checkout_order", { p_order_id: DEAD_UUID, p_state: "expired" }],
    ["expire_stale_checkout_orders", {}],
    ["reserve_public_order", { p_order_id: DEAD_UUID }],
    ["advance_fulfillment", { p_order_id: DEAD_UUID, p_status: "delivered" }],
    ["handle_new_retail_user", {}],
    // Migration 020. These move money in the opposite direction to
    // mark_order_paid/apply_payment, so an anon caller could zero out an
    // invoice balance or hand an account an unearned credit.
    [
      "reverse_payment",
      {
        p_invoice_id: DEAD_UUID,
        p_amount: 1,
        p_method: "stripe_refund",
        p_reference: null,
        p_stripe_event_id: null,
      },
    ],
    ["reverse_order_payment", { p_order_id: DEAD_UUID, p_amount: 1, p_stripe_event_id: null }],
    [
      "record_payment_dispute",
      {
        p_stripe_dispute_id: "du_test",
        p_payment_intent_id: null,
        p_amount: 1,
        p_reason: null,
        p_status: "needs_response",
        p_evidence_due_by: null,
        p_order_id: null,
        p_invoice_id: null,
        p_stripe_event_id: null,
      },
    ],
  ];

  for (const [name, args] of cases) {
    it(`${name} is refused`, async () => {
      const status = await anonRpc(name, args);
      assert.ok(status >= 400, `${name} was reachable (HTTP ${status})`);
    });
  }
});

describe("live: unknown inventory can never be purchasable", { skip }, () => {
  it("no catalog_products row is purchase_eligible without verified inventory", async () => {
    // The DB CHECK enforces this, but the check is only as good as the data
    // that got past it; assert the actual served state.
    const r = await anonGet(
      "catalog_products?select=catalog_sku,purchase_eligible,inventory_status,inventory_quantity&purchase_eligible=is.true"
    );
    assert.equal(r.status, 200);
    const rows = JSON.parse(r.body) as Array<{
      inventory_status: string;
      inventory_quantity: number | null;
    }>;
    for (const row of rows) {
      assert.notEqual(row.inventory_status, "unknown");
      assert.notEqual(row.inventory_quantity, null);
    }
  });
});

describe("live: anonymous cannot write", { skip }, () => {
  it("cannot INSERT a quote request directly", async () => {
    // Must use return=minimal: with return=representation this fails for a
    // *different* reason (no SELECT grant), which would mask a real hole.
    const r = await fetch(`${env!.url}/rest/v1/quote_requests`, {
      method: "POST",
      headers: { ...anonHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ name: "regression", email: "regression@invalid.test", need: "x" }),
    });
    assert.ok(r.status >= 400, `anon inserted a quote request (HTTP ${r.status})`);
  });

  it("cannot UPDATE catalog or financial rows", async () => {
    for (const [table, patch] of [
      ["warehouses", { name: "pwned" }],
      ["invoices", { status: "paid" }],
      ["user_profiles", { role: "staff" }],
      ["inventory_lots", { on_hand: 99999 }],
    ] as const) {
      const r = await fetch(`${env!.url}/rest/v1/${table}?id=neq.${DEAD_UUID}`, {
        method: "PATCH",
        headers: { ...anonHeaders(), Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });
      const body = await r.text();
      // A 200 with [] means RLS filtered every row -- also acceptable. A 200
      // with rows means the write landed.
      assert.ok(r.status >= 400 || body === "[]", `anon updated ${table}: ${body.slice(0, 100)}`);
    }
  });
});
