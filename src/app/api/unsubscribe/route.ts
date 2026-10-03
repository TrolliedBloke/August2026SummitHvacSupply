import { NextResponse } from "next/server";
import { unsubscribeByToken, type UnsubscribeKind } from "@/lib/backend/lifecycle";
import { SITE } from "@/lib/site";

const KINDS: ReadonlySet<UnsubscribeKind> = new Set<UnsubscribeKind>(["stock", "cart", "category", "marketing"]);

const MESSAGES: Record<UnsubscribeKind, string> = {
  stock: "No more emails from this stock alert.",
  cart: "No more emails about this cart.",
  category: "No more emails from this stock alert.",
  marketing: "No more marketing email from Summit. Order and receipt emails still arrive.",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("kind") ?? "";
  const kind = KINDS.has(raw as UnsubscribeKind) ? (raw as UnsubscribeKind) : null;
  const token = url.searchParams.get("token") ?? "";
  const ok = kind !== null && (await unsubscribeByToken(kind, token));
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribed</title>
     <body style="font-family: system-ui; max-width: 480px; margin: 80px auto; padding: 0 16px; text-align: center; color: black;">
       <h1 style="font-size: 22px; font-weight: 500;">${ok ? "You're unsubscribed." : "Link expired or already unsubscribed."}</h1>
       <p style="color: dimgray;">${ok && kind ? MESSAGES[kind] : "No further action is needed."} Questions? Call or text ${SITE.phone}.</p>
     </body>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
