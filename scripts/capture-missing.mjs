import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
const base = "http://127.0.0.1:3000";
const out = path.resolve("./screenshots/site-audit/08-policy/desktop");
await fs.mkdir(out, { recursive: true });
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
for (const route of ["/legal/privacy/1.0", "/legal/privacy/1.1", "/legal/terms/1.0", "/legal/terms/1.1", "/legal/returns/1.1", "/legal/shipping/1.0", "/legal/shipping/1.1"]) {
  await p.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(400);
  const name = route.split("/").slice(1).join("-") + ".png";
  await p.screenshot({ path: path.join(out, name), fullPage: true, animations: "disabled" });
  console.log(route, await p.title());
}
await p.goto(base + "/products/sku/tos60khpu", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await p.waitForTimeout(500);
await p.screenshot({ path: path.resolve("./screenshots/site-audit/02-catalog/desktop/home-products-sku-tos60khpu.png"), fullPage: true, animations: "disabled" });
await b.close();
