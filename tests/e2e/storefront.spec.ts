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

test("actual product page is quote-first and does not invent commerce facts", async ({ page }) => {
  await page.goto("/products/sku/tcl09kidu", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "TCL 9K Indoor Unit" })).toBeVisible();
  await expect(page.locator("main").getByText("Exact product image not yet verified")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Availability confirmation required" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Add .* to quote/i })).toBeVisible();
  await expect(page.getByText(/in stock/i)).toHaveCount(0);
  await expect(page.getByText("$0.00", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /add to cart/i })).toHaveCount(0);
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
