/**
 * Support email in, delivery outcomes back (docs/PIPELINE-ARCHITECTURE-PLAN.md, F3).
 *
 * Pure helpers for the Resend webhook: who sent it, whether a person sent it
 * at all (auto-replies and bounces must not open tickets, or two auto-
 * responders would ping-pong through the inbox), which desk it belongs to, and
 * the readable part of the message. Plus how provider delivery events update
 * the email log without a late "delivered" overwriting a "bounced".
 */

export type Sender = { name: string | null; email: string };

/** "Jane Doe <jane@example.com>" or "jane@example.com". */
export function parseSender(from: string): Sender | null {
  const angle = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (angle ? angle[2] : from).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const name = angle?.[1]?.trim() || null;
  return { name, email };
}

const AUTOMATED_LOCAL_PARTS = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?|notifications?)([+.-].*)?$/i;

/**
 * True for mail no person is waiting on: delivery failures, out-of-office and
 * list mail (RFC 3834 Auto-Submitted, Precedence), no-reply senders, and our
 * own domain mailing itself.
 */
export function isAutomated(sender: Sender, headers: Record<string, string> | null, ownDomains: string[]): boolean {
  const lower = Object.fromEntries(Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), String(value).toLowerCase()]));
  if (lower["auto-submitted"] && lower["auto-submitted"] !== "no") return true;
  if (["bulk", "junk", "list", "auto_reply"].includes(lower["precedence"] ?? "")) return true;
  if (lower["x-autoreply"] || lower["x-autorespond"] || lower["list-unsubscribe"]) return true;
  const [local, domain] = sender.email.split("@");
  if (AUTOMATED_LOCAL_PARTS.test(local)) return true;
  return ownDomains.some((own) => domain === own || domain.endsWith(`.${own}`));
}

export type InboundRouting = { topic: "order" | "returns" | "quote" | "other"; queue: "orders" | "support" | "sales"; orderRef: string | null };

/** The same desks as the contact form (src/lib/contact-topics.ts). */
export function routeInbound(subject: string, body: string): InboundRouting {
  const text = `${subject}\n${body}`;
  const orderRef = text.match(/\bSO-[A-Z0-9][A-Z0-9-]{3,}\b/i)?.[0].toUpperCase() ?? null;
  if (/\b(return|refund|warranty|damaged|broken|rma)\b/i.test(text)) return { topic: "returns", queue: "support", orderRef };
  if (orderRef || /\b(order|tracking|shipped|delivery|pick ?up)\b/i.test(text)) return { topic: "order", queue: "orders", orderRef };
  if (/\b(quote|price|pricing|estimate)\b/i.test(text)) return { topic: "quote", queue: "sales", orderRef };
  return { topic: "other", queue: "support", orderRef };
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c", bull: "\u2022", copy: "\u00a9", reg: "\u00ae", trade: "\u2122", deg: "\u00b0",
};

function decodeEntity(match: string, body: string): string {
  if (body[0] === "#") {
    const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  }
  return NAMED_ENTITIES[body.toLowerCase()] ?? match;
}

/** Plain text from an HTML body, when the message has no text part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, decodeEntity)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The new part of a reply: everything above "On ... wrote:" or a forwarded header. */
export function stripQuotedReply(text: string): string {
  // Gmail wraps a long "On <date> <name> <address> wrote:" line, so the
  // header may span two lines.
  const cut = text.search(/^(On [^\n]{0,200}(?:\n[^\n]{0,200})?wrote:|-{2,}\s*Original Message\s*-{2,}|From: .+\nSent: )/im);
  const fresh = (cut > 0 ? text.slice(0, cut) : text)
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .trim();
  return fresh || text.trim();
}

export const MAX_INBOUND_MESSAGE = 5000;

/* Delivery outcomes -------------------------------------------------------------- */

const DELIVERY_RANK: Record<string, number> = {
  delivery_delayed: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  // Bad outcomes outrank everything: a bounce is the fact staff need.
  failed: 9,
  suppressed: 9,
  bounced: 10,
  complained: 10,
};

/** "email.delivered" -> "delivered"; null for events that are not delivery outcomes. */
export function deliveryStatusFor(eventType: string): string | null {
  const status = eventType.startsWith("email.") ? eventType.slice(6) : "";
  return status in DELIVERY_RANK ? status : null;
}

/** Whether an incoming outcome should replace the stored one. */
export function shouldReplaceDelivery(current: string | null, incoming: string): boolean {
  return (DELIVERY_RANK[incoming] ?? 0) >= (current ? (DELIVERY_RANK[current] ?? 0) : 0);
}
