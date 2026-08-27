import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { SiteSeoDefaults } from "@/types";

/**
 * Greek storefront content, plus the stock OG image and two stale data values.
 *
 * WHERE THE GREEK GOES, and why it is not obvious. Collections already carried good Greek in
 * `titleEl`/`subtitleEl` — written earlier and rendered on the homepage, which calls
 * `localizeCollections`. The `/collections` INDEX never called it, so the same collection
 * appeared in Greek on one page and English on another. That is the actual defect, and it is
 * fixed in app/collections/page.tsx rather than by translating anything.
 *
 * So the canonical `title`/`name` columns stay ENGLISH and Greek lives in the `*El` columns,
 * which is what the schema and `lib/localize.ts` were built for. Writing Greek into `title`
 * instead — the first thing I tried — produced a SECOND, competing Greek translation sitting
 * next to the existing one, with the homepage and the index disagreeing about what a
 * collection is called.
 *
 * Categories get the same treatment: their `nameEl` was empty, so the Greek is added there
 * and `name` is left English. `app/category/[slug]/page.tsx` already localizes.
 *
 * Products are the deliberate exception and are not touched: all 175 store Greek directly in
 * `name` with `nameEl` empty, because the catalogue was imported that way and has no English
 * version to fall back to. Churning 175 rows to change that would gain nothing.
 *
 * SLUGS ARE NOT TOUCHED. A slug is a URL, and 207 of them are in the sitemap and indexed.
 *
 * Re-runnable and idempotent: rows are matched by slug and written only when a value actually
 * differs, so a second run is a no-op and says so.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Keyed by slug — the stable identifier — never by the display name being set. */
const CATEGORIES: Record<string, { name: string; nameEl: string }> = {
  heels: { name: "Heels", nameEl: "Τακούνια" },
  sandals: { name: "Sandals", nameEl: "Πέδιλα" },
  boots: { name: "Boots", nameEl: "Μπότες" },
  // Sneakers, loafers and oxfords are the same word in Greek usage — set explicitly rather
  // than skipped, so "no translation needed" is recorded rather than looking like an omission.
  sneakers: { name: "Sneakers", nameEl: "Sneakers" },
  loafers: { name: "Loafers", nameEl: "Loafers" },
  oxfords: { name: "Oxfords", nameEl: "Oxfords" },
};

/**
 * English restored to the canonical columns. The Greek in `titleEl`/`subtitleEl` is left
 * exactly as it was — it is good, it predates this script, and it is what the homepage has
 * been rendering all along.
 */
const COLLECTIONS: Record<string, { title: string; subtitle: string }> = {
  "everyday-essentials": { title: "Everyday Essentials", subtitle: "Loafers and slides for daily wear" },
  "evening-heels": { title: "Evening Heels", subtitle: "Elevated silhouettes for after dark" },
  "sneaker-edit": { title: "The Sneaker Edit", subtitle: "Everyday icons, elevated" },
  "boots-booties": { title: "Boots & Booties", subtitle: "Built for cooler days" },
  "new-arrivals": { title: "New Arrivals", subtitle: "Just landed" },
};

const SEO_TITLE = "ALEXANDRIS — Γυναικεία & ανδρικά παπούτσια";
const SEO_DESCRIPTION =
  "Το ALEXANDRIS είναι κατάστημα υποδημάτων στο Ηράκλειο Κρήτης. Γυναικεία και ανδρικά παπούτσια, με προσοχή στη λεπτομέρεια και διαχρονικό σχεδιασμό.";

async function main() {
  let changed = 0;

  for (const [slug, want] of Object.entries(CATEGORIES)) {
    const row = await prisma.category.findUnique({ where: { slug }, select: { id: true, name: true, nameEl: true } });
    if (!row) {
      console.log(`  category "${slug}" not found — skipped`);
      continue;
    }
    if (row.name === want.name && row.nameEl === want.nameEl) continue;
    await prisma.category.update({ where: { id: row.id }, data: want });
    console.log(`  category ${slug}: name "${row.name}" -> "${want.name}", nameEl "${row.nameEl ?? "(null)"}" -> "${want.nameEl}"`);
    changed++;
  }

  for (const [slug, want] of Object.entries(COLLECTIONS)) {
    const row = await prisma.collection.findUnique({
      where: { slug },
      select: { id: true, title: true, subtitle: true, titleEl: true },
    });
    if (!row) {
      console.log(`  collection "${slug}" not found — skipped`);
      continue;
    }
    if (row.title === want.title && row.subtitle === want.subtitle) continue;
    // titleEl deliberately absent from the update — the existing Greek is the good copy.
    await prisma.collection.update({ where: { id: row.id }, data: want });
    console.log(`  collection ${slug}: title "${row.title}" -> "${want.title}" (Greek stays "${row.titleEl ?? "(null)"}")`);
    changed++;
  }

  const seoRow = await prisma.siteContent.findUnique({ where: { key: "seo" } });
  if (seoRow) {
    const current = seoRow.data as unknown as SiteSeoDefaults;
    const next: SiteSeoDefaults = {
      ...current,
      defaultTitle: SEO_TITLE,
      defaultDescription: SEO_DESCRIPTION,
    };
    // Deleted rather than blanked: an empty string is still a declared image, and declaring
    // one is exactly what suppresses the generated card in app/opengraph-image.tsx (QA-028).
    delete (next as Partial<SiteSeoDefaults>).defaultOgImage;

    if (JSON.stringify(next) !== JSON.stringify(current)) {
      await prisma.siteContent.update({
        where: { key: "seo" },
        data: { data: next as unknown as Prisma.InputJsonObject },
      });
      console.log(`  seo.defaultTitle: "${current.defaultTitle}" -> "${next.defaultTitle}"`);
      if (current.defaultOgImage) console.log(`  seo.defaultOgImage: removed (was an Unsplash stock photo)`);
      changed++;
    }
  }

  // The logo asset still pointed at the reserved demo domain, so the Media Library listed an
  // entry whose file could never load.
  for (const asset of await prisma.mediaAsset.findMany({
    where: { url: { contains: "alexandris-demo.example" } },
    select: { id: true, url: true },
  })) {
    const url = asset.url.replace(/https?:\/\/(www\.)?alexandris-demo\.example/, "https://shopalexandris.vercel.app");
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { url } });
    console.log(`  media ${asset.id}: -> ${url}`);
    changed++;
  }

  // Two representations of "this size has no SKU" (NULL and "") is a distinction nothing
  // means. Normalised to NULL, matching the other 1,038 rows. Per-size SKUs are NOT invented
  // here — that is a merchandising decision, not a data repair.
  const emptied = await prisma.productSize.updateMany({ where: { sku: "" }, data: { sku: null } });
  if (emptied.count > 0) {
    console.log(`  product sizes: normalised ${emptied.count} empty-string SKUs to NULL`);
    changed++;
  }

  console.log(changed === 0 ? "\nNothing to change — already applied." : `\n${changed} change(s) applied.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
