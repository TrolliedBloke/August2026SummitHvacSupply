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
  await expect(branch.getByRole("link", { name: "Next-day delivery" })).toBeVisible();
  await expect(branch.getByText(/Order (in|tomorrow|before)/)).toBeVisible();
  await expect(branch.getByText(/Will-call ready in 30 min/)).toBeVisible();

  // Product cards state both methods too.
  await expect(page.getByText(/Pickup or delivery/i).first()).toBeVisible();

  await branch.getByRole("link", { name: "Next-day delivery" }).click();
  await expect(page).toHaveURL(/\/delivery$/);
  await expect(page.getByRole("heading", { name: /Delivery and pickup/i })).toBeVisible();
});

test("landing uses the header search once and routes product-led hero actions", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.locator("main input[type=search]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Shop as contractor/ })).toHaveAttribute("href", "/portal/login");
  await expect(page.getByRole("link", { name: /Shop as homeowner/ })).toHaveAttribute("href", "/products");
});

test("featured product quantity controls keep a floor of one", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const decrease = page.getByRole("button", { name: "Decrease quantity for TCL 2 Ton Air Handler" });
  const increase = page.getByRole("button", { name: "Increase quantity for TCL 2 Ton Air Handler" });
  const quantity = page.getByRole("status", { name: "Quantity for TCL 2 Ton Air Handler" });
  await expect(decrease).toBeDisabled();
  await expect(quantity).toHaveText("1");
  await increase.click();
  await expect(quantity).toHaveText("2");
  await decrease.click();
  await expect(quantity).toHaveText("1");
  await expect(decrease).toBeDisabled();
});

test("contractor ordering opens, switches, and collapses without a duplicate search", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const quick = page.getByRole("button", { name: "Quick order" });
  const upload = page.getByRole("button", { name: "Upload CSV" });
  await expect(quick).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Part numbers and quantities")).toHaveCount(0);

  await quick.click();
  await expect(quick).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("Part numbers and quantities")).toBeVisible();

  await upload.click();
  await expect(upload).toHaveAttribute("aria-expanded", "true");
  await expect(quick).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Part numbers and quantities")).toHaveCount(0);
  await expect(page.locator("#csv-upload")).toHaveCount(1);

  await upload.click();
  await expect(upload).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#csv-upload")).toHaveCount(0);
});

test("quick order resolves real SKUs and reports the ones it cannot match", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Quick order" }).click();

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

test("CSV upload parses a headed job list before adding it to the order", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Upload CSV" }).click();

  await page.locator("#csv-upload").setInputFiles({
    name: "newark-job.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("sku,qty\nTCL24KAHU,2\nNOTAREALSKU,1"),
  });

  await expect(page.getByText("newark-job.csv", { exact: true })).toBeVisible();
  await expect(page.getByText("2 lines", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to order" }).click();
  await expect(page.getByText(/Not matched:/)).toBeVisible();
  await expect(page.getByText("NOTAREALSKU", { exact: true })).toBeVisible();
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
