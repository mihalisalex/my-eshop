import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

/**
 * One-off merchandising pass: fills the four empty collections and switches the
 * homepage's product sections back on.
 *
 * Both were audit blockers (QA-009, QA-011) and neither is a code problem — the
 * storefront rendered exactly what it was told to. `/collections` listed five tiles, four
 * of which opened an empty listing, and the homepage had every commerce section disabled,
 * so it carried no product link and no price at all.
 *
 * Collections are mapped from the category each product already sits in, which is the
 * honest reading of their own titles and subtitles ("The Sneaker Edit", "Loafers and
 * slides for daily wear"). Re-runnable: membership is replaced rather than appended, so
 * running it twice is a no-op rather than a duplicate-key error.
 *
 * NOTE ON "BEST SELLERS": deliberately left disabled. There are two real payments in the
 * database, so any product list under that heading would be a claim about sales that
 * never happened — the same class of thing as the fabricated "N people bought this"
 * counter removed in 78b529f. Enable it once there is order history to derive it from.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** collection slug -> the category slugs whose products belong in it. */
const COLLECTION_SOURCES: Record<string, string[]> = {
  "sneaker-edit": ["sneakers"],
  "evening-heels": ["heels"],
  "boots-booties": ["boots"],
  "everyday-essentials": ["loafers", "sandals"],
};

/** How many of the newest products land in New Arrivals and the homepage strip. */
const NEW_ARRIVALS_SIZE = 24;
const HOMEPAGE_STRIP_SIZE = 8;

async function main() {
  const dryRun = process.argv[2] === "--dry-run";

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  // --- QA-011: populate the empty collections -----------------------------------------
  for (const [collectionSlug, categorySlugs] of Object.entries(COLLECTION_SOURCES)) {
    const collection = await prisma.collection.findUnique({ where: { slug: collectionSlug }, select: { id: true } });
    if (!collection) {
      console.log(`SKIP ${collectionSlug} — no such collection`);
      continue;
    }
    const categoryIds = categorySlugs.map((slug) => categoryIdBySlug.get(slug)).filter((id): id is string => Boolean(id));
    const products = await prisma.product.findMany({
      where: { categoryId: { in: categoryIds }, status: "active" },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    console.log(`${collectionSlug}: ${products.length} products (from ${categorySlugs.join(", ")})`);
    if (dryRun) continue;

    await prisma.$transaction([
      prisma.productCollection.deleteMany({ where: { collectionId: collection.id } }),
      prisma.productCollection.createMany({
        data: products.map((product, position) => ({ productId: product.id, collectionId: collection.id, position })),
      }),
    ]);
  }

  // New Arrivals gets the newest slice rather than a category, matching its own subtitle.
  const newest = await prisma.product.findMany({
    where: { status: "active" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: NEW_ARRIVALS_SIZE,
  });
  const newArrivals = await prisma.collection.findUnique({ where: { slug: "new-arrivals" }, select: { id: true } });
  if (newArrivals) {
    console.log(`new-arrivals: ${newest.length} products (newest)`);
    if (!dryRun) {
      await prisma.$transaction([
        prisma.productCollection.deleteMany({ where: { collectionId: newArrivals.id } }),
        prisma.productCollection.createMany({
          data: newest.map((product, position) => ({ productId: product.id, collectionId: newArrivals.id, position })),
        }),
      ]);
    }
  }

  // --- QA-009: switch the homepage's product sections back on --------------------------
  const row = await prisma.siteContent.findUnique({ where: { key: "homepage" } });
  if (!row) {
    console.log("SKIP homepage — no siteContent row");
    return;
  }
  const homepage = row.data as { sections: { id: string; type: string; enabled: boolean; data: Record<string, unknown> }[] };
  const stripIds = newest.slice(0, HOMEPAGE_STRIP_SIZE).map((product) => product.id);

  for (const section of homepage.sections) {
    switch (section.type) {
      case "featuredCollections":
        // The collectionIds here are c1–c5, which ARE the real ids — this section only
        // ever looked broken because every collection it pointed at was empty.
        section.enabled = true;
        break;
      case "newArrivals":
        section.data.productIds = stripIds;
        section.enabled = true;
        break;
      case "editorialBanner":
        section.enabled = true;
        break;
      case "bestSellers":
        // See the note at the top of this file.
        section.enabled = false;
        break;
      default:
        break;
    }
  }

  console.log(
    "homepage sections:",
    homepage.sections.map((s) => `${s.type}=${s.enabled ? "on" : "off"}`).join(" ")
  );
  if (!dryRun) {
    await prisma.siteContent.update({ where: { key: "homepage" }, data: { data: homepage as unknown as Prisma.InputJsonObject } });
  }

  if (dryRun) console.log("\n(dry run — nothing written)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
