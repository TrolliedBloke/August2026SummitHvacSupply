import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/* WS-7 token contract (DESIGN-UX-DECISION-LOG D-08, D-09). */

const SRC = path.resolve(__dirname, "../src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
const sources = files(SRC).filter((file) => !file.endsWith(path.join("styles", "tokens.css")) && !file.endsWith("globals.css"));

/** Deprecated alias names, as used in classes (text-ink-4) or var(--ink-4). */
const DEPRECATED =
  /(?<![\w-])(?:(?:text|bg|border|ring|outline|fill|stroke|from|to|decoration|divide|accent|placeholder)-|var\(--)(surface-3|ink-4|line-soft|line-strong|brand-hover|copper-tint|copper|stock-ready-tint|stock-ready-ink|eco-tint|eco-ink|eco|danger-tint|danger)(?![\w-])/g;

/** Use on 2026-10-04. Lower it as call sites migrate; never raise it. */
const DEPRECATED_BUDGET = 202;

describe("WS-7 token contract", () => {
  it("does not grow use of deprecated aliases", () => {
    const hits = sources.flatMap((file) => Array.from(readFileSync(file, "utf8").matchAll(DEPRECATED), (match) => `${path.relative(SRC, file)}: ${match[1]}`));
    assert.ok(hits.length <= DEPRECATED_BUDGET, `${hits.length} deprecated alias uses (budget ${DEPRECATED_BUDGET}). Use the replacement named in tokens.css.`);
  });

  it("keeps weights to 400 and 500", () => {
    const css = readFileSync(path.join(SRC, "app/globals.css"), "utf8") + readFileSync(path.join(SRC, "styles/tokens.css"), "utf8");
    for (const match of css.matchAll(/font-weight:\s*([^;]+);/g)) {
      assert.ok(["400", "500", "var(--weight-strong)", "var(--weight-regular)"].includes(match[1].trim()), match[0]);
    }
    assert.match(css, /--font-weight-semibold:\s*var\(--weight-strong\)/);
    assert.match(css, /--font-weight-bold:\s*var\(--weight-strong\)/);
    for (const file of sources) assert.ok(!/font-(?:bold|extrabold|black)\b|font-\[(?:6|7|8|9)00\]/.test(readFileSync(file, "utf8")), file);
  });

  it("keeps chrome green to the footer and utility strip", () => {
    const users = sources.filter((file) => /--chrome\b|--green-deep\b/.test(readFileSync(file, "utf8"))).map((file) => path.relative(SRC, file)).sort();
    assert.deepEqual(users, ["components/nav/search-field.tsx", "components/site-footer.tsx", "components/site-nav.tsx"]);
  });
});
