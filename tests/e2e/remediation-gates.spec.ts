import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

/** Every numbered route in DESIGN-REMEDIATION-PLAN.md. Keep this list aligned
 * with scripts/design-screens.ts so a page cannot disappear from the release
 * gate merely because it is awkward to reach without account data. */
const PUBLIC_ROUTES = [
  "/",
  "/products",
  "/products?category=mini-splits",
  "/products/sku/tcl09kidu",
  "/products/sku/tos-18k-idu",
  "/brands",
  "/resources",
  "/guides/baaqmd-rules-9-4-9-6",
  "/tools/model-number-decoder",
  "/delivery",
  "/locations/newark",
  "/bay-area-hvac-supply",
  "/homeowners",
  "/dealers",
  "/about",
  "/contact",
  "/quote",
  "/account",
  "/account/create",
  "/account/check-email",
  "/portal/login",
  "/portal/forgot-password",
  "/portal/reset-password",
  "/checkout",
  "/checkout/confirmation",
  "/review",
  "/returns",
  "/shipping",
  "/privacy",
  "/terms",
  "/no-such-page",
] as const;

const VIEWPORTS = [
  { name: "narrow", width: 320, height: 800 },
  // A 1440px display at 200% browser zoom exposes roughly 720 CSS pixels and
  // therefore exercises this responsive layout. The exact 768px tablet gate
  // remains separate below.
  { name: "wide desktop at 200% zoom", width: 720, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "small desktop", width: 1024, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
] as const;

async function gotoSettled(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  // Some stateful routes intentionally redirect guests/empty carts after
  // hydration. Let that transition finish before measuring the resulting
  // recovery state so evaluation never races a destroyed document.
  await page.waitForTimeout(200);
  await page.waitForLoadState("domcontentloaded");
}

async function documentWidth(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
    } catch (error) {
      if (!String(error).includes("Execution context was destroyed") || attempt === 2) throw error;
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(100);
    }
  }
  throw new Error("Could not measure the settled document");
}

test("all remediated public routes reflow without page-level horizontal scrolling", async ({ page }) => {
  test.setTimeout(180_000);
  const failures: string[] = [];
  const clientErrors: string[] = [];
  let currentRoute = "before navigation";
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The main-document 404 is the expected input to the custom recovery page,
    // not a broken subresource. Every other browser error remains a failure.
    const expectedNotFound = currentRoute.startsWith("/no-such-page") && message.text().includes("404 (Not Found)");
    if (!expectedNotFound) clientErrors.push(`${currentRoute}: console — ${message.text()}`);
  });
  page.on("pageerror", (error) => clientErrors.push(`${currentRoute}: uncaught — ${error.message}`));
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const route of PUBLIC_ROUTES) {
      currentRoute = `${route} at ${viewport.name}`;
      await gotoSettled(page, route);
      const width = await documentWidth(page);
      if (width.scroll > width.client) failures.push(`${route} at ${viewport.name}: ${width.scroll}px > ${width.client}px`);
    }
  }
  expect(failures, failures.join("\n")).toEqual([]);
  expect(clientErrors, clientErrors.join("\n")).toEqual([]);
});

async function axeViolations(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.addScriptTag({ content: axe.source });
      return await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        });
        return result.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          targets: violation.nodes.map((node) => node.target.join(" ")),
        }));
      });
    } catch (error) {
      if (!String(error).includes("Execution context was destroyed") || attempt === 2) throw error;
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(100);
    }
  }
  return [];
}

declare global {
  interface Window {
    axe: typeof axe;
  }
}

test("all remediated routes have no automated WCAG A/AA violations", async ({ page }) => {
  test.setTimeout(240_000);
  const failures: string[] = [];
  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of PUBLIC_ROUTES) {
      await gotoSettled(page, route);
      const violations = await axeViolations(page);
      for (const violation of violations) {
        failures.push(`${route} at ${viewport.name}: ${violation.id} (${violation.impact ?? "unknown"}) ${violation.help} — ${violation.targets.join(", ")}`);
      }
    }
  }
  expect(failures, failures.join("\n")).toEqual([]);
});

test("mobile dialogs keep focus inside and restore it on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const opener = page.getByRole("button", { name: "Open menu" });
  await opener.focus();
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(":focus")).toHaveAttribute("aria-label", "Close menu");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("draft catalog filters cancel without mutating the URL and apply once", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  const filters = page.getByRole("button", { name: /^Filters/ });
  await filters.click();
  await page.getByRole("button", { name: "Mini splits" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/products$/);

  await filters.click();
  await page.getByRole("button", { name: "Mini splits" }).click();
  await page.getByRole("button", { name: /Show \d+ results?/ }).click();
  await expect(page).toHaveURL(/category=mini-splits/);
  await page.goBack();
  await expect(page).toHaveURL(/\/products$/);
});
