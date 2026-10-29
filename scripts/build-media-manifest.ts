/**
 * Writes src/data/media-manifest.generated.json: the intrinsic width and
 * height of every product image the catalog references.
 *
 * The gallery needs real dimensions to reserve the right aspect ratio and to
 * decide honestly whether "View larger" shows anything larger. Reading them at
 * build time keeps the PDP static. Re-run after the catalog's images change:
 *
 *   npx tsx scripts/build-media-manifest.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type Record = { images?: string[]; referenceImages?: string[]; image?: string | null };

async function main() {
  const root = process.cwd();
  const catalog = JSON.parse(await readFile(path.join(root, "src/data/catalog.generated.json"), "utf8")) as Record[];
  const sources = new Set<string>();
  for (const record of catalog) {
    for (const src of [...(record.images ?? []), ...(record.referenceImages ?? []), record.image ?? ""]) {
      if (src && src.startsWith("/")) sources.add(src);
    }
  }
  const manifest: { [src: string]: { width: number; height: number } | null } = {};
  for (const src of Array.from(sources).sort()) {
    try {
      const meta = await sharp(path.join(root, "public", src)).metadata();
      manifest[src] = meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
    } catch {
      manifest[src] = null;
    }
  }
  await writeFile(path.join(root, "src/data/media-manifest.generated.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const missing = Object.entries(manifest).filter(([, value]) => !value).map(([src]) => src);
  console.log(`media manifest: ${Object.keys(manifest).length} images, ${missing.length} unreadable`);
  for (const src of missing) console.log(`  unreadable: ${src}`);
}

void main();
