import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/backend/lifecycle";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const token = url.searchParams.get("token") ?? "";
  const ok =
    (kind === "stock" || kind === "cart") && (await unsubscribeByToken(kind, token));
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Unsubscribed</title>
     <body style="font-family: system-ui; max-width: 480px; margin: 80px auto; text-align: center; color: black;">
       <h1 style="font-size: 22px;">${ok ? "You're unsubscribed." : "Link expired or already unsubscribed."}</h1>
       <p style="color: dimgray;">No more emails from this flow. Questions? Call or text (415) 988-4445.</p>
     </body>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
