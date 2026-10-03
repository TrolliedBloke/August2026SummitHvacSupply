import { WARRANTY_DISCLOSURE } from "@/lib/brand-policy";
import { MANUAL_J_CAVEAT } from "@/lib/sizing";
import type { FinderResult } from "./recommend";

/**
 * The shortlist email body, built from a result the server computed -- never
 * from anything the browser sent. The old /api/sizing-match endpoint rendered
 * caller-supplied titles and links into mail from Summit's domain; this one
 * cannot, because its only inputs are a stored session and the catalog.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const link = (origin: string, href: string, text: string) =>
  `<a href="${escapeHtml(`${origin}${href}`)}" style="color: black;">${escapeHtml(text)}</a>`;

export function shortlistSubject(result: FinderResult): string {
  return result.path === "homeowner" ? "Your system shortlist and install checklist" : "Your Summit equipment matches";
}

export function shortlistBody(result: FinderResult, origin: string, phone: string): string {
  if (result.path === "contractor") {
    const rows = result.items
      .map(
        (item) =>
          `<li style="margin: 0 0 10px;">${link(origin, item.href, item.title)}<br><span style="color: dimgray; font-size: 13px;">${escapeHtml(item.sku)}${item.btu ? ` · ${item.btu.toLocaleString("en-US")} BTU` : ""}${item.stock.verified ? ` · ${item.stock.quantity} counted in Newark` : " · stock confirmed at the counter"}</span></li>`
      )
      .join("");
    return `<h2 style="font-size: 20px; margin: 8px 0;">${escapeHtml(result.heading)}</h2>
      ${rows ? `<ul style="padding-left: 18px; line-height: 1.5;">${rows}</ul>` : `<p style="line-height: 1.6;">Nothing in the catalog matched every answer. The counter can check what is coming in.</p>`}
      <p style="line-height: 1.6;">Approved trade accounts see account pricing after sign-in. ${link(origin, "/dealers", "Apply for a trade account")}.</p>
      <p style="line-height: 1.6;">Call or text the counter at <strong>${escapeHtml(phone)}</strong> to hold stock for will-call.</p>`;
  }

  const options = result.options
    .map(
      (option) =>
        `<li style="margin: 0 0 12px;"><strong style="font-weight: 500;">${escapeHtml(option.title)}</strong><br><span style="color: dimgray; font-size: 13px;">${escapeHtml(option.ratings)}</span><br>${option.components
          .map((component) => link(origin, component.href, `${component.sku}: ${component.title}`))
          .join("<br>")}</li>`
    )
    .join("");
  const steps = result.installSteps
    .map((step) => `<li style="margin: 0 0 8px;"><strong style="font-weight: 500;">${escapeHtml(step.title)}.</strong> ${escapeHtml(step.body)}${step.href ? ` ${link(origin, step.href, "Read more")}` : ""}</li>`)
    .join("");
  return `<h2 style="font-size: 20px; margin: 8px 0;">Your system shortlist</h2>
    <p style="line-height: 1.6;">${escapeHtml(result.laneLabel)}${result.capacity ? `, starting around ${escapeHtml(result.capacity)}` : ""}.</p>
    ${
      options
        ? `<ul style="padding-left: 18px; line-height: 1.5;">${options}</ul>`
        : `<p style="line-height: 1.6;">None of the systems we can verify for a California install fits these answers yet. A licensed installer can size the job and we will source the matched system. ${link(origin, result.browseHref, "Browse the catalog")}.</p>`
    }
    <p style="line-height: 1.6; color: dimgray; font-size: 13px;">${escapeHtml(MANUAL_J_CAVEAT)}</p>
    <h3 style="font-size: 16px; margin: 20px 0 8px;">What your install will involve</h3>
    <ol style="padding-left: 18px; line-height: 1.5;">${steps}</ol>
    <p style="line-height: 1.6;">${link(origin, "/homeowners#homeowner-request", "Get matched with a licensed installer")}, or call or text <strong>${escapeHtml(phone)}</strong>.</p>
    <p style="line-height: 1.6; color: dimgray; font-size: 13px;">${escapeHtml(WARRANTY_DISCLOSURE)}</p>`;
}
