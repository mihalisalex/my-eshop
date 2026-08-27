import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { NavigationConfig } from "@/types";

/**
 * Greek header, mega-menu and footer navigation.
 *
 * The header and footer are on every page, and they were entirely English on a site whose
 * default language is Greek — "Women", "Support", "Shipping & Returns" above and below Greek
 * product names.
 *
 * WHY THIS OVERWRITES THE LABELS instead of using translation columns: navigation is a
 * `SiteContent` JSON row and has none. That splits the codebase two ways, deliberately:
 *
 *   - Categories and collections DO have `nameEl`/`titleEl`, so their canonical field stays
 *     English and Greek lives in the translation column (see scripts/apply-greek-content.ts).
 *   - Products and navigation do NOT, so Greek lives directly in the canonical field. The 175
 *     products were imported that way and have no English version at all.
 *
 * The practical consequence is that the EN toggle translates the ~90 UI chrome strings and
 * the category/collection names, but not product names or navigation — which is the honest
 * ceiling for a shop whose catalogue exists only in Greek.
 *
 * Keyed by `id` and `href` — the stable identifiers — never by the English label being
 * replaced, so a second run matches nothing new. HREFS AND IDS ARE NOT TOUCHED: they are URLs
 * and React keys.
 *
 * Idempotent: only writes when something actually differs.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Primary nav and mega-menu children, by id. */
const BY_ID: Record<string, string> = {
  women: "Γυναικεία",
  "women-new-in": "Νέες αφίξεις",
  "women-heels": "Τακούνια",
  "women-boots": "Μπότες",
  "women-sandals": "Πέδιλα",
  men: "Ανδρικά",
  "men-new-in": "Νέες αφίξεις",
  // Shoe styles that are used untranslated in Greek retail — recorded explicitly so a future
  // reader sees a decision rather than a gap.
  "men-oxfords": "Oxfords & Derbies",
  "men-sneakers": "Sneakers",
  "men-boots": "Μπότες",
  "new-in": "Νέες αφίξεις",
  collections: "Συλλογές",
  sale: "Προσφορές",
  journal: "Άρθρα",
  about: "Σχετικά",
  search: "Αναζήτηση",
  wishlist: "Αγαπημένα",
  account: "Λογαριασμός",
  cart: "Καλάθι",
};

/** Footer links and mega-menu featured tiles, by href. */
const BY_HREF: Record<string, string> = {
  "/women": "Γυναικεία",
  "/men": "Ανδρικά",
  "/new-in": "Νέες αφίξεις",
  "/sale": "Προσφορές",
  "/collections": "Συλλογές",
  "/about": "Η ιστορία μας",
  "/sustainability": "Βιωσιμότητα",
  "/careers": "Καριέρα",
  "/journal": "Άρθρα",
  "/contact": "Επικοινωνία",
  "/concierge": "Ρωτήστε έναν στυλίστα",
  "/shipping-returns": "Αποστολές & Επιστροφές",
  "/size-guide": "Οδηγός μεγεθών",
  "/faq": "Συχνές ερωτήσεις",
  "/legal/privacy-policy": "Πολιτική Απορρήτου",
  "/legal/terms-of-service": "Όροι Χρήσης",
  "/legal/cookie-policy": "Πολιτική Cookies",
  // Featured tiles — kept identical to the collections' own Greek titles, so the mega-menu
  // and the collection page cannot disagree about what a collection is called.
  "/collections/evening-heels": "Βραδινά Τακούνια",
  "/collections/sneaker-edit": "Η Συλλογή Σνίκερ",
};

/** Footer column headings, by their current English title. */
const COLUMN_TITLES: Record<string, string> = {
  Shop: "Αγορές",
  About: "Η εταιρεία",
  Support: "Υποστήριξη",
  Legal: "Νομικά",
};

let changes = 0;

function relabel(current: string | undefined, key: string | undefined, table: Record<string, string>): string | undefined {
  if (!key) return current;
  const next = table[key];
  if (!next || next === current) return current;
  console.log(`  ${key}: "${current}" -> "${next}"`);
  changes++;
  return next;
}

/** Applies the label tables to one navigation document, in place. */
function translateNav(source: unknown): NavigationConfig & Record<string, unknown> {
  // Structurally cloned and mutated rather than rebuilt, so any field this script does not
  // know about (images, ids, hrefs) survives untouched.
  const nav = JSON.parse(JSON.stringify(source)) as NavigationConfig & Record<string, unknown>;

  for (const group of ["primary", "utility"] as const) {
    for (const item of (nav[group] ?? []) as unknown as Record<string, unknown>[]) {
      item.label = relabel(item.label as string, item.id as string, BY_ID);
      for (const child of (item.children ?? []) as Record<string, unknown>[]) {
        child.label = relabel(child.label as string, child.id as string, BY_ID);
      }
      for (const featured of (item.featured ?? []) as Record<string, unknown>[]) {
        featured.title = relabel(featured.title as string, featured.href as string, BY_HREF);
      }
    }
  }

  for (const column of (nav.footer ?? []) as unknown as Record<string, unknown>[]) {
    column.title = relabel(column.title as string, column.title as string, COLUMN_TITLES);
    for (const link of (column.links ?? []) as Record<string, unknown>[]) {
      link.label = relabel(link.label as string, link.href as string, BY_HREF);
    }
  }

  return nav;
}

async function main() {
  const row = await prisma.siteContent.findUnique({ where: { key: "navigation" } });
  if (row) {
    console.log("Live navigation row:");
    const nav = translateNav(row.data);
    if (changes > 0) {
      await prisma.siteContent.update({
        where: { key: "navigation" },
        data: { data: nav as unknown as Prisma.InputJsonObject },
      });
    }
  } else {
    console.log('No "navigation" row — the JSON fallback is in use.');
  }

  // The fallback is translated too, so `scripts/seed.ts` produces a Greek site on a fresh
  // install rather than an English one that then has to be fixed by hand.
  const jsonPath = resolve(process.cwd(), "data/navigation.json");
  const before = changes;
  console.log("\ndata/navigation.json:");
  const fromJson = translateNav(JSON.parse(readFileSync(jsonPath, "utf8")));
  if (changes > before) writeFileSync(jsonPath, `${JSON.stringify(fromJson, null, 2)}\n`, "utf8");

  console.log(changes === 0 ? "\nNothing to change — already applied." : `\n${changes} label(s) updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
