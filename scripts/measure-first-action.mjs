/**
 * First-action distance (UX fix plan WS-0 / WS-7 metric).
 *
 * For each route and viewport: the header height, and how far down the page
 * (in CSS px from the top of the document) the first meaningful control sits
 * -- the first form field, or the route's own primary control. Smaller is
 * better; anything below the first viewport means the buyer scrolls before
 * they can act. Run against a running server:
 *
 *   BASE_URL=http://localhost:3007 node scripts/measure-first-action.mjs
 */
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const viewports = { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const routes = [
  ["/quote", "main form input, main form select, main form textarea"],
  ["/contact", "main form input, main form select, main form textarea, main form [role=combobox]"],
  ["/dealers", "main form input, main form select, main form button"],
  ["/finder", "[data-finder-phase] button"],
  ["/portal/login", "main form input"],
  ["/products", "main input[type=search]"],
  ["/this-page-does-not-exist", "main a, main button"],
];

const browser = await chromium.launch();
const rows = [];
for (const [name, viewport] of Object.entries(viewports)) {
  const page = await browser.newPage({ viewport });
  for (const [route, selector] of routes) {
    await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(400);
    const result = await page.evaluate((sel) => {
      const header = document.querySelector("header");
      const target = [...document.querySelectorAll(sel)].find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return {
        header: header ? Math.round(header.getBoundingClientRect().height) : null,
        firstAction: target ? Math.round(target.getBoundingClientRect().top + window.scrollY) : null,
        shell: document.querySelector("[data-shell-variant]")?.getAttribute("data-shell-variant") ?? null,
      };
    }, selector);
    rows.push({ viewport: name, route, ...result, aboveFold: result.firstAction !== null && result.firstAction < viewport.height });
  }
  await page.close();
}
await browser.close();
console.table(rows);
