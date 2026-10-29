import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import {
  buildOrdersXml,
  formatShipStationDate,
  parseShipNotice,
  parseShipStationDate,
  shipStationAuthorized,
  trackingUrl,
  type ExportOrder,
} from "../src/lib/shipstation/custom-store";
import { exportStatus, readyToFulfil, toExportOrder } from "../src/lib/backend/shipstation";
import { safeNextPath } from "../src/lib/safe-redirect";
import { assertSeededAllowed } from "../src/lib/backend/seeded";
import { cronAuthorized } from "../src/lib/backend/cron-auth";
import {
  deliveryStatusFor,
  htmlToText,
  isAutomated,
  parseSender,
  routeInbound,
  shouldReplaceDelivery,
  stripQuotedReply,
} from "../src/lib/support/inbound";

const ENV_KEYS = ["SHIPSTATION_STORE_USERNAME", "SHIPSTATION_STORE_PASSWORD", "RESEND_WEBHOOK_SECRET", "RESEND_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

describe("ShipStation custom store: protocol", () => {
  it("formats dates on the Pacific clock and parses ShipStation's format", () => {
    assert.equal(formatShipStationDate("2026-10-04T18:05:00Z"), "10/04/2026 11:05");
    assert.equal(parseShipStationDate("10/04/2026 11:05")?.toISOString(), "2026-10-04T11:05:00.000Z");
    assert.equal(parseShipStationDate("10/4/2026")?.toISOString(), "2026-10-04T00:00:00.000Z");
    assert.equal(parseShipStationDate("yesterday"), null);
  });

  it("accepts Basic or SS- query credentials and fails closed", () => {
    const expected = { username: "summit", password: "s3cret" };
    assert.equal(shipStationAuthorized(basic("summit", "s3cret"), new URLSearchParams(), expected), true);
    assert.equal(shipStationAuthorized(null, new URLSearchParams("SS-UserName=summit&SS-Password=s3cret"), expected), true);
    assert.equal(shipStationAuthorized(basic("summit", "wrong"), new URLSearchParams(), expected), false);
    assert.equal(shipStationAuthorized(basic("summit", "s3cret"), new URLSearchParams(), { username: undefined, password: undefined }), false);
  });

  it("writes order XML that a value cannot break out of", () => {
    const order: ExportOrder = {
      id: "o1",
      number: "SO-1",
      createdAt: "2026-10-04T18:00:00Z",
      lastModified: "2026-10-04T18:30:00Z",
      status: "paid",
      shippingMethod: "Freight",
      paymentMethod: "Card (Stripe)",
      total: 1290,
      tax: 0,
      shipping: 0,
      internalNotes: "PO ]]><Evil/>",
      customer: { email: "a@example.com", name: "Ann", company: null, phone: null },
      shipTo: { name: "Ann", company: null, address1: "1 Main St", city: "Fremont", state: "CA", postalCode: "94536", phone: null, country: "US" },
      items: [{ sku: "TCL24KODU", name: "TCL 24k Outdoor Unit", quantity: 1, unitPrice: 1290, weightLbs: 88, imageUrl: null }],
    };
    const xml = buildOrdersXml([order], 3);
    assert.match(xml, /^<\?xml version="1.0" encoding="utf-8"\?>/);
    assert.match(xml, /<Orders pages="3">/);
    assert.match(xml, /<OrderNumber><!\[CDATA\[SO-1\]\]><\/OrderNumber>/);
    assert.match(xml, /<Weight>88<\/Weight><WeightUnits>Pounds<\/WeightUnits>/);
    // A "]]>" inside a value is split across two CDATA sections, so the
    // field still reads back exactly and no markup escapes into the document.
    const notes = xml.match(/<InternalNotes>([\s\S]*?)<\/InternalNotes>/)![1];
    assert.equal(notes.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"), "PO ]]><Evil/>");
    assert.ok(!/<InternalNotes>[^<]*<Evil/.test(xml));
  });

  it("reads the ship notice from the query string, falling back to the XML body", () => {
    const fromQuery = parseShipNotice(new URLSearchParams("order_number=SO-9&carrier=ups&service=Ground&tracking_number=1Z1"), "");
    assert.deepEqual({ ...fromQuery, shipDate: null }, { orderNumber: "SO-9", carrier: "ups", service: "Ground", trackingNumber: "1Z1", shipDate: null });
    const body = "<ShipNotice><OrderNumber><![CDATA[SO-7]]></OrderNumber><Carrier>fedex</Carrier><TrackingNumber>7777</TrackingNumber><ShipDate>10/05/2026</ShipDate></ShipNotice>";
    const fromBody = parseShipNotice(new URLSearchParams(), body)!;
    assert.equal(fromBody.orderNumber, "SO-7");
    assert.equal(fromBody.trackingNumber, "7777");
    assert.equal(fromBody.shipDate?.toISOString(), "2026-10-05T00:00:00.000Z");
    assert.equal(parseShipNotice(new URLSearchParams(), "<ShipNotice/>"), null);
  });

  it("links tracking only for carriers it knows", () => {
    assert.match(trackingUrl("ups", "1Z 1")!, /ups\.com\/track\?tracknum=1Z%201$/);
    assert.match(trackingUrl("stamps_com", "9400")!, /usps\.com/);
    assert.equal(trackingUrl("ltl freight", "123"), null);
    assert.equal(trackingUrl("ups", null), null);
  });
});

describe("ShipStation custom store: which orders ship", () => {
  it("exports card orders once paid and net-terms orders once confirmed", () => {
    assert.equal(readyToFulfil({ paid: true, payment_mode: "card", checkout_state: "paid" }), true);
    assert.equal(readyToFulfil({ paid: false, payment_mode: "card", checkout_state: "payment_pending" }), false);
    assert.equal(readyToFulfil({ paid: false, payment_mode: "net_terms", checkout_state: "confirmed" }), true);
    assert.equal(readyToFulfil({ paid: false, payment_mode: "net_terms", checkout_state: "checkout_started" }), false);
  });

  it("maps an order with catalog SKUs, tax and a will-call ship-to", () => {
    const order = toExportOrder(
      {
        id: "o1", order_number: "SO-1", created_at: "2026-10-04T18:00:00Z", checkout_updated_at: "2026-10-04T18:20:00Z", status: "reserved",
        paid: false, payment_mode: "net_terms", checkout_state: "confirmed", fulfillment_method: "pickup", fulfillment_window: null,
        fulfillment_fee: 0, subtotal: 1000, total: 1092.5, delivery_address: null, delivery_zip: null,
        buyer_name: "Ann", buyer_email: "a@example.com", buyer_phone: null, buyer_company: "Ann HVAC", po_number: "PO-7",
      },
      [{ order_id: "o1", description: "TCL 24k Outdoor Unit (TCL24KODU)", quantity: 1, unit_price: 1000, catalog_product_id: "nope" }]
    );
    assert.equal(order.status, "paid");
    assert.equal(order.paymentMethod, "Net terms");
    assert.equal(order.tax, 92.5);
    assert.equal(order.lastModified, "2026-10-04T18:20:00Z");
    assert.match(order.shippingMethod, /Will-call pickup/);
    assert.match(order.shipTo.address1!, /^Will-call pickup/);
    assert.match(order.internalNotes!, /PO PO-7/);
    assert.match(order.internalNotes!, /not yet paid/);
    // Unknown catalog id: the SKU is read from the line description.
    assert.equal(order.items[0].sku, "TCL24KODU");
  });
});

describe("ShipStation route", () => {
  it("refuses everything without configured credentials, then wrong credentials", async () => {
    const { GET, POST } = await import("../src/app/api/shipstation/route");
    delete process.env.SHIPSTATION_STORE_USERNAME;
    delete process.env.SHIPSTATION_STORE_PASSWORD;
    assert.equal((await GET(new Request("https://x.test/api/shipstation?action=export"))).status, 401);
    process.env.SHIPSTATION_STORE_USERNAME = "summit";
    process.env.SHIPSTATION_STORE_PASSWORD = "s3cret";
    assert.equal((await GET(new Request("https://x.test/api/shipstation?action=export", { headers: { authorization: basic("summit", "nope") } }))).status, 401);
    assert.equal((await POST(new Request("https://x.test/api/shipstation?action=shipnotify", { method: "POST", body: "", headers: { authorization: basic("summit", "s3cret") } }))).status, 400);
  });

  it("reports the database as unavailable rather than inventing an empty store", async () => {
    const { GET } = await import("../src/app/api/shipstation/route");
    process.env.SHIPSTATION_STORE_USERNAME = "summit";
    process.env.SHIPSTATION_STORE_PASSWORD = "s3cret";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await GET(new Request("https://x.test/api/shipstation?action=export&start_date=10/01/2026 00:00", { headers: { authorization: basic("summit", "s3cret") } }));
    assert.equal(response.status, 503);
  });
});

describe("support inbox: inbound email", () => {
  it("parses senders", () => {
    assert.deepEqual(parseSender('"Jane Doe" <Jane@Example.com>'), { name: "Jane Doe", email: "jane@example.com" });
    assert.deepEqual(parseSender("bob@example.com"), { name: null, email: "bob@example.com" });
    assert.equal(parseSender("not an address"), null);
  });

  it("ignores auto-replies, bounces, no-reply senders and our own domain", () => {
    const person = { name: "Jane", email: "jane@example.com" };
    assert.equal(isAutomated(person, { From: "x" }, ["summithvacsupply.com"]), false);
    assert.equal(isAutomated(person, { "Auto-Submitted": "auto-replied" }, []), true);
    assert.equal(isAutomated(person, { "Auto-Submitted": "no" }, []), false);
    assert.equal(isAutomated(person, { Precedence: "bulk" }, []), true);
    assert.equal(isAutomated({ name: null, email: "MAILER-DAEMON@mx.example.com" }, null, []), true);
    assert.equal(isAutomated({ name: null, email: "orders@summithvacsupply.com" }, null, ["summithvacsupply.com"]), true);
  });

  it("routes to the same desks as the contact form", () => {
    assert.deepEqual(routeInbound("Where is SO-2026-2217?", ""), { topic: "order", queue: "orders", orderRef: "SO-2026-2217" });
    assert.equal(routeInbound("Damaged condenser", "it arrived broken").topic, "returns");
    assert.equal(routeInbound("Pricing for 3 ton", "").topic, "quote");
    assert.equal(routeInbound("Hello", "general question").topic, "other");
  });

  it("keeps the new part of a reply and reads HTML-only mail", () => {
    assert.equal(stripQuotedReply("Thanks, that works.\n\nOn Mon, Oct 5, 2026 Summit wrote:\n> old text"), "Thanks, that works.");
    assert.equal(htmlToText("<p>Hi&nbsp;there</p><p>Line 2<br>Line 3</p><style>p{}</style>"), "Hi there\nLine 2\nLine 3");
  });
});

describe("support inbox: delivery outcomes", () => {
  it("maps provider events and never lets a late success hide a bounce", () => {
    assert.equal(deliveryStatusFor("email.delivered"), "delivered");
    assert.equal(deliveryStatusFor("email.received"), null);
    assert.equal(deliveryStatusFor("contact.created"), null);
    assert.equal(shouldReplaceDelivery(null, "delivered"), true);
    assert.equal(shouldReplaceDelivery("delivered", "opened"), true);
    assert.equal(shouldReplaceDelivery("opened", "delivered"), false);
    assert.equal(shouldReplaceDelivery("bounced", "delivered"), false);
    assert.equal(shouldReplaceDelivery("delivered", "bounced"), true);
  });
});

describe("Resend webhook route", () => {
  const secretBytes = randomBytes(24);
  const secret = `whsec_${secretBytes.toString("base64")}`;
  const signed = (payload: string, timestamp = Math.floor(Date.now() / 1000)) => {
    const id = "msg_test";
    const signature = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${payload}`).digest("base64");
    return new Request("https://x.test/api/resend/webhook", {
      method: "POST",
      body: payload,
      headers: { "svix-id": id, "svix-timestamp": String(timestamp), "svix-signature": `v1,${signature}` },
    });
  };

  it("is off until configured, and rejects a bad or stale signature", async () => {
    const { POST } = await import("../src/app/api/resend/webhook/route");
    delete process.env.RESEND_WEBHOOK_SECRET;
    assert.equal((await POST(signed("{}"))).status, 503);
    process.env.RESEND_WEBHOOK_SECRET = secret;
    process.env.RESEND_API_KEY = "re_test_only";
    const forged = new Request("https://x.test/api/resend/webhook", { method: "POST", body: "{}", headers: { "svix-id": "x", "svix-timestamp": String(Math.floor(Date.now() / 1000)), "svix-signature": "v1,AAAA" } });
    assert.equal((await POST(forged)).status, 401);
    assert.equal((await POST(signed("{}", Math.floor(Date.now() / 1000) - 3600))).status, 401);
  });

  it("accepts a correctly signed event", async () => {
    const { POST } = await import("../src/app/api/resend/webhook/route");
    process.env.RESEND_WEBHOOK_SECRET = secret;
    process.env.RESEND_API_KEY = "re_test_only";
    const response = await POST(signed(JSON.stringify({ type: "contact.created", data: {} })));
    assert.equal(response.status, 200);
  });
});

describe("QA-2026-10-04 fixes", () => {
  const baseOrder = {
    id: "o2", order_number: "SO-2", created_at: "2026-10-04T18:00:00Z", checkout_updated_at: null, status: "pending",
    paid: true, payment_mode: "card", checkout_state: "paid", fulfillment_method: "local_delivery", fulfillment_window: null,
    fulfillment_fee: 35, subtotal: 1000, total: 1035, delivery_address: "1 Main St", delivery_zip: "94538",
    buyer_name: "Ann", buyer_email: "a@example.com", buyer_phone: null, buyer_company: null, po_number: null, hold_reason: null,
  };

  it("rejects impossible ShipStation dates instead of rolling them over (QA-016)", () => {
    assert.equal(parseShipStationDate("13/45/2026"), null);
    assert.equal(parseShipStationDate("02/30/2026"), null);
    assert.equal(parseShipStationDate("10/01/2026 24:00"), null);
    assert.equal(parseShipStationDate("10/01/2026 13:05")?.toISOString(), "2026-10-01T13:05:00.000Z");
    assert.equal(parseShipStationDate("10/01/2026")?.toISOString(), "2026-10-01T00:00:00.000Z");
  });

  it("gives delivered orders a city and state, flags free-text freight, and drops zero-quantity lines (QA-010, QA-017)", () => {
    const delivered = toExportOrder(baseOrder, [
      { order_id: "o2", description: "Thing (TCL24KODU)", quantity: 0, unit_price: 1, catalog_product_id: null },
      { order_id: "o2", description: "Other (TCL24KIDU)", quantity: 2, unit_price: 1, catalog_product_id: null },
    ]);
    assert.equal(delivered.shipTo.city, "Fremont");
    assert.equal(delivered.shipTo.state, "CA");
    const xml = buildOrdersXml([delivered], 1);
    assert.match(xml, /<City><!\[CDATA\[Fremont\]\]><\/City><State><!\[CDATA\[CA\]\]><\/State>/);
    assert.equal((xml.match(/<Item>/g) ?? []).length, 1);
    assert.ok(!xml.includes("<Quantity>0</Quantity>"));
    const freight = toExportOrder({ ...baseOrder, fulfillment_method: "freight", delivery_zip: "10001" }, []);
    assert.equal(freight.shipTo.city, null);
    assert.match(freight.internalNotes!, /confirm city and state/);
  });

  it("exports held orders as on_hold and never exports an authorized card (QA-001)", () => {
    assert.equal(exportStatus({ status: "pending", checkout_state: "paid", hold_reason: "credit_limit" }), "on_hold");
    assert.equal(exportStatus({ status: "cancelled", checkout_state: "paid_needs_review", hold_reason: "paid_after_cancellation" }), "on_hold");
    assert.equal(exportStatus({ status: "shipped", checkout_state: "paid", hold_reason: "credit_limit" }), "shipped");
    assert.equal(exportStatus({ status: "cancelled", checkout_state: "paid", hold_reason: null }), "cancelled");
    assert.equal(readyToFulfil({ paid: false, payment_mode: "card", checkout_state: "authorized" }), false);
    assert.match(toExportOrder({ ...baseOrder, hold_reason: "compliance_review" }, []).internalNotes!, /ON HOLD: compliance_review/);
  });

  it("keeps post-login redirects on this site (QA-006)", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/.//evil.example", "javascript:alert(1)"]) {
      assert.equal(safeNextPath(bad, "/portal"), "/portal", JSON.stringify(bad));
    }
    assert.equal(safeNextPath("/products/sku/tcl24kodu?x=1#y", "/portal"), "/products/sku/tcl24kodu?x=1#y");
    assert.equal(safeNextPath("/a/../b", "/portal"), "/b");
  });

  it("refuses seeded form receipts in production (QA-007)", () => {
    const env = process.env as Record<string, string | undefined>;
    const saved = env.NODE_ENV;
    try {
      env.NODE_ENV = "production";
      assert.throws(() => assertSeededAllowed("contact request"), /nothing was saved/);
      env.NODE_ENV = "development";
      assert.doesNotThrow(() => assertSeededAllowed("contact request"));
    } finally {
      env.NODE_ENV = saved;
    }
  });

  it("checks the cron bearer exactly and fails closed in production", () => {
    const env = process.env as Record<string, string | undefined>;
    const saved = { secret: env.CRON_SECRET, node: env.NODE_ENV };
    try {
      env.CRON_SECRET = "s3cret";
      assert.equal(cronAuthorized(new Request("https://x.test", { headers: { authorization: "Bearer s3cret" } })), true);
      assert.equal(cronAuthorized(new Request("https://x.test", { headers: { authorization: "Bearer s3cre" } })), false);
      assert.equal(cronAuthorized(new Request("https://x.test")), false);
      delete env.CRON_SECRET;
      env.NODE_ENV = "production";
      assert.equal(cronAuthorized(new Request("https://x.test")), false);
    } finally {
      if (saved.secret === undefined) delete env.CRON_SECRET; else env.CRON_SECRET = saved.secret;
      env.NODE_ENV = saved.node;
    }
  });

  it("trims a wrapped Gmail reply header and decodes numeric entities (QA-018)", () => {
    assert.equal(stripQuotedReply("Thanks.\n\nOn Sat, Oct 3, 2026 at 9:14 AM Summit <\norders@summithvacsupply.com> wrote:\n> old"), "Thanks.");
    assert.equal(stripQuotedReply("On second thought, cancel it.\nThanks"), "On second thought, cancel it.\nThanks");
    assert.equal(htmlToText("<p>Line&#8217;s &mdash; &#x2014; &amp;lt; &bogus;</p>"), "Line\u2019s \u2014 \u2014 &lt; &bogus;");
  });
});
