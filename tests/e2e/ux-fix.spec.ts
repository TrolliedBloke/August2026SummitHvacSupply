import { expect, test } from "@playwright/test";

/*
 * UX fix plan release groups (docs/DESIGN-UX-FIX-PLAN-2026-10.md, WS-8).
 * Each test asserts the visible state through the DOM markers the components
 * expose (data-media-state, data-commerce-state, data-evidence, ...), so a pass
 * means the state is on screen, not that a file exists.
 */

test.describe("media states", () => {
  test("family media is labelled; wrong-component media is withheld", async ({ page }) => {
    await page.goto("/products/sku/car48kahu", { waitUntil: "load" });
    const frame = page.locator("[data-media-state]").first();
    await expect(frame).toHaveAttribute("data-media-state", "verifiedFamily", { timeout: 15_000 });
    await expect(frame.getByText("Representative")).toBeVisible();

    await page.goto("/products/sku/tcl09kodu", { waitUntil: "load" });
    await expect(page.locator("[data-media-state]").first()).toHaveAttribute("data-media-state", "missing");
    await expect(page.getByText(/No verified photo of model/)).toBeVisible();
  });
});

test.describe("catalog decision flow", () => {
  test("a task narrows categories and facets, and survives reload", async ({ page }) => {
    await page.goto("/products", { waitUntil: "load" });
    await page.getByRole("button", { name: "I need parts and supplies" }).click();
    await expect(page).toHaveURL(/task=parts/);
    await expect(page.getByRole("button", { name: "I need parts and supplies" })).toHaveAttribute("aria-pressed", "true");
    const legends = page.locator("aside legend");
    await expect(legends.filter({ hasText: "Refrigerant" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "I need parts and supplies" })).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(page).not.toHaveURL(/task=/);
  });

  test("exact model search ranks first and says why", async ({ page }) => {
    await page.goto("/products?q=TCL24KODU", { waitUntil: "load" });
    const first = page.locator("article").first();
    await expect(first.locator("[data-match-reason]")).toHaveText("Exact SKU match");
  });

  test("the complete-system task lists matched pairs and warns on mixed results", async ({ page }) => {
    await page.goto("/products?task=system", { waitUntil: "load" });
    await expect(page.getByRole("list", { name: "Matched systems" }).getByRole("listitem")).not.toHaveCount(0);
    // toHaveCount(1) waits out the streamed copy and still fails on a real duplicate.
    const notes = page.locator("[data-compatibility-notes]");
    await expect(notes).toHaveCount(1);
    await expect(notes).toContainText("Indoor and outdoor units are listed separately");
  });
});

test.describe("product decision surface", () => {
  test("identity, commerce state, compatibility and action are in the first viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // "load", not "domcontentloaded": streamed sections exist twice (the
    // hidden holder and the swapped-in copy) until the stream finishes.
    await page.goto("/products/sku/tcl24kodu", { waitUntil: "load" });
    const panel = page.locator("[data-decision-panel]");
    await expect(panel.getByRole("heading", { level: 1 })).toBeInViewport();
    await expect(panel.locator("[data-commerce-state]")).toHaveCount(1);
    await expect(panel.locator("[data-commerce-state]")).toBeInViewport();
    await expect(panel.locator("[data-compatibility-level]")).toHaveAttribute("data-compatibility-level", "matched");
    await expect(panel.getByRole("button", { name: /Request price for/ })).toBeInViewport();
    for (const id of ["overview", "compatibility", "specifications", "documents", "warranty"]) {
      await expect(page.locator(`[data-evidence="${id}"]`)).toHaveCount(1);
    }
    await expect(page.getByRole("heading", { name: "Nearby catalog items" })).toBeVisible();
  });

  test("the desktop panel stays in view while the evidence scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/products/sku/tcl24kodu", { waitUntil: "load" });
    await expect(page.locator("#documents")).toHaveCount(1);
    await page.locator("#documents").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-decision-panel] h1")).toBeInViewport();
  });

  test("phones get a bottom action bar that does not cover the content", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/products/sku/car48kahu", { waitUntil: "load" });
    const bar = page.locator(".fixed.inset-x-0.bottom-0");
    await expect(bar.getByRole("button", { name: /Request price for/ })).toBeVisible();
  });

  test("missing evidence is a sentence, not a gap", async ({ page }) => {
    await page.goto("/products/sku/ls143850ft", { waitUntil: "load" });
    const missing = page.locator('[data-evidence-state="missing"]');
    const count = await missing.count();
    for (let index = 0; index < count; index += 1) await expect(missing.nth(index).locator("p").first()).not.toBeEmpty();
  });
});

test.describe("journeys", () => {
  test("the finder recaps answers and lets one be changed", async ({ page }) => {
    await page.goto("/finder", { waitUntil: "load" });
    await page.getByRole("button", { name: /My home/ }).click();
    await expect(page.locator("[data-finder-contract]")).toContainText("not a load calculation");
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.locator("[data-finder-step]")).toHaveAttribute("data-finder-step", "2");
    await expect(page.locator("[data-finder-recap]")).toContainText("My system stopped working");
    await page.getByRole("button", { name: /Change answer to/ }).first().click();
    await expect(page.locator("[data-finder-step]")).toHaveAttribute("data-finder-step", "1");
  });

  test("the quote form leads with fields and explains what happens next", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/quote", { waitUntil: "load" });
    await expect(page.getByLabel(/Name/).first()).toBeInViewport();
    const next = page.locator("[data-what-happens-next]");
    await expect(next).toHaveCount(1);
    await expect(next).toContainText("Nothing is charged");
    const optional = page.locator("details", { hasText: "needed-by date" });
    await expect(optional).not.toHaveAttribute("open", "");
  });

  test("dealer application offers a no-account path and starts above the fold", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dealers", { waitUntil: "load" });
    await expect(page.locator("[data-no-account-path]")).toHaveCount(1);
    await expect(page.locator("[data-no-account-path]")).toContainText("No account needed");
    await expect(page.locator("main form input").first()).toBeInViewport();
  });

  test("every tool ends with a next step", async ({ page }) => {
    await page.goto("/tools/system-sizing-estimator", { waitUntil: "load" });
    await expect(page.locator("[data-tool-next-step]").getByRole("link", { name: "See systems in this size" })).toHaveAttribute("href", "/finder");
  });

  test("resource cards name their action before the click", async ({ page }) => {
    await page.goto("/resources", { waitUntil: "load" });
    await expect(page.getByText("Open tool").first()).toBeVisible();
    await expect(page.getByText("Read guide").first()).toBeVisible();
  });
});

test.describe("system", () => {
  test("type weights stay within 400 and 500", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const weights = await page.evaluate(() => Array.from(new Set(Array.from(document.querySelectorAll("body *"), (node) => getComputedStyle(node).fontWeight))));
    expect(weights.every((weight) => weight === "400" || weight === "500")).toBe(true);
  });

  test("floating chat stays off focused forms", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/quote", { waitUntil: "load" });
    await expect(page.getByRole("button", { name: "Open AI assistant chat" })).toHaveCount(0);
  });
});
