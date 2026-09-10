import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import { put } from "@vercel/blob";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { alignToBaseline, analyseShape, targetFor } from "@/lib/images/align";

/**
 * Puts every product photograph on the same baseline, so a row of them reads as a shelf
 * rather than a collage.
 *
 *   npx tsx scripts/align-product-images.ts            # dry run — measures, writes a review sheet
 *   npx tsx scripts/align-product-images.ts --apply    # convert, upload, repoint
 *   npx tsx scripts/align-product-images.ts --sheet    # dry run + before/after contact sheet
 *
 * The shop's photographs came from three different sources and each framed its subject
 * differently: a shoe's sole can sit anywhere from 1.6% to 38% above the bottom of the frame.
 * In a grid that reads as products floating at random heights, which is what the merchant
 * noticed. Every image is already 1000x1333 on the same #F1F1F1 backdrop, so correcting it is
 * a translation on a uniform field — no rescaling, no resampling of the subject.
 *
 * ## Reflections are the whole difficulty
 *
 * Many photographs carry a mirrored copy of the shoe below it, baked into the pixels. For
 * those, the bottom of the *content* is the bottom of the reflection, not the sole — aligning
 * on it would float the shoe above everything else. `analyseShape` looks for that mirror and
 * this pass skips anything it finds, per the merchant's instruction to leave reflected
 * photographs alone.
 *
 * The detector is deliberately tuned for **recall, not precision**. A clean photograph wrongly
 * called reflected is skipped and stays as it was; a reflected one wrongly called clean gets
 * aligned on the mirror's bottom edge and comes out visibly wrong. The two errors are not
 * equally bad, so the threshold sits where the harmless one happens more often.
 *
 * Photographs whose subject already touches a frame edge are skipped too: they are crops, and
 * there is no margin left to move them into.
 *
 * ## Recovery
 *
 * Every original URL is written to `.align-images/rollback.json` beside its replacement BEFORE
 * a single row is updated, and the originals are never deleted — reversing a bad batch is a
 * scripted pass rather than a re-import.
 */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const apply = process.argv.includes("--apply");
const wantSheet = process.argv.includes("--sheet") || !apply;
const OUT_DIR = path.resolve(".align-images");

interface ImageEntry {
  src: string;
  alt?: string;
}

type Skip = "reflection" | "cropped" | "not-side-on" | "not-footwear" | "already-aligned" | "no-room" | "failed";

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const products = await prisma.product.findMany({
    where: { status: { not: "archived" as never } },
    select: { id: true, name: true, images: true, category: { select: { slug: true } } },
    orderBy: { name: "asc" },
  });

  const skips: Record<Skip, number> = {
    reflection: 0, cropped: 0, "not-side-on": 0, "not-footwear": 0, "already-aligned": 0, "no-room": 0, failed: 0,
  };
  const planned: { productId: string; src: string; cat: string; from: number; to: number; buf: Buffer }[] = [];
  const samples: { before: Buffer; after: Buffer; label: string }[] = [];

  console.log(`\n  Align product images — ${apply ? "APPLYING" : "dry run (pass --apply to write)"}\n`);

  for (const product of products) {
    const cat = product.category?.slug ?? "";
    const target = targetFor(cat);
    for (const image of ((product.images as ImageEntry[] | null) ?? [])) {
      if (!image?.src) continue;
      if (!target) { skips["not-footwear"]++; continue; }
      try {
        const original = await download(image.src);
        const shape = await analyseShape(original);
        // Re-asked with the measurement in hand: a boot's target depends on whether the
        // photograph shows a knee-high boot or an ankle one, which the category cannot say.
        const measured = targetFor(cat, shape) ?? target;
        if (shape.reflection) { skips.reflection++; continue; }
        if (shape.touchesEdge) { skips.cropped++; continue; }
        // Only the side-on shots. A shoe photographed from above has no sole line in the
        // picture, so there is nothing to put on a baseline — the merchant asked for these
        // specifically, and they are also the only ones the idea is meaningful for.
        if (!shape.sideProfile) { skips["not-side-on"]++; continue; }

        const result = await alignToBaseline(original, shape, measured);
        if (result.reason) { skips[result.reason === "no-room" ? "no-room" : "already-aligned"]++; continue; }

        planned.push({ productId: product.id, src: image.src, cat: `${cat} · ${measured.label}`, from: result.fromGap, to: result.toGap, buf: result.buffer });
        if (samples.length < 12) samples.push({ before: original, after: result.buffer, label: `${measured.label} ${result.fromGap.toFixed(1)}→${result.toGap.toFixed(1)}%` });
      } catch {
        skips.failed++;
      }
    }
  }

  console.log(`  ${planned.length} image(s) would move\n`);
  for (const [reason, n] of Object.entries(skips)) if (n) console.log(`    skipped ${String(n).padStart(4)}  ${reason}`);

  const byCat = new Map<string, number>();
  for (const p of planned) byCat.set(p.cat, (byCat.get(p.cat) ?? 0) + 1);
  console.log("");
  for (const [c, n] of [...byCat].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${c}`);

  if (wantSheet && samples.length) {
    await contactSheet(samples, path.join(OUT_DIR, "before-after.png"));
    console.log(`\n  review sheet: ${path.join(OUT_DIR, "before-after.png")}`);
  }

  if (!apply) {
    console.log("\n  Dry run — nothing uploaded, no row changed.\n");
    return;
  }

  const mapping = new Map<string, string>();
  for (const p of planned) {
    const name = (p.src.split("/").pop() ?? "img").replace(/\.[a-z]+$/i, "").slice(0, 60);
    const blob = await put(`products/aligned/${crypto.randomUUID()}-${name}.webp`, p.buf, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/webp",
    });
    mapping.set(p.src, blob.url);
  }

  // Written BEFORE the database is touched: if the repoint below dies halfway, this file is
  // what turns a half-aligned catalogue back into a whole one.
  fs.writeFileSync(path.join(OUT_DIR, "rollback.json"), JSON.stringify(Object.fromEntries(mapping), null, 2));
  console.log(`\n  uploaded ${mapping.size}, rollback map written to ${path.join(OUT_DIR, "rollback.json")}`);

  let repointed = 0;
  for (const product of products) {
    const images = (product.images as ImageEntry[] | null) ?? [];
    if (!images.some((i) => mapping.has(i.src))) continue;
    const next = images.map((i) => (mapping.has(i.src) ? { ...i, src: mapping.get(i.src)! } : i));
    await prisma.product.update({ where: { id: product.id }, data: { images: next as never } });
    repointed++;
  }
  console.log(`  repointed ${repointed} product(s)\n`);
}

/** Cached, because a dry run and the apply pass fetch exactly the same bytes. */
async function download(src: string): Promise<Buffer> {
  const dir = path.resolve(".align-cache");
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, crypto.createHash("sha1").update(src).digest("hex") + ".bin");
  if (fs.existsSync(f)) return fs.readFileSync(f);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(f, buf);
  return buf;
}

async function contactSheet(samples: { before: Buffer; after: Buffer; label: string }[], out: string) {
  const CW = 200, CH = 267;
  const tiles: OverlayOptions[] = [];
  for (let i = 0; i < samples.length; i++) {
    for (const [j, buf] of [samples[i].before, samples[i].after].entries()) {
      const thumb = await sharp(buf).resize({ width: CW, height: CH, fit: "fill" }).toBuffer();
      const svg = Buffer.from(
        `<svg width="${CW}" height="${CH}">` +
        `<text x="4" y="13" font-size="11" fill="${j ? "#0a0" : "#c00"}">${j ? "after" : "before"} ${j ? "" : samples[i].label}</text></svg>`
      );
      tiles.push({
        input: await sharp(thumb).composite([{ input: svg }]).toBuffer(),
        left: (i % 6) * CW * 2 + j * CW,
        top: Math.floor(i / 6) * CH,
      });
    }
  }
  const rows = Math.ceil(samples.length / 6);
  await sharp({ create: { width: 6 * CW * 2, height: rows * CH, channels: 3, background: "#ffffff" } })
    .composite(tiles).png().toFile(out);
}

main()
  .catch((error) => {
    console.error("\n  Failed:", error instanceof Error ? error.message : error, "\n");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
