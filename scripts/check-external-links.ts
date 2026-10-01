/**
 * Verify literal external URLs committed in src/. Dynamic Maps, phone and
 * mail links are covered by their own domain tests; this catches editorial
 * sources, certification directories and trust-badge destinations drifting
 * to 404/410 responses.
 */
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import ts from "typescript";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const URL = /https:\/\/[^\s"'`<>)]+/g;

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

function clean(raw: string): string {
  return raw.replace(/[.,;:]+$/, "").replaceAll("&amp;", "&").split("#")[0];
}

function literalUrls(source: string, file: string): string[] {
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, kind);
  const urls: string[] = [];
  function visit(node: ts.Node) {
    // Exclude comments, documentation examples, and interpolated templates.
    // Only complete URLs committed as literal runtime values are actionable.
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      for (const match of node.text.matchAll(URL)) urls.push(clean(match[0]));
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return urls;
}

async function status(url: string): Promise<number> {
  const headers = { "User-Agent": "Summit-HVAC-link-check/1.0 (+https://www.summithvacsupply.com)" };
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "follow", headers, signal: AbortSignal.timeout(15_000) });
    if (head.status !== 405 && head.status !== 501) return head.status;
    const get = await fetch(url, { method: "GET", redirect: "follow", headers: { ...headers, Range: "bytes=0-1024" }, signal: AbortSignal.timeout(15_000) });
    return get.status;
  } catch {
    return 0;
  }
}

async function main() {
  const files = await sourceFiles("src");
  const urls = new Set<string>();
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const url of literalUrls(source, file)) urls.add(url);
  }
  const queue = [...urls].sort();
  const failures: Array<{ url: string; status: number }> = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(5, queue.length) }, async () => {
    while (cursor < queue.length) {
      const url = queue[cursor++];
      const code = await status(url);
      // 401/403 prove the host and resource path respond; the checker is not a
      // crawler bypass and must not classify bot protection as a dead link.
      const reachable = (code >= 200 && code < 400) || code === 401 || code === 403;
      process.stdout.write(`${reachable ? "ok" : "FAIL"} ${code || "network"} ${url}\n`);
      if (!reachable) failures.push({ url, status: code });
    }
  }));
  if (failures.length > 0) {
    process.stderr.write(`\n${failures.length} external ${failures.length === 1 ? "link" : "links"} failed.\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`\n${queue.length} external links responded.\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
