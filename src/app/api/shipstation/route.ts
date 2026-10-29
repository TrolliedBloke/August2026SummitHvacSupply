import { NextResponse } from "next/server";
import { exportOrders, recordShipment, ShipStationUnavailableError } from "@/lib/backend/shipstation";
import { buildOrdersXml, parseShipNotice, parseShipStationDate, shipStationAuthorized } from "@/lib/shipstation/custom-store";

/**
 * ShipStation Custom Store endpoint (docs/PIPELINE-ARCHITECTURE-PLAN.md, F1).
 *
 *   GET  /api/shipstation?action=export&start_date=&end_date=&page=
 *   POST /api/shipstation?action=shipnotify&order_number=&carrier=&service=&tracking_number=
 *
 * Credentials come from SHIPSTATION_STORE_USERNAME / SHIPSTATION_STORE_PASSWORD
 * and are entered in ShipStation's Custom Store settings. Without them the
 * endpoint refuses everything. Responses carry no detail an outsider could use.
 */

export const dynamic = "force-dynamic";

const MAX_NOTICE_BYTES = 64 * 1024;

function authorized(request: Request, params: URLSearchParams): boolean {
  return shipStationAuthorized(request.headers.get("authorization"), params, {
    username: process.env.SHIPSTATION_STORE_USERNAME,
    password: process.env.SHIPSTATION_STORE_PASSWORD,
  });
}

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="ShipStation"' } });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (!authorized(request, params)) return unauthorized();
  if (params.get("action") !== "export") return new NextResponse("Unknown action", { status: 400 });
  try {
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const { orders, pages } = await exportOrders(parseShipStationDate(params.get("start_date")), parseShipStationDate(params.get("end_date")), page);
    return new NextResponse(buildOrdersXml(orders, pages), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[shipstation export]", error instanceof Error ? error.message : error);
    return new NextResponse("Export unavailable", { status: error instanceof ShipStationUnavailableError ? 503 : 500 });
  }
}

export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  if (!authorized(request, params)) return unauthorized();
  if (params.get("action") !== "shipnotify") return new NextResponse("Unknown action", { status: 400 });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_NOTICE_BYTES) return new NextResponse("Notice too large", { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > MAX_NOTICE_BYTES) return new NextResponse("Notice too large", { status: 413 });
  const notice = parseShipNotice(params, body);
  if (!notice) return new NextResponse("Missing order number", { status: 400 });
  try {
    const result = await recordShipment(notice);
    if (result.status === "not_found") return new NextResponse("Order not found", { status: 404 });
    // 200 either way: the shipment is recorded. A held order is for staff, and
    // a non-2xx here would only make ShipStation retry the same notice.
    const message = result.status === "duplicate" ? "Already recorded" : result.status === "needs_review" ? "Recorded; order held for review" : "OK";
    return new NextResponse(message, { status: 200 });
  } catch (error) {
    console.error("[shipstation shipnotify]", error instanceof Error ? error.message : error);
    return new NextResponse("Could not record shipment", { status: error instanceof ShipStationUnavailableError ? 503 : 500 });
  }
}
