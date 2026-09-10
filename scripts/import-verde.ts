import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { slugify } from "@/lib/slug";
import { SIZE_RUNS, expandSizeRun } from "@/constants/size-runs";
import { alignToBaseline, analyseShape, targetFor } from "@/lib/images/align";
import { prisma } from "@/lib/prisma";
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
      // Verde's own label, hyphenated: "ANIMAL PRINT" is a colour name on their swatch and a
      // space in the middle of a SKU everywhere else.
      const sku = `VERDE-${item.code}-${colour.label.replace(/\s+/g, "-")}`;

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
        // Idempotent on the SKU, so re-running after a fix to the framing updates the product
        // instead of colliding with its own slug. The SKU is the one thing here that is stable
        // across runs — it is built from Verde's code and their colour label.
        const existing = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
        const { id } = await writeProductRow(values, existing?.id);
        console.log(`    ${existing ? "updated" : "written"} ${id}`);
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

    /**
     * Padded to 3:4 before anything is measured, so the baseline is set on the frame the shop
     * will actually show rather than on Verde's taller one.
     *
     * Scaled to 94% of the width first, deliberately. Verde shoots 960 wide against the shop's
     * 1000, so filling the frame edge to edge is only a 4% enlargement — but their loafers
     * already run the full width of their own frame, and the enlarged copy then touched both
     * edges. A subject touching an edge has no margin to be moved into, so the aligner declined
     * it and two loafers stayed 7 points off everything else. The inset also brings Verde's
     * products closer to the shop's own photography, which carries 3–11% at the sides.
     */
    const probe = await analyseShape(original);
    /**
     * Two passes rather than a chain, and the second must not enlarge.
     *
     * Both halves of that bit me. A second `.resize()` on one pipeline *replaces* the first
     * rather than composing with it; and `fit: "contain"` scales the image up to fill the box
     * before padding what is left, so even as a separate pass it put the inset straight back to
     * full width. `withoutEnlargement` is what turns "contain" into the pad-only operation this
     * wants. Both failures were silent and produced a plausible-looking 1000x1333 image.
     */
    const inset = await sharp(original).resize({ width: 940, height: 1253, fit: "inside" }).toBuffer();
    const reframed = await sharp(inset)
      .resize({ width: 1000, height: 1333, fit: "contain", withoutEnlargement: true, background: probe.backdrop })
      .webp({ quality: 85 })
      .toBuffer();

    /**
     * The mirror test is not run on Verde's photography, because Verde does not shoot mirrors.
     *
     * Checked rather than assumed: across the 46 images in this order the test flagged six, and
     * every one is a clean shoe on flat grey with nothing beneath it — a dark suede moccasin
     * scores 0.68 purely on its own upper-against-sole symmetry. There were no true positives
     * to lose. Left on, it declined to align those six and left them sitting up to 10 points off
     * the rest of the shelf, which is the visible fault it exists to prevent.
     *
     * So the baseline here is simply where the subject ends. Should Verde ever start shooting on
     * a reflective floor, this is the line to revisit — the detector still runs for the shop's
     * own catalogue, where the mirrors are real.
     */
    const measured = await analyseShape(reframed);
    const shape = { ...measured, sole: measured.bottom, reflection: false };
    const target = targetFor(category, shape);
    let final: Buffer = reframed;
    if (target && shape.sideProfile && !shape.touchesEdge) {
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
