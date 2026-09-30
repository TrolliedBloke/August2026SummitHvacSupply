/**
 * Above-the-fold homepage screenshots for the design loop.
 *
 * Usage: npx tsx scripts/design-shot.ts <out.png> [width] [height]
 *
 * The reference (design/home-reference.png) is 1672x941, so the default clip
 * matches it exactly -- a screenshot of a different height cannot be compared
 * against it side by side.
 */
import { chromium } from "@playwright/test";

const [out, widthArg, heightArg] = process.argv.slice(2);
const width = Number(widthArg ?? 1672);
const height = Number(heightArg ?? 941);
const url = process.env.DESIGN_URL ?? "http://localhost:3007/";

if (!out) {
  console.error("usage: tsx scripts/design-shot.ts <out.png> [width] [height]");
  process.exit(1);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle" });
  // The delivery countdown swaps in a live value after mount; without this the
  // shot catches the server fallback and the branch card reads differently every
  // run for reasons that have nothing to do with the change under review.
  await page.waitForTimeout(600);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width, height } });
  await browser.close();
  console.log(`${out} ${width}x${height}`);
}

main();
