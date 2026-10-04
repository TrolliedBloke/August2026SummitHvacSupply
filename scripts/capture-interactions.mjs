import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const base = "http://127.0.0.1:3000";
const out = path.resolve("./screenshots/site-audit/10-interactions");
await fs.mkdir(out, { recursive: true });
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
async function cap(name) { await p.screenshot({ path: path.join(out, name), fullPage: true, animations: "disabled" }); }
async function go(route) { await p.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {}); await p.waitForTimeout(450); }

await go("/");
const search = p.locator('input[placeholder*="Search"]').first();
if (await search.count()) { await search.fill("TCL"); await p.waitForTimeout(500); await cap("desktop/search-results.png"); }
const allProducts = p.getByRole("button", { name: "All products", exact: true });
if (await allProducts.count()) { await allProducts.click(); await p.waitForTimeout(250); await cap("desktop/all-products-menu.png"); }
await go("/");
for (const [label, file] of [["Quick order", "desktop/quick-order-dropdown.png"], ["Upload CSV", "desktop/upload-csv-dropdown.png"]]) {
  const btn = p.getByRole("button", { name: label, exact: true });
  if (await btn.count()) { await btn.click(); await p.waitForTimeout(250); await cap(file); await p.keyboard.press("Escape"); }
}

await go("/products");
const mobileButton = p.getByRole("button", { name: /filter/i }).first();
if (await mobileButton.count()) { await mobileButton.click(); await p.waitForTimeout(250); await cap("desktop/catalog-filters.png"); }
await go("/products/sku/tos60khpu");
const gallery = p.locator('button[aria-label*="image"], button[aria-label*="photo"], button[aria-label*="view"]').first();
if (await gallery.count()) { await gallery.click().catch(() => {}); await p.waitForTimeout(200); await cap("desktop/product-gallery-state.png"); }
const add = p.getByRole("button", { name: /add|quote|availability/i }).first();
if (await add.count()) { await add.click().catch(() => {}); await p.waitForTimeout(400); await cap("desktop/product-action-state.png"); }

const m = await b.newPage({ viewport: { width: 390, height: 844 } });
async function mgo(route) { await m.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {}); await m.waitForTimeout(450); }
await mgo("/products");
const mf = m.getByRole("button", { name: /filter/i }).first();
if (await mf.count()) { await mf.click(); await m.waitForTimeout(250); await m.screenshot({ path: path.join(out, "mobile/catalog-filters.png"), fullPage: true, animations: "disabled" }); }
await b.close();
console.log("supplemental complete");
