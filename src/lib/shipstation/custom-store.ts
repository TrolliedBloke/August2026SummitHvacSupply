/**
 * ShipStation "Custom Store" protocol (docs/PIPELINE-ARCHITECTURE-PLAN.md, F1).
 *
 * ShipStation polls one URL we host:
 *   GET  ?action=export&start_date=MM/dd/yyyy HH:mm&end_date=...&page=N
 *        -> <Orders> XML of orders to pick, pack and ship
 *   POST ?action=shipnotify&order_number=...&carrier=...&service=...&tracking_number=...
 *        with a <ShipNotice> XML body once a label is bought or an order is
 *        marked shipped.
 * It authenticates with HTTP Basic, and also sends the same credentials as
 * SS-UserName / SS-Password query parameters for hosts that strip headers.
 *
 * Pure: building and parsing XML, dates and the credential check. The route
 * (src/app/api/shipstation/route.ts) does the database work.
 */

import { timingSafeEqual } from "node:crypto";

export type ExportItem = {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  weightLbs: number | null;
  imageUrl: string | null;
};

export type ExportOrder = {
  id: string;
  number: string;
  createdAt: string;
  lastModified: string;
  /** "on_hold": paid but held for staff (sales_orders.hold_reason); map it to On Hold in ShipStation. */
  status: "paid" | "shipped" | "cancelled" | "on_hold";
  shippingMethod: string;
  paymentMethod: string;
  total: number;
  tax: number;
  shipping: number;
  internalNotes: string | null;
  customer: { email: string | null; name: string | null; company: string | null; phone: string | null };
  shipTo: { name: string | null; company: string | null; address1: string | null; city: string | null; state: string | null; postalCode: string | null; phone: string | null; country: "US" };
  items: ExportItem[];
};

/** Orders per export page. ShipStation pages until it has `pages`. */
export const EXPORT_PAGE_SIZE = 100;

/* Dates ---------------------------------------------------------------------- */

const PACIFIC = "America/Los_Angeles";

/** "MM/dd/yyyy HH:mm" in Pacific time, the store's local clock. */
export function formatShipStationDate(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: PACIFIC, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value])
  );
  return `${parts.month}/${parts.day}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/**
 * ShipStation's "MM/dd/yyyy HH:mm" (time optional). The zone it means is not
 * pinned down by the protocol, so callers widen the window by a day on each
 * side; ShipStation de-duplicates re-exported orders by order id.
 */
export function parseShipStationDate(value: string | null): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [month, day, year, hour, minute] = match.slice(1).map((part) => Number(part ?? 0));
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  // Date.UTC rolls 02/30 over into March; a date that moved is not the date sent.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

export const EXPORT_WINDOW_SLACK_MS = 24 * 3_600_000;

/* Credentials ------------------------------------------------------------------- */

function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Accepts HTTP Basic or the SS-UserName / SS-Password query parameters.
 * Fails closed: no configured credentials means no access.
 */
export function shipStationAuthorized(
  authorization: string | null,
  params: URLSearchParams,
  expected: { username: string | undefined; password: string | undefined }
): boolean {
  if (!expected.username || !expected.password) return false;
  let username = params.get("SS-UserName") ?? "";
  let password = params.get("SS-Password") ?? "";
  if (authorization?.startsWith("Basic ")) {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const split = decoded.indexOf(":");
    if (split > 0) {
      username = decoded.slice(0, split);
      password = decoded.slice(split + 1);
    }
  }
  // Evaluate both, so a wrong username and a wrong password take the same time.
  const userOk = same(username, expected.username);
  const passOk = same(password, expected.password);
  return userOk && passOk;
}

/* Export XML ------------------------------------------------------------------- */

/** CDATA that cannot be broken out of by a "]]>" inside the value. */
function cdata(value: string | null | undefined): string {
  return `<![CDATA[${(value ?? "").replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

const money = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

function itemXml(item: ExportItem): string {
  return [
    "<Item>",
    `<SKU>${cdata(item.sku)}</SKU>`,
    `<Name>${cdata(item.name)}</Name>`,
    item.imageUrl ? `<ImageUrl>${cdata(item.imageUrl)}</ImageUrl>` : "",
    item.weightLbs !== null ? `<Weight>${item.weightLbs}</Weight><WeightUnits>Pounds</WeightUnits>` : "",
    `<Quantity>${Math.round(item.quantity)}</Quantity>`,
    `<UnitPrice>${money(item.unitPrice)}</UnitPrice>`,
    "</Item>",
  ].join("");
}

function orderXml(order: ExportOrder): string {
  return [
    "<Order>",
    `<OrderID>${cdata(order.id)}</OrderID>`,
    `<OrderNumber>${cdata(order.number)}</OrderNumber>`,
    `<OrderDate>${formatShipStationDate(order.createdAt)}</OrderDate>`,
    `<OrderStatus>${cdata(order.status)}</OrderStatus>`,
    `<LastModified>${formatShipStationDate(order.lastModified)}</LastModified>`,
    `<ShippingMethod>${cdata(order.shippingMethod)}</ShippingMethod>`,
    `<PaymentMethod>${cdata(order.paymentMethod)}</PaymentMethod>`,
    "<CurrencyCode>USD</CurrencyCode>",
    `<OrderTotal>${money(order.total)}</OrderTotal>`,
    `<TaxAmount>${money(order.tax)}</TaxAmount>`,
    `<ShippingAmount>${money(order.shipping)}</ShippingAmount>`,
    `<InternalNotes>${cdata(order.internalNotes)}</InternalNotes>`,
    "<Customer>",
    `<CustomerCode>${cdata(order.customer.email ?? order.number)}</CustomerCode>`,
    "<BillTo>",
    `<Name>${cdata(order.customer.name ?? order.customer.email ?? "Customer")}</Name>`,
    `<Company>${cdata(order.customer.company)}</Company>`,
    `<Phone>${cdata(order.customer.phone)}</Phone>`,
    `<Email>${cdata(order.customer.email)}</Email>`,
    "</BillTo>",
    "<ShipTo>",
    `<Name>${cdata(order.shipTo.name ?? order.customer.name ?? "Customer")}</Name>`,
    `<Company>${cdata(order.shipTo.company)}</Company>`,
    `<Address1>${cdata(order.shipTo.address1)}</Address1>`,
    order.shipTo.city ? `<City>${cdata(order.shipTo.city)}</City>` : "",
    order.shipTo.state ? `<State>${cdata(order.shipTo.state)}</State>` : "",
    `<PostalCode>${cdata(order.shipTo.postalCode)}</PostalCode>`,
    `<Country>${order.shipTo.country}</Country>`,
    `<Phone>${cdata(order.shipTo.phone)}</Phone>`,
    "</ShipTo>",
    "</Customer>",
    // A line with nothing to pick is not sent; ShipStation would pick one.
    `<Items>${order.items.filter((item) => Math.round(item.quantity) >= 1).map(itemXml).join("")}</Items>`,
    "</Order>",
  ].join("");
}

export function buildOrdersXml(orders: ExportOrder[], pages: number): string {
  return `<?xml version="1.0" encoding="utf-8"?>\n<Orders pages="${Math.max(1, pages)}">${orders.map(orderXml).join("")}</Orders>`;
}

/* Ship notice ------------------------------------------------------------------ */

export type ShipNotice = {
  orderNumber: string;
  carrier: string | null;
  service: string | null;
  trackingNumber: string | null;
  shipDate: Date | null;
};

function tag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))\\s*</${name}>`, "i"));
  const value = (match?.[1] ?? match?.[2] ?? "").trim();
  return value || null;
}

/**
 * The notice from the query string, with the XML body filling gaps. Only the
 * top-level fields are read: the order is shipped as a whole (see
 * record_external_shipment, migration 038).
 */
export function parseShipNotice(params: URLSearchParams, body: string): ShipNotice | null {
  const orderNumber = params.get("order_number") ?? tag(body, "OrderNumber");
  if (!orderNumber) return null;
  return {
    orderNumber: orderNumber.trim(),
    carrier: params.get("carrier") || tag(body, "Carrier"),
    service: params.get("service") || tag(body, "Service"),
    trackingNumber: params.get("tracking_number") || tag(body, "TrackingNumber"),
    shipDate: parseShipStationDate(tag(body, "ShipDate")),
  };
}

/** A tracking page for the common carriers; null when we cannot build one. */
export function trackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  if (!trackingNumber) return null;
  const code = encodeURIComponent(trackingNumber);
  const name = (carrier ?? "").toLowerCase();
  if (name.includes("ups")) return `https://www.ups.com/track?tracknum=${code}`;
  if (name.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${code}`;
  if (name.includes("usps") || name.includes("stamps")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${code}`;
  return null;
}
