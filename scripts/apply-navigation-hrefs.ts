import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Reconciles the mega-menu's destinations with what they are supposed to be.
 *
 *   npx tsx scripts/apply-navigation-hrefs.ts           # dry run
 *   npx tsx scripts/apply-navigation-hrefs.ts --apply
 *
 * The menu lives in the `navigation` SiteContent row, hand-maintained, and every href in it
 * is a string nothing validates. Two separate faults have come out of that, both of which
 * looked like working menu items:
 *
 *   THREE EMPTY HREFS. Γυναικεία > Sneakers, Γυναικεία > Μοκασίνια & Loafers and
 *   Ανδρικά > Μοκασίνια & Loafers carried `href: ""`, which renders as a link to the current
 *   page. Presumably left blank because there is no women's-sneakers category to point at —
 *   `sneakers` holds both genders — but the gender routes accept a category filter, so
 *   /women?category=sneakers gets there against the current taxonomy.
 *
 *   TWO EMPTY RESULT SETS. Both "Νέες αφίξεις" entries pointed at `?isNew=true`, which
 *   filters on `Product.isNew`. That is a merchandising badge and it is false on all 175
 *   products, so each link led to a page reading "0 προϊόντα". `/new-in` had already learned
 *   this and shows every product sorted newest-first instead (see its comment); these two now
 *   do the same thing scoped to a gender. `sort=newest` is the ProductListingPage parameter,
 *   and "newest" sorts on when a product was actually added rather than on a flag.
 *
 * The two failures share a root cause worth naming: a menu href can be wrong in a way that
 * renders perfectly. An empty string and a filter that matches nothing both look like a
 * link, and neither shows up in a build, a type check or a test.
 *
 * Idempotent — it reports what already matches and writes only the differences.
 *
 * NOTE: `scripts/split-categories-by-gender.ts` rewrites the four category hrefs below to the
 * gendered slugs it creates. Run this first and it is simply superseded for those entries;
 * the two `sort=newest` links are unaffected by that migration either way.
 */
const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

/** Parent href -> child label -> the destination that child should have. */
const INTENDED: Record<string, Record<string, string>> = {
  "/women": {
    "Νέες αφίξεις": "/women?sort=newest",
    "Τακούνια": "/women?category=heels",
    "Μπότες & Μποτάκια": "/women?category=boots",
    "Πέδιλα": "/women?category=sandals",
    "Sneakers": "/women?category=sneakers",
    "Μοκασίνια & Loafers": "/women?category=loafers",
  },
  "/men": {
    "Νέες αφίξεις": "/men?sort=newest",
    "Oxfords & Derbies": "/men?category=oxfords",
    "Sneakers": "/men?category=sneakers",
    "Μποτάκια": "/men?category=boots",
    "Μοκασίνια & Loafers": "/men?category=loafers",
  },
};

interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

async function main() {
  console.log(APPLY ? "APPLYING\n" : "DRY RUN — nothing will be written. Re-run with --apply.\n");

  const row = await prisma.siteContent.findUnique({ where: { key: "navigation" } });
  if (!row) {
    console.error("No navigation row — nothing to do.");
    process.exitCode = 1;
    return;
  }

  const data = JSON.parse(JSON.stringify(row.data)) as { primary: NavItem[] };
  let changed = 0;

  for (const item of data.primary) {
    const wanted = INTENDED[item.href];
    if (!wanted) continue;
    for (const child of item.children ?? []) {
      const href = wanted[child.label];
      if (!href) continue;
      if (child.href === href) {
        console.log(`  = ${item.label} > ${child.label}`);
        continue;
      }
      console.log(`  ~ ${item.label} > ${child.label}: ${child.href === "" ? "(empty)" : child.href} -> ${href}`);
      child.href = href;
      changed++;
    }
  }

  if (changed === 0) {
    console.log("\nEvery menu link already points where it should.");
    return;
  }

  if (APPLY) {
    await prisma.siteContent.update({
      where: { key: "navigation" },
      data: { data: data as unknown as Prisma.InputJsonObject },
    });
    console.log(`\nUpdated ${changed} link(s). Navigation is database content — no deploy needed.`);
  } else {
    console.log(`\n${changed} link(s) would change. Re-run with --apply.`);
  }
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
