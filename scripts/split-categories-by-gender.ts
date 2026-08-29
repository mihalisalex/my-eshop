import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Splits the mixed-gender categories in two and files every category under a gender parent.
 *
 *   npx tsx scripts/split-categories-by-gender.ts            # dry run, writes nothing
 *   npx tsx scripts/split-categories-by-gender.ts --apply
 *
 * WHAT WAS WRONG. Six top-level categories, three of them holding both genders: Sneakers
 * (7 women / 26 men), Loafers (9 / 18) and Boots (14 / 3). A shopper browsing men's shoes
 * met women's heels in the same list. `Category.parentId` and the whole subtree-filtering
 * path (`getCategorySubtreeIds`, used by products and search) already existed and had never
 * been used — every category was top-level.
 *
 * THE SHAPE. Gender is the parent, style is the child:
 *
 *   Γυναικεία   Τακούνια · Πέδιλα · Μπότες · Sneakers · Loafers
 *   Ανδρικά     Sneakers · Loafers · Μπότες · Oxfords
 *
 * THE MAJORITY KEEPS ITS ROW. Splitting a category means one old URL maps to two new ones,
 * which slug history cannot express — it is built for renames. So each mixed category is
 * RENAMED to its majority gender and keeps those products in place, and only the minority
 * moves to a fresh row. `/category/sneakers` therefore 308s to the men's page, which holds
 * 26 of its 33 products. Nineteen products move in total instead of seventy-seven, and no
 * indexed URL dies.
 *
 * Slug history is written for every rename, in the same transaction, exactly as
 * `updateCategory` does — a rename that committed without its history row would silently
 * 404 the old URL.
 *
 * THE GENDER PARENTS ARE INVISIBLE, deliberately. A visible parent page would list its whole
 * subtree — all 115 women's products — which is a near-duplicate of `/women`, an existing
 * route with a better filter UI. Creating a second indexable URL for the same result set
 * costs rankings rather than earning them, which is the same reasoning that keeps this shop
 * on one locale URL set. The parents exist to group the tree in the admin and to give the
 * navigation something to hang off.
 *
 * NAMING RULE: gender-qualify only where both genders exist. Sneakers, Loafers and Boots
 * become "Γυναικεία Sneakers" / "Ανδρικά Sneakers" and so on, because a page headed just
 * "Sneakers" showing one gender is ambiguous with an invisible parent. Heels, Sandals and
 * Oxfords exist for one gender only, so their plain names and — importantly — their existing
 * slugs are left untouched. No redirect is needed for those at all.
 *
 * `Product.gender` REMAINS THE SOURCE OF TRUTH. Nothing here reads gender from the category,
 * and `/women` and `/men` are unaffected — they filter on the product field exactly as
 * before. The category tree is now a second place gender is expressed, so the two can drift;
 * the verification pass at the end reports any product whose gender disagrees with the
 * branch it sits in.
 *
 * Idempotent: re-running finds the work already done and reports no changes.
 */
const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

interface Parent {
  slug: string;
  name: string;
  nameEl: string;
  position: number;
}

const PARENTS: Parent[] = [
  { slug: "gynaikeia", name: "Women", nameEl: "Γυναικεία", position: 0 },
  { slug: "andrika", name: "Men", nameEl: "Ανδρικά", position: 1 },
];

/** A category that holds both genders: the majority keeps the row, the minority gets a new one. */
interface Split {
  currentSlug: string;
  majority: { gender: string; parent: string; slug: string; name: string; nameEl: string; position: number };
  minority: { gender: string; parent: string; slug: string; name: string; nameEl: string; position: number };
}

const SPLITS: Split[] = [
  {
    currentSlug: "sneakers",
    majority: { gender: "men", parent: "andrika", slug: "andrika-sneakers", name: "Men's Sneakers", nameEl: "Ανδρικά Sneakers", position: 0 },
    minority: { gender: "women", parent: "gynaikeia", slug: "gynaikeia-sneakers", name: "Women's Sneakers", nameEl: "Γυναικεία Sneakers", position: 3 },
  },
  {
    currentSlug: "loafers",
    majority: { gender: "men", parent: "andrika", slug: "andrika-loafers", name: "Men's Loafers", nameEl: "Ανδρικά Loafers", position: 1 },
    minority: { gender: "women", parent: "gynaikeia", slug: "gynaikeia-loafers", name: "Women's Loafers", nameEl: "Γυναικεία Loafers", position: 4 },
  },
  {
    currentSlug: "boots",
    majority: { gender: "women", parent: "gynaikeia", slug: "gynaikeia-boots", name: "Women's Boots", nameEl: "Γυναικεία Μπότες", position: 2 },
    minority: { gender: "men", parent: "andrika", slug: "andrika-boots", name: "Men's Boots", nameEl: "Ανδρικά Μπότες", position: 2 },
  },
];

/** Single-gender already — reparent only. Slug and name untouched, so no redirect is needed. */
const REPARENT: { slug: string; parent: string; position: number }[] = [
  { slug: "heels", parent: "gynaikeia", position: 0 },
  { slug: "sandals", parent: "gynaikeia", position: 1 },
  { slug: "oxfords", parent: "andrika", position: 3 },
];

const plan: string[] = [];
const note = (line: string) => plan.push(line);

async function main() {
  console.log(APPLY ? "APPLYING — the database will be written.\n" : "DRY RUN — nothing will be written. Re-run with --apply.\n");

  const parentIds = new Map<string, string>();

  for (const p of PARENTS) {
    const existing = await prisma.category.findUnique({ where: { slug: p.slug } });
    if (existing) {
      parentIds.set(p.slug, existing.id);
      note(`  = parent ${p.nameEl} (${p.slug}) already exists`);
      continue;
    }
    note(`  + create parent ${p.nameEl} (${p.slug}) — hidden, groups the tree only`);
    if (APPLY) {
      const created = await prisma.category.create({
        data: { slug: p.slug, name: p.name, nameEl: p.nameEl, position: p.position, isVisible: false },
      });
      parentIds.set(p.slug, created.id);
    } else {
      parentIds.set(p.slug, `<new:${p.slug}>`);
    }
  }

  for (const split of SPLITS) {
    const row =
      (await prisma.category.findUnique({ where: { slug: split.currentSlug } })) ??
      (await prisma.category.findUnique({ where: { slug: split.majority.slug } }));
    if (!row) {
      note(`  ! ${split.currentSlug} not found — skipped`);
      continue;
    }

    const majorityParent = parentIds.get(split.majority.parent)!;
    if (row.slug !== split.majority.slug) {
      const kept = await prisma.product.count({ where: { categoryId: row.id, gender: split.majority.gender } });
      note(`  ~ rename ${row.slug} -> ${split.majority.slug} ("${split.majority.nameEl}"), keeps ${kept} ${split.majority.gender} product(s)`);
      note(`      + slug history: /category/${row.slug} 308s to /category/${split.majority.slug}`);
      if (APPLY) {
        await prisma.$transaction([
          prisma.category.update({
            where: { id: row.id },
            data: {
              slug: split.majority.slug,
              name: split.majority.name,
              nameEl: split.majority.nameEl,
              parentId: majorityParent,
              position: split.majority.position,
            },
          }),
          prisma.categorySlugHistory.upsert({
            where: { slug: row.slug },
            create: { slug: row.slug, categoryId: row.id },
            update: { categoryId: row.id },
          }),
          prisma.categorySlugHistory.deleteMany({ where: { slug: split.majority.slug } }),
        ]);
      }
    } else {
      note(`  = ${split.majority.slug} already renamed`);
    }

    const minorityParent = parentIds.get(split.minority.parent)!;
    let minorityId = (await prisma.category.findUnique({ where: { slug: split.minority.slug } }))?.id;
    if (!minorityId) {
      note(`  + create ${split.minority.slug} ("${split.minority.nameEl}")`);
      if (APPLY) {
        const created = await prisma.category.create({
          data: {
            slug: split.minority.slug,
            name: split.minority.name,
            nameEl: split.minority.nameEl,
            parentId: minorityParent,
            position: split.minority.position,
            isVisible: true,
            image: row.image ?? undefined,
          },
        });
        minorityId = created.id;
      }
    } else {
      note(`  = ${split.minority.slug} already exists`);
    }

    const moving = await prisma.product.count({ where: { categoryId: row.id, gender: split.minority.gender } });
    if (moving > 0) {
      note(`  > move ${moving} ${split.minority.gender} product(s) into ${split.minority.slug}`);
      if (APPLY && minorityId) {
        await prisma.product.updateMany({
          where: { categoryId: row.id, gender: split.minority.gender },
          data: { categoryId: minorityId },
        });
      }
    } else {
      note(`  = no ${split.minority.gender} products left in ${split.majority.slug}`);
    }
  }

  for (const r of REPARENT) {
    const row = await prisma.category.findUnique({ where: { slug: r.slug } });
    if (!row) { note(`  ! ${r.slug} not found — skipped`); continue; }
    const parent = parentIds.get(r.parent)!;
    if (row.parentId === parent) { note(`  = ${r.slug} already under ${r.parent}`); continue; }
    note(`  ^ reparent ${r.slug} under ${r.parent} (slug and name unchanged, no redirect needed)`);
    if (APPLY) {
      await prisma.category.update({ where: { id: row.id }, data: { parentId: parent, position: r.position } });
    }
  }

  await fixNavigation();

  console.log(plan.join("\n"));

  if (APPLY) {
    console.log("\n--- after ---");
    await report();
  } else {
    console.log("\nRe-run with --apply to write it.");
  }
}

/**
 * The navigation row links category filters onto the gender routes — /women?category=heels —
 * so renaming a category slug breaks the menu silently. Three entries were ALREADY broken
 * before this migration: Γυναικεία > Sneakers, Γυναικεία > Loafers and Ανδρικά > Loafers all
 * carried an empty href, which renders as a link to the current page. The categories they
 * needed did not exist until now, which is presumably why they were left blank.
 */
async function fixNavigation() {
  const WANT: Record<string, Record<string, string>> = {
    "/women": {
      "Τακούνια": "/women?category=heels",
      "Μπότες & Μποτάκια": "/women?category=gynaikeia-boots",
      "Πέδιλα": "/women?category=sandals",
      "Sneakers": "/women?category=gynaikeia-sneakers",
      "Μοκασίνια & Loafers": "/women?category=gynaikeia-loafers",
    },
    "/men": {
      "Oxfords & Derbies": "/men?category=oxfords",
      "Sneakers": "/men?category=andrika-sneakers",
      "Μποτάκια": "/men?category=andrika-boots",
      "Μοκασίνια & Loafers": "/men?category=andrika-loafers",
    },
  };

  const row = await prisma.siteContent.findUnique({ where: { key: "navigation" } });
  if (!row) { note("  ! navigation row not found — menu not updated"); return; }

  const data = JSON.parse(JSON.stringify(row.data)) as {
    primary: { label: string; href: string; children?: { label: string; href: string }[] }[];
  };

  let changed = 0;
  for (const item of data.primary) {
    const wanted = WANT[item.href];
    if (!wanted) continue;
    for (const child of item.children ?? []) {
      const href = wanted[child.label];
      if (!href || child.href === href) continue;
      const from = child.href === "" ? "(empty)" : child.href;
      note(`  n ${item.label} > ${child.label}: ${from} -> ${href}`);
      child.href = href;
      changed++;
    }
  }

  if (changed === 0) { note("  = navigation already correct"); return; }
  if (APPLY) {
    await prisma.siteContent.update({ where: { key: "navigation" }, data: { data } });
  }
}
/** Prints the resulting tree and flags any product whose gender disagrees with its branch. */
async function report() {
  const cats = await prisma.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
  const byId = new Map(cats.map((c) => [c.id, c]));
  const counts = await prisma.product.groupBy({ by: ["categoryId", "gender"], _count: { _all: true } });

  const genderOf = new Map<string, string>();
  for (const p of PARENTS) {
    const row = cats.find((c) => c.slug === p.slug);
    if (row) genderOf.set(row.id, p.slug === "gynaikeia" ? "women" : "men");
  }

  for (const parent of cats.filter((c) => !c.parentId)) {
    console.log(`\n  ${parent.nameEl ?? parent.name} (${parent.slug})${parent.isVisible ? "" : "  [hidden]"}`);
    for (const child of cats.filter((c) => c.parentId === parent.id)) {
      const rows = counts.filter((c) => c.categoryId === child.id);
      const total = rows.reduce((a, r) => a + r._count._all, 0);
      const breakdown = rows.map((r) => `${r.gender} ${r._count._all}`).join(", ");
      console.log(`      ${String(total).padStart(3)}  ${(child.nameEl ?? child.name).padEnd(22)} ${child.slug.padEnd(20)} ${breakdown}`);
    }
  }

  let mismatched = 0;
  for (const row of counts) {
    const cat = byId.get(row.categoryId);
    if (!cat?.parentId) continue;
    const expected = genderOf.get(cat.parentId);
    if (expected && row.gender !== expected) {
      console.log(`\n  ! ${row._count._all} product(s) with gender="${row.gender}" sit under the ${expected} branch (${cat.slug})`);
      mismatched += row._count._all;
    }
  }
  console.log(mismatched === 0 ? "\n  Every product's gender matches the branch it sits in." : `\n  ${mismatched} product(s) disagree — Product.gender is the source of truth; fix these in the admin.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
