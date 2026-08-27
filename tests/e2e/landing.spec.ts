import { expect, test } from "@playwright/test";

/**
 * Guards on the landing page and the fulfillment surfaces it links to.
 *
 * These cover the two claims the page must never get wrong: it must not assert
 * stock the catalog cannot verify, and it must not read as pickup-only. Both
 * regressed easily during the rebuild, and neither is caught by a type check.
 */

test("landing page never claims a stock count the catalog cannot verify", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const stockRow = page.getByText("Stock at order").first();
  await expect(stockRow).toBeVisible();

  // This suite runs without Supabase credentials, so the live-inventory overlay
  // returns nothing and every SKU is uncounted -- which is exactly the state
  // being guarded. With no verified quantity behind it, a literal "N in stock"
  // is a fabricated claim, and the audit calls an unbacked stock metric the
  // single most damaging thing on this page.
  //
  // A real count from QuickBooks is a different matter and IS allowed to render
  // "N in stock"; what must never happen is this page inventing one when the
  // warehouse has said nothing. Keep the assertion, keep the env absent.
  await expect(page.getByText(/\b\d+\s+in stock\b/)).toHaveCount(0);

  // ...and the action must match: nothing is sellable, so nothing offers a cart.
  await expect(page.getByRole("button", { name: /Add to cart/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Check availability/i }).first()).toBeVisible();
});

test("landing page surfaces delivery alongside pickup, not pickup alone", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const branch = page.getByRole("article").filter({ hasText: "NEWARK BRANCH" }).first();
  await expect(branch.getByText("Pickup", { exact: true })).toBeVisible();
  await expect(branch.getByText("Delivery", { exact: true })).toBeVisible();

  // The address was absent entirely while the card was pickup-only; once a
  // visitor is choosing between two methods, "where is it" is part of the choice.
  await expect(branch.getByText(/5437 Central Ave/)).toBeVisible();
  await expect(branch.getByRole("link", { name: "Directions" })).toBeVisible();

  // Product cards state both methods too.
  await expect(page.getByText("PICKUP OR DELIVERY").first()).toBeVisible();

  await branch.getByRole("link", { name: "Delivery details" }).click();
  await expect(page).toHaveURL(/\/delivery$/);
  await expect(page.getByRole("heading", { name: /Delivery and pickup/i })).toBeVisible();
});

test("quick order resolves real SKUs and reports the ones it cannot match", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Quick order" }).click();

  await page
    .getByLabel("Part numbers and quantities")
    .fill("TCL24KAHU, 2\nNOTAREALSKU, 1");
  await page.getByRole("button", { name: "Add to order" }).click();

  // A part number the catalog does not carry must be named, not silently
  // dropped -- a contractor pasting a job list has to know what did not land.
  await expect(page.getByText(/Not matched:/)).toBeVisible();
  await expect(page.getByText("NOTAREALSKU", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "TCL 2 Ton Air Handler" }).first()).toBeVisible();
});

test("delivery page marks unconfirmed terms rather than presenting them as final", async ({ page }) => {
  await page.goto("/delivery", { waitUntil: "domcontentloaded" });

  for (const heading of ["Delivery zones", "Order cutoff", "Fees and thresholds", "Will-call pickup"]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  // No invented fee schedule. A dollar amount here would be a commitment
  // nobody at the counter has agreed to.
  await expect(page.getByText(/\$\d/)).toHaveCount(0);
});

test("brands page counts come from the catalog, not from hand-typed copy", async ({ page }) => {
  await page.goto("/brands", { waitUntil: "domcontentloaded" });

  const tcl = page.getByRole("link").filter({ hasText: "Shop TCL" }).first();
  await expect(tcl.getByText(/\d+ SKUs/)).toBeVisible();

  // "Unbranded" covers fittings and line sets -- real inventory, but not a
  // brand anyone shops by, so it must not appear as one.
  await expect(page.getByRole("link", { name: /^Unbranded/ })).toHaveCount(0);

  await tcl.click();
  await expect(page).toHaveURL(/\/products\?brand=TCL/);
});
