import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Gives the three dead mega-menu entries a working link.
 *
 *   npx tsx scripts/fix-empty-nav-links.ts           # dry run
 *   npx tsx scripts/fix-empty-nav-links.ts --apply
 *
 * Γυναικεία > Sneakers, Γυναικεία > Μοκασίνια & Loafers and Ανδρικά > Μοκασίνια & Loafers
 * each carried `href: ""` in the `navigation` SiteContent row. An empty href renders as a
 * link to the current page, so the menu item looked live and did nothing — on both the
 * desktop mega-menu and the mobile menu, for every visitor.
 *
 * They were presumably left blank because there is no women's-sneakers category to point
 * at: `sneakers` holds both genders. But the gender listing routes already accept a category
 * filter — `Τακούνια` has always pointed at `/women?category=heels` — so the same pattern
 * gives each of these a correct destination against the CURRENT taxonomy, with no migration
 * and no schema change.
 *
 * `scripts/split-categories-by-gender.ts` rewrites these same three hrefs to the gendered
 * category slugs it creates. It matches on the menu label rather than the current href, so
 * running this first does not interfere with it.
 *
 * Idempotent, and deliberately narrow: it only ever fills an EMPTY href. An entry someone
 * has since pointed somewhere on purpose is left alone.
 */
const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

/** Parent href -> child label -> the destination that child should have had. */
const FILL: Record<string, Record<string, string>> = {
  "/women": {
    "Sneakers": "/women?category=sneakers",
    "Μοκασίνια & Loafers": "/women?category=loafers",
  },
  "/men": {
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
    const wanted = FILL[item.href];
    if (!wanted) continue;
    for (const child of item.children ?? []) {
      const href = wanted[child.label];
      if (!href) continue;
      if (child.href !== "") {
        console.log(`  = ${item.label} > ${child.label} already points at ${child.href}`);
        continue;
      }
      console.log(`  + ${item.label} > ${child.label}: (empty) -> ${href}`);
      child.href = href;
      changed++;
    }
  }

  if (changed === 0) {
    console.log("\nNothing to fill.");
    return;
  }

  if (APPLY) {
    await prisma.siteContent.update({
      where: { key: "navigation" },
      data: { data: data as unknown as Prisma.InputJsonObject },
    });
    console.log(`\nFilled ${changed} empty link(s). Redeploy or wait for revalidation.`);
  } else {
    console.log(`\n${changed} empty link(s) would be filled. Re-run with --apply.`);
  }
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
