import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
const out = path.resolve(process.env.SCREENSHOT_DIR || "./screenshots/site-audit");
const catalog = JSON.parse(await fs.readFile(path.resolve("src/data/catalog.generated.json"), "utf8"));

const staticRoutes = [
  "/", "/about", "/brands", "/products", "/finder", "/homeowners", "/dealers", "/contact",
  "/quote", "/checkout", "/checkout/confirmation", "/checkout/receipt", "/resources", "/delivery",
  "/shipping", "/returns", "/review", "/locations/newark", "/account", "/account/create",
  "/account/check-email", "/portal", "/portal/login", "/portal/forgot-password", "/portal/reset-password",
  "/portal/homeowner", "/portal/installer", "/portal/dealer", "/portal/status", "/portal/returns/new",
  "/privacy", "/privacy/opt-out", "/terms", "/admin", "/admin/catalog", "/admin/dealers",
  "/admin/fulfillment", "/admin/referrals", "/admin/audiences", "/bay-area-hvac-supply",
  "/newark-hvac-will-call-contractors", "/this-page-does-not-exist",
  "/legal/privacy/2.0", "/legal/terms/2.0", "/legal/returns/1.0", "/legal/shipping/2.0",
];

const localRoutes = [
  "bay-area-mini-split-supply", "bay-area-heat-pump-installer-help", "buy-one-mini-split-bay-area",
  "bay-area-heat-pump-rebates", "newark-hvac-will-call-contractors", "tcl-mini-split-systems",
  "tcl-ducted-heat-pumps", "r-32-mini-split-systems", "contractor-hvac-supply-newark",
  "heat-pump-equipment-property-managers",
].map((slug) => `/${slug}`);

const guideRoutes = [
  "baaqmd-rules-9-4-9-6", "bay-area-hvac-permits", "bay-area-heat-pump-rebates-by-zip",
  "r-32-r-454b-a2l-transition", "california-title-24-hvac-changeouts",
].map((slug) => `/guides/${slug}`);

const toolRoutes = [
  "model-number-decoder", "rebate-lookup", "ahri-match-finder", "system-sizing-estimator",
  "operating-cost-comparison",
].map((slug) => `/tools/${slug}`);

const productRoutes = catalog.map((p) => `/products/sku/${p.slug}`);
const routes = [...new Set([...staticRoutes, ...localRoutes, ...guideRoutes, ...toolRoutes, ...productRoutes])];

await fs.mkdir(out, { recursive: true });
const manifest = { base, generatedAt: new Date().toISOString(), routes: [], states: [] };

function safe(s) { return s.replace(/^\//, "home/").replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "home"; }
function family(route) {
  if (route === "/" || route === "/about" || route.startsWith("/bay-area") || route.startsWith("/newark-")) return "01-public";
  if (route.startsWith("/products")) return "02-catalog";
  if (route.startsWith("/guides") || route.startsWith("/tools") || route === "/resources") return "03-resources";
  if (["/finder", "/homeowners", "/dealers", "/contact", "/quote", "/review"].includes(route)) return "04-lead-flows";
  if (route.startsWith("/checkout")) return "05-checkout";
  if (route.startsWith("/portal") || route.startsWith("/account")) return "06-account-portal";
  if (route.startsWith("/admin")) return "07-admin";
  if (route.startsWith("/legal") || ["/privacy", "/terms", "/returns", "/shipping", "/delivery"].includes(route)) return "08-policy";
  return "09-other";
}

async function settle(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  // Product frames report data-media-state="loading" until their image has
  // decoded. A full-page capture does not scroll, so lazy images below the
  // fold would never start: walk the page once first.
  await page
    .evaluate(async () => {
      // An open menu or dialog is the state being captured; scrolling could close it.
      if (document.querySelector('[aria-expanded="true"], [role="dialog"]')) return;
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      window.scrollTo(0, 0);
    })
    .catch(() => {});
  // decode() on a lazy image that never started loading never settles -- this
  // is what hung the full run on its first route. Bounded per page.
  await page
    .locator("img")
    .evaluateAll(async (images) => {
      const decoded = Promise.all(images.map((image) => (image.complete ? Promise.resolve() : image.decode().catch(() => {}))));
      await Promise.race([decoded, new Promise((resolve) => setTimeout(resolve, 8000))]);
    })
    .catch(() => {});
  // Only frames within the page's width count: a card scrolled off to the side
  // of a horizontal rail is not in the capture and never starts loading.
  await page
    .waitForFunction(
      () =>
        ![...document.querySelectorAll('[data-media-state="loading"]')].some((frame) => {
          const rect = frame.getBoundingClientRect();
          return rect.right > 0 && rect.left < window.innerWidth;
        }),
      null,
      { timeout: 15000 }
    )
    .catch(() => {});
  await page.waitForTimeout(150);
}

/** What the DOM shows, recorded next to the file so the manifest cannot claim a state the capture lacks. */
async function visibleState(page) {
  return page
    .evaluate(() => {
      const media = {};
      for (const frame of document.querySelectorAll("[data-media-state]")) {
        const rect = frame.getBoundingClientRect();
        // Hidden at this viewport, or off to the side of a horizontal rail: not in the capture.
        const state = rect.width === 0 ? "hidden" : rect.right > 0 && rect.left < window.innerWidth ? frame.dataset.mediaState : "offscreen";
        media[state] = (media[state] ?? 0) + 1;
      }
      const commerce = {};
      for (const node of document.querySelectorAll("[data-commerce-state]")) commerce[node.dataset.commerceState] = (commerce[node.dataset.commerceState] ?? 0) + 1;
      return {
        heading: document.querySelector("h1")?.textContent?.trim() ?? null,
        shellVariant: document.querySelector("[data-shell-variant]")?.getAttribute("data-shell-variant") ?? null,
        media,
        commerce,
        skeletons: document.querySelectorAll('[aria-busy="true"]').length,
      };
    })
    .catch(() => null);
}

async function shot(page, rel, metadata = {}) {
  const file = path.join(out, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const dom = await visibleState(page);
  await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
  // Not "ready" while a frame is still loading or a skeleton is up; the review
  // index can filter on this instead of trusting the file name.
  const ready = Boolean(dom) && !dom.media.loading && dom.skeletons === 0;
  manifest.states.push({ file: path.relative(out, file), url: page.url(), ...metadata, dom, ready });
}
async function routeShot(page, route, viewportName) {
  console.log(`${viewportName} ${route}`);
  const response = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
  await settle(page);
  const rel = path.join(family(route), viewportName, `${safe(route)}.png`);
  await shot(page, rel, { type: "route", route, viewport: viewportName, status: response?.status() ?? null });
  manifest.routes.push({ route, viewport: viewportName, file: rel, status: response?.status() ?? null, title: await page.title().catch(() => "") });
}

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
for (const route of routes) await routeShot(desktop, route, "desktop");

// Shared desktop interactive surfaces.
await desktop.goto(base + "/", { waitUntil: "domcontentloaded" }); await settle(desktop);
const search = desktop.getByRole("searchbox").first();
if (await search.count()) { await search.fill("TCL"); await desktop.waitForTimeout(300); await shot(desktop, "10-interactions/desktop/search-results.png", { type: "interaction", state: "search results" }); }
const accountButton = desktop.getByRole("button", { name: /account|sign in|menu/i }).first();
if (await accountButton.count()) { await accountButton.click().catch(() => {}); await settle(desktop); await shot(desktop, "10-interactions/desktop/account-menu.png", { type: "interaction", state: "account menu" }); }

await desktop.goto(base + "/products", { waitUntil: "domcontentloaded" }); await settle(desktop);
const filterButton = desktop.getByRole("button", { name: /filter/i }).first();
if (await filterButton.count()) { await filterButton.click(); await settle(desktop); await shot(desktop, "10-interactions/desktop/product-filters.png", { type: "interaction", state: "catalog filter sheet" }); }

await desktop.goto(base + "/finder", { waitUntil: "domcontentloaded" }); await settle(desktop);
const finderFork = desktop.locator('[data-finder-phase="fork"][data-screenshot-ready="true"]');
if (await finderFork.count()) {
  await shot(desktop, "10-interactions/desktop/finder-step-1.png", { type: "interaction", state: "finder audience choice", marker: "fork" });
  await finderFork.getByRole("button", { name: /my home/i }).click();
  await desktop.locator('[data-finder-question="goal"][data-screenshot-ready="true"]').waitFor();
  for (let step = 2; step <= 4; step += 1) {
    const current = desktop.locator('[data-finder-phase="question"][data-screenshot-ready="true"]');
    const question = await current.getAttribute("data-finder-question");
    await shot(desktop, `10-interactions/desktop/finder-step-${step}.png`, {
      type: "interaction",
      state: `finder question ${step - 1}`,
      marker: question,
    });
    if (step === 4) break;
    const firstChoice = current.locator('input[type="radio"]').first();
    if (!(await firstChoice.count())) break;
    await firstChoice.check();
    await current.getByRole("button", { name: /^next$/i }).click();
    await desktop.locator(`[data-finder-step="${step}"][data-screenshot-ready="true"]`).waitFor();
  }
}

await desktop.goto(base + "/", { waitUntil: "domcontentloaded" }); await settle(desktop);
const chat = desktop.getByRole("button", { name: /chat|help/i }).first();
if (await chat.count()) { await chat.click().catch(() => {}); await settle(desktop); await shot(desktop, "10-interactions/desktop/chat-open.png", { type: "interaction", state: "chat widget open" }); }

// Responsive coverage for representative pages and mobile nav/category subview.
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
for (const route of ["/", "/products", "/products/sku/" + catalog[0].slug, "/finder", "/quote", "/contact", "/homeowners", "/dealers", "/portal/login", "/resources"]) await routeShot(mobile, route, "mobile");
await mobile.goto(base + "/", { waitUntil: "domcontentloaded" }); await settle(mobile);
const menu = mobile.getByRole("button", { name: /open menu/i });
if (await menu.count()) {
  await menu.click(); await settle(mobile); await shot(mobile, "10-interactions/mobile/menu-main.png", { type: "interaction", state: "mobile menu main" });
  const shop = mobile.getByRole("button", { name: /shop by category/i });
  if (await shop.count()) { await shop.click(); await settle(mobile); await shot(mobile, "10-interactions/mobile/menu-categories.png", { type: "interaction", state: "mobile menu categories" }); }
}

await browser.close();
await fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
const notReady = manifest.states.filter((state) => !state.ready).map((state) => state.file);
console.log(JSON.stringify({ routes: manifest.routes.length, states: manifest.states.length, notReady, out }, null, 2));
