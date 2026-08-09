import { expect, test } from "@playwright/test";

test("saved quote hydrates without replacing the server tree", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (/hydration|did not match/i.test(message.text())) hydrationErrors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem("summit-quote-v1", JSON.stringify([{
      skuId: "catalog-0001", sku: "TCL09KIDU", modelNumber: "TSC-09HA1/I3TI22",
      title: "TCL 9K Indoor Unit", image: "/logo-summit.svg",
      unitPrice: 450, available: 0, qty: 2,
    }]));
  });
  await page.goto("/quote", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "TCL 9K Indoor Unit" }).first()).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});

test("an unsigned payment claim cannot produce a paid confirmation", async ({ page }) => {
  await page.goto("/checkout/confirmation?order=FAKE-ORDER&status=paid", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Order status unavailable" })).toBeVisible();
  await expect(page.getByText("Payment received")).toHaveCount(0);
});

test("priced product shows its price and requests availability without exposing internal inventory language", async ({ page }) => {
  await page.goto("/products/sku/tcl09kidu", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "TCL 9K Indoor Unit" })).toBeVisible();
  await expect(page.getByRole("img", { name: /TCL 9K Indoor Unit, manufacturer product view 1/i })).toBeVisible();
  await expect(page.getByText(/availability confirmation required/i)).toHaveCount(0);
  await expect(page.getByText(/inventory source/i)).toHaveCount(0);
  // Stock is unknown for every SKU in the source sheet, so a priced item is not
  // yet sellable. The buyer sees the price and requests availability; it must
  // not offer a cart it cannot fill.
  await expect(page.getByText("$450.00").first()).toBeVisible();
  await page.getByRole("button", { name: /Check availability for TCL 9K Indoor Unit/i }).first().click();
  await expect(page.getByRole("link", { name: "Go to checkout" })).toBeVisible();
});

test("exact-model media loads and supports multiple manufacturer views", async ({ page }) => {
  await page.goto("/products/sku/tos-18k-idu", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/Manufacturer media verified against model TWH18AT19D6D/).first()).toBeVisible();
  const productImage = page.getByRole("tabpanel").locator("img");
  await expect(productImage).toBeVisible();
  await expect.poll(() => productImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Next view" }).click();
  await expect(page.getByRole("tab", { name: /Manufacturer product view 2/ })).toHaveAttribute("aria-selected", "true");
});

test("account entry separates retail signup from wholesale application", async ({ page }) => {
  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "One store, the right account for you" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create retail account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Apply for wholesale" })).toBeVisible();
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`catalog layout at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/products", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflows).toBe(false);
    const screenshot = await page.screenshot({ animations: "disabled" });
    await testInfo.attach(`catalog-${viewport.name}`, { body: screenshot, contentType: "image/png" });
  });
}
