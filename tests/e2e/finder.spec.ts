import { test, expect, type Page } from "@playwright/test";
import axe from "axe-core";

async function accessible(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })));
  expect(violations).toEqual([]);
}

async function choose(page: Page, name: string | RegExp) {
  await page.getByRole("radio", { name }).check();
  await accessible(page);
  await page.getByRole("button", { name: /^(Next|See my results)/ }).click();
}

test("homeowner finder shows a verified system before asking for email and prefills installer request", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/finder");
  await accessible(page);
  await page.getByRole("button", { name: /^My home/ }).click();
  await choose(page, "My system stopped working");
  await choose(page, "Central system with ducts");
  await choose(page, /^Whole home/);
  await choose(page, "Lower energy bills");
  await page.getByRole("textbox", { name: /ZIP code/ }).fill("94560");
  await accessible(page);
  await page.getByRole("button", { name: "See my results" }).click();
  await expect(page.getByText(/AHRI 215869484/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Email me my shortlist and install checklist" })).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await accessible(page);
  await page.screenshot({ path: "test-results/finder-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Get matched with a licensed installer" }).click();
  await expect(page.locator("#homeowner-request").getByRole("textbox", { name: /ZIP/ })).toHaveValue("94560");
  expect(errors).toEqual([]);
});

test("mobile ductless results lead to installer help with an empty shortlist", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/finder");
  await page.getByRole("button", { name: /^My home/ }).click();
  await choose(page, "Cooling or heating for some rooms");
  await choose(page, /^No ducts/);
  await choose(page, /^One room/);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByText(/None of the systems/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Get matched with a licensed installer" })).toBeVisible();
  await accessible(page);
  await page.screenshot({ path: "test-results/finder-mobile.png", fullPage: true });
  await expect(page.getByRole("contentinfo").getByRole("link", { name: /Do not sell or share/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("contractor finder supports stock matching and never returns a price", async ({ page }) => {
  await page.goto("/finder");
  await page.getByRole("button", { name: /^I'm a contractor/ }).click();
  await choose(page, "Equipment for a job");
  await choose(page, "Ducted heat pump");
  await choose(page, "36,000 BTU (3 tons)");
  await choose(page, "Will-call today");
  const response = page.waitForResponse((r) => r.url().endsWith("/api/finder") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  const body = await (await response).json();
  expect(body.tier).toBe("self_identified_pro");
  expect(JSON.stringify(body.result)).not.toMatch(/retailPrice|dealerPrice|msrp/);
  await expect(page.getByRole("heading", { name: "Matching equipment for will-call" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Set alert" })).toBeVisible();
  await accessible(page);
});

for (const path of ["My home", "I'm a contractor"]) {
  test(`${path}: every question can be skipped`, async ({ page }) => {
    await page.goto("/finder");
    await page.getByRole("button", { name: new RegExp(`^${path}`) }).click();
    for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(page.getByRole("button", { name: /Start over/ })).toBeVisible();
    await accessible(page);
  });
}

test("account branch prunes earlier equipment questions", async ({ page }) => {
  await page.goto("/finder");
  await page.getByRole("button", { name: /^I'm a contractor/ }).click();
  await choose(page, "Open a trade account");
  // Branch length changes only after this answer is submitted.
  await expect(page.getByRole("heading", { name: "Open a trade account" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Apply for a trade account" })).toBeVisible();
});

test("GPC overrides an advertising grant and opt-out works without email", async ({ page, context }) => {
  await context.addCookies([{ name: "summit_ad_consent", value: "granted", domain: "127.0.0.1", path: "/" }]);
  await context.setExtraHTTPHeaders({ "Sec-GPC": "1" });
  await page.addInitScript(() => Object.defineProperty(navigator, "globalPrivacyControl", { value: true }));
  const adRequests: string[] = [];
  page.on("request", (request) => { if (/facebook\.net|facebook\.com|googletagmanager|googleadservices|doubleclick/.test(request.url())) adRequests.push(request.url()); });
  await page.goto("/privacy/opt-out");
  await expect(page.getByText(/Global Privacy Control is on/)).toBeVisible();
  await page.getByRole("button", { name: "Opt out", exact: true }).click();
  await expect(page.getByText(/Your opt-out is recorded on this browser/)).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === "summit_ad_opt_out")?.value).toBe("1");
  expect(cookies.find((cookie) => cookie.name === "summit_ad_consent")?.value).toBe("denied");
  expect(adRequests).toEqual([]);
  await accessible(page);
});

test("finder email rejects missing or tampered sessions and reports unavailable email delivery", async ({ request }) => {
  const missing = await request.post("/api/finder/email", { data: { email: "test@example.test" } });
  expect(missing.status()).toBe(404);
  const tampered = await request.post("/api/finder/email", { headers: { Cookie: "summit_finder=forged.signature" }, data: { email: "test@example.test" } });
  expect(tampered.status()).toBe(404);
  const finder = await request.post("/api/finder", { data: { path: "homeowner", answers: {} } });
  expect(finder.ok()).toBe(true);
  const cookie = finder.headers()["set-cookie"].split(";")[0];
  const noProvider = await request.post("/api/finder/email", { headers: { Cookie: cookie }, data: { email: "test@example.test", marketingOptIn: false } });
  expect(noProvider.status()).toBe(500);
});

test("anonymous visitors cannot access staff queues or audience exports", async ({ request }) => {
  for (const route of ["/admin/dealers", "/admin/referrals", "/admin/audiences"]) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/portal/login");
  }
  const response = await request.post("/admin/audiences/export", { form: { segment: "contractor" }, maxRedirects: 0 });
  expect(response.status()).toBe(307);
});
