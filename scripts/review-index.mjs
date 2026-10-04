/**
 * Screenshot review index (UX fix plan WS-8).
 *
 * Reads the manifest written by scripts/capture-ui.mjs and writes index.html
 * next to it: a contact sheet grouped by route family, each thumbnail labelled
 * with what the DOM showed at capture time (heading, shell variant, media and
 * commerce states). Captures that were not ready -- a frame still loading or a
 * skeleton visible -- are listed first, so a reviewer never mistakes a loading
 * state for the design.
 *
 *   SCREENSHOT_DIR=./screenshots/site-audit node scripts/review-index.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";

const dir = path.resolve(process.env.SCREENSHOT_DIR || "./screenshots/site-audit");
const manifest = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
const escape = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const counts = (record) => Object.entries(record ?? {}).map(([key, value]) => `${key} ${value}`).join(", ") || "none";

function card(state) {
  const dom = state.dom ?? {};
  return `<figure class="${state.ready ? "" : "not-ready"}">
  <a href="${escape(state.file)}"><img loading="lazy" src="${escape(state.file)}" alt=""></a>
  <figcaption>
    <strong>${escape(state.route ?? state.state ?? state.file)}</strong> · ${escape(state.viewport ?? state.type ?? "")}
    ${state.ready ? "" : '<span class="flag">not ready</span>'}
    <dl>
      <dt>Heading</dt><dd>${escape(dom.heading ?? "none")}</dd>
      <dt>Shell</dt><dd>${escape(dom.shellVariant ?? "none")}</dd>
      <dt>Media</dt><dd>${escape(counts(dom.media))}</dd>
      <dt>Commerce</dt><dd>${escape(counts(dom.commerce))}</dd>
    </dl>
  </figcaption>
</figure>`;
}

const groups = new Map();
for (const state of manifest.states) {
  const family = state.file.split(path.sep)[0];
  groups.set(family, [...(groups.get(family) ?? []), state]);
}
const notReady = manifest.states.filter((state) => !state.ready);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Screenshot review</title>
<style>
  :root { color-scheme: light; --ink: #111; --muted: #6f6e69; --line: #e2e0da; --page: #faf9f6; --warn: #8a5112; }
  body { margin: 0; padding: 24px 16px; font: 14px/1.5 system-ui, sans-serif; color: var(--ink); background: var(--page); }
  h1 { font-size: 22px; font-weight: 500; margin: 0 0 4px; } h2 { font-size: 17px; font-weight: 500; margin: 32px 0 12px; }
  p { color: var(--muted); margin: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 16px; }
  figure { margin: 0; background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
  figure.not-ready { border-color: var(--warn); }
  img { display: block; width: 100%; height: 220px; object-fit: cover; object-position: top; border-bottom: 1px solid var(--line); }
  figcaption { padding: 10px 12px; word-break: break-word; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; margin: 6px 0 0; font-size: 12px; } dt { color: var(--muted); } dd { margin: 0; }
  .flag { margin-left: 6px; color: var(--warn); font-weight: 500; }
</style></head><body>
<h1>Screenshot review</h1>
<p>${manifest.states.length} captures from ${escape(manifest.base)}, ${escape(manifest.generatedAt)}. ${notReady.length} not ready.</p>
${notReady.length ? `<h2>Not ready (${notReady.length})</h2><div class="grid">${notReady.map(card).join("")}</div>` : ""}
${[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([family, states]) => `<h2>${escape(family)} (${states.length})</h2><div class="grid">${states.map(card).join("")}</div>`).join("\n")}
</body></html>`;

await fs.writeFile(path.join(dir, "index.html"), html);
console.log(`Wrote ${path.join(dir, "index.html")} · ${manifest.states.length} captures · ${notReady.length} not ready`);
