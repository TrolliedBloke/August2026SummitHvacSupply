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
  { name: "24-checkout", path: "/checkout" },
  { name: "25-confirmation", path: "/checkout/confirmation" },
  { name: "26-review", path: "/review" },
  { name: "27-returns", path: "/returns" },
  { name: "28-shipping", path: "/shipping" },
  { name: "29-privacy", path: "/privacy" },
  { name: "30-terms", path: "/terms" },
  { name: "31-not-found", path: "/no-such-page" },
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
    name: "f06-price-audience-contractor",
    path: "/",
    run: async (page) => {
      // .first(): the dev server leaves a hidden streaming copy of the page in
      // the DOM, so every control appears twice. Production serves one (checked
      // against a real build), which is why this is a selector note, not a bug.
      await page.getByRole("radio", { name: /Shop as contractor/i }).first().check({ force: true });
      await page.waitForTimeout(200);
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
      await page.getByRole("button", { name: /Open large product image/i }).click();
      await page.waitForTimeout(400);
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
      await page.getByRole("button", { name: /Prepare request/i }).first().click();
      await page.waitForTimeout(500);
    },
  },
];

const VIEWPORTS = [
  { key: "desktop", width: 1440, height: 900 },
  { key: "mobile", width: 390, height: 844 },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const shots: Array<{ name: string; desktop?: string; mobile?: string; note?: string }> = [];

  for (const entry of PAGES) {
    const row: { name: string; desktop?: string; mobile?: string; note?: string } = { name: entry.name };
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      try {
        await page.goto(BASE + entry.path, { waitUntil: "networkidle", timeout: 30_000 });
        await page.waitForTimeout(500);
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
      await page.goto(BASE + feature.path, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForTimeout(400);
      await feature.run(page);
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
