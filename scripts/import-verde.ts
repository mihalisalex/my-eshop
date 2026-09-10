import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { slugify } from "@/lib/slug";
import { SIZE_RUNS, expandSizeRun } from "@/constants/size-runs";
import { alignToBaseline, analyseShape, targetFor } from "@/lib/images/align";
import { writeProductRow } from "@/lib/products-import/write";
import type { ProductFormValues } from "@/lib/validation/product";

/**
 * Brings an order from the Verde B2B catalogue into the shop.
 *
 *   node --conditions=react-server --import tsx scripts/import-verde.ts            # dry run
 *   node --conditions=react-server --import tsx scripts/import-verde.ts --apply    # write
 *
 * `react-server` because this writes through `writeProductRow`, the same path the admin form
 * and the CSV import use, and that module is `server-only`. Going through it rather than
 * writing rows directly is the point: category resolution, SEO normalisation, size positioning
 * and back-in-stock notification all already live there, and a second write path would drift.
 *
 * ## What comes from where
 *
 * Verde's product pages are behind their B2B login, so the catalogue data is lifted from a
 * logged-in browser session and lands in `.verde/order.json` (see `scripts/verde-extract.js`
 * for the snippet that produces it). The **images are public**, so this script fetches them
 * itself rather than pulling them through the browser.
 *
 * One product per colour, matching how the shop already lists Mont Martre's booties, and
 * because a shopper filtering by colour is filtering products rather than variants here.
 *
 * ## Photographs
 *
 * Verde shoots 960x1200 on #E8E8E8; the shop is 1000x1333 on #F1F1F1. The frames are padded
 * out to 3:4 in **Verde's own grey**, not the shop's — nine levels between the two is
 * invisible until they meet, and then it is a hard edge across the picture. `analyseShape`
 * reads the backdrop per image, so nothing here has to know which supplier a photograph came
 * from. Afterwards each one goes onto the shop's baseline like any other.
 */

const apply = process.argv.includes("--apply");
const ORDER = path.resolve(".verde/order.json");

interface OrderColour {
  /** Verde's own colour label, as printed on their swatch. */
  label: string;
  /** The Greek colour word for the shop's product name. */
  el: string;
  hex: string;
  barcode: string;
}

interface OrderItem {
  code: string;
  /**
   * The shop's product name with a `{colour}` slot.
   *
   * A slot rather than a suffix because Greek puts the colour adjective inside the phrase and
   * inflects it — the catalogue already reads `Μπότα μαύρη κροκό με τακούνι και φερμουάρ`, not
   * `Μπότα κροκό … μαύρη`. Appending would have produced the second.
   */
  nameEl: string;
  descriptionEl: string;
  category: string;
  gender: string;
  /** What the whole box cost, and how many pairs were in it. */
  boxPrice: number;
  pairs: number;
  /** Verde's own suggested retail, read from their page rather than computed. */
  retail: number;
  /** The size run the box arrived as, by `SIZE_RUNS` id. */
  run: string;
  materials: string[];
  colours: OrderColour[];
}

async function main() {
  if (!fs.existsSync(ORDER)) {
    console.error(`\n  No order file at ${ORDER}\n`);
    process.exitCode = 1;
    return;
  }
  const items: OrderItem[] = JSON.parse(fs.readFileSync(ORDER, "utf8"));

  console.log(`\n  Verde import — ${apply ? "APPLYING" : "dry run (pass --apply to write)"}\n`);

  for (const item of items) {
    const run = SIZE_RUNS.find((r) => r.id === item.run);
    if (!run) {
      console.error(`  ${item.code}: no size run "${item.run}"`);
      continue;
    }
    const sizes = expandSizeRun(run).map((size) => ({ ...size, inStock: true }));
    const costPerPair = Math.round((item.boxPrice / item.pairs) * 100) / 100;

    for (const colour of item.colours) {
      const name = item.nameEl.replace("{colour}", colour.el);
      const slug = slugify(name);
      const sku = `VERDE-${item.code}-${colour.label}`;

      const images = await prepareImages(colour.barcode, item.category, item.code, colour.label);
      if (images.length === 0) {
        console.log(`  ${sku}: no images found, skipped`);
        continue;
      }

      const values: ProductFormValues = {
        slug,
        name,
        description: item.descriptionEl,
        price: item.retail,
        currencyCode: "EUR",
        costPrice: costPerPair,
        images: images.map((src, i) => ({ src, alt: `${name} — ${i + 1}` })),
        colors: [{ name: colour.el, hex: colour.hex, imageSrc: images[0], imageAlt: name }],
        sizes,
        category: item.category,
        collectionIds: [],
        tags: [],
        gender: item.gender as ProductFormValues["gender"],
        materials: item.materials,
        careInstructions: [],
        relatedProductIds: [],
        isNew: true,
        isSale: false,
        isPreorder: false,
        isBackorder: false,
        sku,
        inventoryPolicy: "deny",
        availableForSale: true,
        // Drafts, always. Nothing a supplier sent should reach the storefront before a person
        // has read the Greek name back and looked at the photographs.
        status: "draft",
      };

      console.log(
        `  ${sku}\n` +
        `    ${name}\n` +
        `    ${item.retail.toFixed(2)} € retail · ${costPerPair.toFixed(2)} € cost/pair · ${run.notation}\n` +
        `    ${images.length} image(s), ${item.category}, draft`
      );

      if (apply) {
        const { id } = await writeProductRow(values);
        console.log(`    written ${id}`);
      }
    }
  }

  if (!apply) console.log("\n  Dry run — nothing uploaded, no row written.\n");
  else console.log("");
}

/**
 * Fetches a colour's photographs, reframes them to the shop's 3:4 and puts them on its
 * baseline. Returns the stored URLs in order, the first being the card image.
 */
async function prepareImages(barcode: string, category: string, code: string, label: string): Promise<string[]> {
  const urls: string[] = [];
  for (let n = 1; n <= 10; n++) {
    const source = `https://www.verdefashion.gr/image/catalog/erp_synced/${barcode}/${barcode}_${n}.jpg`;
    const response = await fetch(source);
    if (!response.ok) break;
    const original = Buffer.from(await response.arrayBuffer());

    // Padded to 3:4 before anything is measured, so the baseline is set on the frame the shop
    // will actually show rather than on Verde's taller one.
    const probe = await analyseShape(original);
    const reframed = await sharp(original)
      .resize({ width: 1000, height: 1333, fit: "contain", background: probe.backdrop })
      .webp({ quality: 85 })
      .toBuffer();

    const shape = await analyseShape(reframed);
    const target = targetFor(category, shape);
    let final: Buffer = reframed;
    if (target && shape.sideProfile && !shape.reflection && !shape.touchesEdge) {
      const aligned = await alignToBaseline(reframed, shape, target);
      if (!aligned.reason) final = aligned.buffer;
    }

    if (!apply) {
      const dir = path.resolve(".verde/preview");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${code}-${label}-${n}.webp`), final);
      urls.push(`(preview) ${code}-${label}-${n}.webp`);
      continue;
    }

    const blob = await put(`products/verde/${crypto.randomUUID()}-${barcode}-${n}.webp`, final, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/webp",
    });
    urls.push(blob.url);
  }
  return urls;
}

main().catch((error) => {
  console.error("\n  Failed:", error instanceof Error ? error.message : error, "\n");
  process.exitCode = 1;
});
