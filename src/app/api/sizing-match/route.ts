import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/backend/email";
import { SITE } from "@/lib/site";
import { recordEvent } from "@/lib/backend/events";

/**
 * "Email my sizing match".
 *
 * Transactional, not marketing: the customer asked for this specific result to
 * be sent to them, so it needs no marketing consent and enrolls them in no
 * newsletter. The sizer result itself is never gated -- results render before
 * this form is offered, so the email is an upgrade on something already given
 * rather than a toll gate. Gating a result the user already earned is what
 * makes capture feel extractive.
 */

type MatchInput = { title: string; btu: number; price: number; href: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, scope, area, ducts, matches } = body as {
      email?: unknown;
      scope?: unknown;
      area?: unknown;
      ducts?: unknown;
      matches?: unknown;
    };

    if (typeof email !== "string" || !/.+@.+\..+/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "A valid email address is required." },
        { status: 400 }
      );
    }
    if (!Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No sizing result to send." },
        { status: 400 }
      );
    }

    const areaLabel =
      typeof area === "number" && Number.isFinite(area) ? `${Math.round(area)} sq ft` : "your space";
    const scopeLabel = typeof scope === "string" ? scope : "one";
    const ductLabel = ducts === true ? "has existing ducts" : "no ducts / not sure";

    const rows = (matches as MatchInput[])
      .slice(0, 3)
      .map((m) => {
        const title = escapeHtml(String(m.title ?? ""));
        const btu = Number(m.btu) || 0;
        const href = `${SITE.origin}${String(m.href ?? "/products")}`;
        return `<li style="margin:0 0 10px"><a href="${escapeHtml(href)}" style="color:#1f4d3d;font-weight:600;text-decoration:none">${title}</a><br><span style="color:#555;font-size:13px">${btu.toLocaleString()} BTU</span></li>`;
      })
      .join("");

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px">
        <h2 style="margin:0 0 6px;font-size:20px">Your sizing match</h2>
        <p style="margin:0 0 16px;color:#555;font-size:14px">
          Based on ${escapeHtml(areaLabel)}, ${escapeHtml(scopeLabel)} zone, ${escapeHtml(ductLabel)}.
        </p>
        <ul style="padding-left:18px;margin:0 0 18px">${rows}</ul>
        <p style="margin:0 0 16px;padding:12px;background:#f5f5f3;border-radius:6px;color:#444;font-size:13px;line-height:1.5">
          <strong>This is a rule-of-thumb estimate, not a load calculation.</strong>
          A licensed installer confirms the final size with a Manual J calculation
          before anything is ordered. Undersizing leaves rooms uncomfortable;
          oversizing short-cycles and hurts both efficiency and humidity control.
        </p>
        <p style="margin:0 0 8px;font-size:14px">
          Questions? Call <a href="${SITE.phoneHref}" style="color:#1f4d3d">${SITE.phone}</a>
          or reply to this email. Free will-call pickup at ${escapeHtml(SITE.address.full)}.
        </p>
        <p style="margin:16px 0 0;color:#888;font-size:12px">
          You received this because you asked us to email your sizing result on ${SITE.origin}.
          It is a one-time message. You are not subscribed to anything.
        </p>
      </div>`;

    await sendEmail(email.trim().toLowerCase(), "Your Summit HVAC sizing match", html);
    await recordEvent("sizing_match_emailed", "/homeowners", {
      area: areaLabel,
      scope: scopeLabel,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not send" },
      { status: 500 }
    );
  }
}
