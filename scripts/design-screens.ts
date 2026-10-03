/**
 * Screenshots every page and every interactive state, for review in one pass.
 *
 * Usage: npx tsx scripts/design-screens.ts
 * Output: design/screens/<name>-desktop.png, -mobile.png, plus index.html
 *
 * Full-page shots, so a long page is captured end to end rather than cropped
 * at the fold. Interactive states are opened by clicking the real control; a
 * state that cannot be reached is reported and skipped rather than failing the
 * run, because the signed-in pages redirect to login without a session.
 */
import { chromium, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const BASE = process.env.DESIGN_URL ?? "http://localhost:3007";
const OUT = "design/screens";

const PAGES: Array<{ name: string; path: string }> = [
  { name: "01-home", path: "/" },
  { name: "02-catalog", path: "/products" },
  { name: "03-catalog-filtered", path: "/products?category=mini-splits" },
  { name: "04-product-priced", path: "/products/sku/tcl09kidu" },
  { name: "05-product-media", path: "/products/sku/tos-18k-idu" },
  { name: "06-brands", path: "/brands" },
  { name: "07-resources", path: "/resources" },
  { name: "08-guide", path: "/guides/baaqmd-rules-9-4-9-6" },
  { name: "09-tool-decoder", path: "/tools/model-number-decoder" },
  { name: "10-delivery", path: "/delivery" },
  { name: "11-locations-newark", path: "/locations/newark" },
  { name: "12-local-landing", path: "/bay-area-hvac-supply" },
  { name: "13-homeowners", path: "/homeowners" },
  { name: "14-dealers", path: "/dealers" },
  { name: "15-about", path: "/about" },
  { name: "16-contact", path: "/contact" },
  { name: "17-quote", path: "/quote" },
  { name: "18-account", path: "/account" },
  { name: "19-account-create", path: "/account/create" },
  { name: "20-account-check-email", path: "/account/check-email" },
  { name: "21-portal-login", path: "/portal/login" },
  { name: "22-portal-forgot", path: "/portal/forgot-password" },
  { name: "23-portal-reset", path: "/portal/reset-password" },
  { name: "24-checkout", path: "/checkout?design=1" },
  { name: "25-confirmation", path: "/checkout/confirmation?token=design-paid" },
  { name: "26-write-product-review", path: "/review" },
  { name: "27-returns", path: "/returns" },
  { name: "28-shipping", path: "/shipping" },
  { name: "29-privacy", path: "/privacy" },
  { name: "30-terms", path: "/terms" },
  { name: "31-not-found", path: "/no-such-page" },
  { name: "32-finder", path: "/finder" },
  { name: "33-privacy-opt-out", path: "/privacy/opt-out" },
];

type Feature = { name: string; path: string; mobile?: boolean; run: (page: Page) => Promise<void> };

const FEATURES: Feature[] = [
  {
    name: "f01-all-products-menu",
    path: "/",
    run: async (page) => {
      await page.getByRole("button", { name: /All products/i }).click();
      await page.waitForTimeout(300);
    },
  },
  {
    name: "f02-account-menu",
    path: "/",
    run: async (page) => {
      await page.getByRole("button", { name: /Sign in|Account/i }).first().click();
      await page.waitForTimeout(300);
    },
  },
  {
    name: "f03-search-suggestions",
    path: "/",
    run: async (page) => {
      await page.locator("header input[role=combobox]").first().fill("mini");
      await page.waitForTimeout(900);
    },
  },
  {
    name: "f04-quick-order",
    path: "/",
    run: async (page) => {
      await page.getByRole("button", { name: "Quick order" }).click();
      await page.waitForTimeout(300);
    },
  },
  {
    name: "f05-csv-upload",
    path: "/",
    run: async (page) => {
      await page.getByRole("button", { name: "Upload CSV" }).click();
      await page.waitForTimeout(300);
    },
  },
  {
    name: "f06-contractor-sign-in-path",
    path: "/",
    run: async (page) => {
      await page.getByRole("link", { name: "Contractor sign in" }).click();
      await page.waitForURL(/\/portal\/login/);
    },
  },
  {
    name: "f07-cart-drawer",
    path: "/products/sku/tcl09kidu",
    run: async (page) => {
      await page.getByRole("button", { name: /Check availability|Add to cart/i }).first().click();
      await page.waitForTimeout(700);
    },
  },
  {
    name: "f08-gallery-second-view",
    path: "/products/sku/tos-18k-idu",
    run: async (page) => {
      await page.getByRole("button", { name: "Next view" }).click();
      await page.waitForTimeout(300);
    },
  },
  {
    name: "f09-gallery-zoom",
    path: "/products/sku/tos-18k-idu",
    run: async (page) => {
      await page.getByRole("button", { name: "View larger" }).click();
      await page.getByRole("dialog").waitFor({ state: "visible" });
      await page.locator('[role="dialog"] img').waitFor({ state: "visible" });
    },
  },
  {
    name: "f10-catalog-filters-mobile",
    path: "/products",
    mobile: true,
    run: async (page) => {
      await page.getByRole("button", { name: /Filters/i }).first().click();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "f11-mobile-menu",
    path: "/",
    mobile: true,
    run: async (page) => {
      await page.getByRole("button", { name: /Open menu/i }).click();
      await page.waitForTimeout(300);
    },
  },
  {
    name: "f12-contact-form-errors",
    path: "/contact",
    run: async (page) => {
      await page.getByRole("button", { name: "Send message" }).click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "f13-confirmation-pending",
    path: "/checkout/confirmation?token=design-pending",
    run: async (page) => { await page.getByText("Payment pending").waitFor(); },
  },
  {
    name: "f14-confirmation-failed",
    path: "/checkout/confirmation?token=design-failed",
    run: async (page) => { await page.getByText("Payment not completed").waitFor(); },
  },
];

const VIEWPORTS = [
  { key: "desktop", width: 1440, height: 900 },
  { key: "mobile", width: 390, height: 844 },
];

const checkoutLine = {
  skuId: "inventory-row-2", sku: "TCL09KIDU", title: "TCL 9K Indoor Unit", qty: 2,
  state: "purchasable", unitPrice: 489, lineTotal: 978, provenance: "List price", error: null,
};
const confirmationLine = { title: checkoutLine.title, sku: checkoutLine.sku, qty: 2, unitPrice: 489, lineTotal: 978, status: "pending" };

async function prepareDeterministicState(page: Page, path: string) {
  if (path.startsWith("/checkout?")) {
    await page.addInitScript((line) => localStorage.setItem("summit-quote-v2", JSON.stringify([{
      skuId: line.skuId, sku: line.sku, modelNumber: "TSC-09HA1/I3TI22", title: line.title,
      image: "/products/catalog-official/tcl-tpro-indoor-front.webp", unitPrice: line.unitPrice,
      available: 8, qty: line.qty, intent: "cart",
    }])), checkoutLine);
    await page.route("**/api/checkout/preflight", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      ok: true,
      snapshot: {
        version: 1, issuedAt: "2026-10-01T16:00:00.000Z", expiresAt: "2026-10-01T16:30:00.000Z",
        account: { kind: "guest", label: null }, zip: null, method: "pickup", methodAvailable: true,
        methods: [
          { method: "pickup", label: "Will-call pickup", available: true, fee: 0, detail: "Pick up at our Newark counter after confirmation.", windows: [] },
          { method: "local_delivery", label: "Local delivery", available: true, fee: 79, detail: "Bay Area jobsite delivery.", windows: [] },
          { method: "freight", label: "Freight", available: true, fee: null, detail: "Quoted before shipment.", windows: [] },
        ],
        lines: [checkoutLine], subtotal: 978, fee: 0, tax: { status: "estimated", amount: 89.87 }, total: 1067.87,
        payment: "card", digest: "design-review", token: "design-snapshot",
      },
    }) }));
  }
  if (path.startsWith("/checkout/confirmation")) {
    const token = new URL(path, "http://design.local").searchParams.get("token") ?? "";
    const checkoutState = token.includes("failed") ? "payment_failed" : token.includes("pending") ? "payment_pending" : "paid";
    await page.route("**/api/checkout/status?*", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      ok: true, orderId: "design-order", orderNumber: "SH-10482", subtotal: 978, fee: 0, tax: 89.87, total: 1067.87,
      payment: "card", checkoutState,
      confirmation: checkoutState === "paid" ? {
        orderNumber: "SH-10482", placedAt: "2026-10-01T16:00:00.000Z", payment: "paid", order: "confirmed",
        fulfillment: "pending", email: "sent", method: "pickup", windowLabel: "Fri, Oct 2, 9:00 AM PT", address: null,
        contact: { name: "Alex Rivera", email: "a•••@example.com" }, lines: [confirmationLine],
        totals: { subtotal: 978, fee: 0, tax: 89.87, total: 1067.87 },
      } : null,
    }) }));
  }
}

async function prepareCapture(page: Page) {
  // The Next.js development badge is not part of the product and can cover
  // controls in full-page captures. Runtime errors are still collected by the
  // runner; this removes only the floating development chrome.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(300);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const shots: Array<{ name: string; desktop?: string; mobile?: string; note?: string }> = [];

  for (const entry of PAGES) {
    const row: { name: string; desktop?: string; mobile?: string; note?: string } = { name: entry.name };
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      try {
        await prepareDeterministicState(page, entry.path);
        await page.goto(BASE + entry.path, { waitUntil: "networkidle", timeout: 30_000 });
        await prepareCapture(page);
        const file = `${entry.name}-${vp.key}.png`;
        await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
        row[vp.key as "desktop" | "mobile"] = file;
        if (new URL(page.url()).pathname !== entry.path.split("?")[0]) {
          row.note = `redirected to ${new URL(page.url()).pathname}`;
        }
      } catch (error) {
        row.note = `failed: ${(error as Error).message.split("\n")[0]}`;
      }
      await page.close();
    }
    console.log(row.name, row.note ?? "");
    shots.push(row);
  }

  for (const feature of FEATURES) {
    const vp = feature.mobile ? VIEWPORTS[1] : VIEWPORTS[0];
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const row: { name: string; desktop?: string; mobile?: string; note?: string } = {
      name: `${feature.name} (${vp.key})`,
    };
    try {
      await prepareDeterministicState(page, feature.path);
      await page.goto(BASE + feature.path, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForTimeout(400);
      await feature.run(page);
      await prepareCapture(page);
      const file = `${feature.name}.png`;
      await page.screenshot({ path: `${OUT}/${file}`, fullPage: false });
      row[vp.key as "desktop" | "mobile"] = file;
    } catch (error) {
      row.note = `could not reach: ${(error as Error).message.split("\n")[0]}`;
    }
    console.log(row.name, row.note ?? "");
    shots.push(row);
    await page.close();
  }

  const html = `<!doctype html><meta charset="utf-8"><title>Summit screens</title>
<style>
 body{font:14px/1.5 -apple-system,system-ui,sans-serif;background:#FAF9F6;color:#111;margin:0;padding:32px}
 h1{font-size:22px;margin:0 0 4px} p.sub{color:#6F6E69;margin:0 0 28px}
 section{margin:0 0 40px;border-top:1px solid #E2E0DA;padding-top:16px}
 h2{font-size:15px;margin:0 0 10px}
 .row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
 figure{margin:0}
 figcaption{color:#6F6E69;font-size:12px;margin-bottom:6px}
 img{border:1px solid #E2E0DA;background:#fff;max-height:560px;width:auto}
 .note{color:#C77D2E;font-size:12px}
</style>
<h1>Summit HVAC Supply — every page and state</h1>
<p class="sub">Desktop 1440 (full page) · mobile 390 (full page) · feature states at their own size. Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")}.</p>
${shots
  .map(
    (shot) => `<section><h2>${shot.name}</h2>${shot.note ? `<p class="note">${shot.note}</p>` : ""}<div class="row">
  ${shot.desktop ? `<figure><figcaption>desktop</figcaption><img src="${shot.desktop}" loading="lazy"></figure>` : ""}
  ${shot.mobile ? `<figure><figcaption>mobile</figcaption><img src="${shot.mobile}" loading="lazy"></figure>` : ""}
</div></section>`
  )
  .join("\n")}`;
  await writeFile(`${OUT}/index.html`, html);
  await browser.close();
  console.log(`\n${shots.length} entries -> ${OUT}/index.html`);
}

main();
