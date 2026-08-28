import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import settingsFallback from "@/data/settings.json";
import type { SiteSettings } from "@/types";

/**
 * Rewrites the rotating announcement-bar messages in the live `SiteContent` "settings" row.
 *
 * Same trap as `scripts/apply-site-url.ts`: `data/settings.json` is only the fallback used
 * when that row is missing, so editing the JSON changes nothing a visitor sees. The bar sits
 * above the header on every page of the shop, which made it the most-viewed English text on
 * a Greek storefront — three messages, seen on every page view, for months.
 *
 *   npx tsx scripts/apply-greek-announcements.ts
 *
 * These messages are NOT in `messages/el.json`, deliberately. They are merchandising copy the
 * owner edits from the admin, not UI chrome — putting them in the locale files would mean a
 * code deploy to change a promotion. The consequence is that they do not follow the EN toggle;
 * that is the same trade already made for product names and navigation.
 *
 * Idempotent: prints before/after and writes only when the value actually differs.
 */
const GREEK_ANNOUNCEMENTS = [
  "Δωρεάν αποστολή για παραγγελίες άνω των 150 €",
  "Δωρεάν επιστροφές εντός 30 ημερών",
  "Νέα συλλογή — Φθινόπωρο/Χειμώνας 2026 τώρα διαθέσιμη",
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const row = await prisma.siteContent.findUnique({ where: { key: "settings" } });
  const current = (row?.data as unknown as SiteSettings | undefined) ?? (settingsFallback as SiteSettings);

  console.log("Before:");
  for (const m of current.announcementMessages ?? []) console.log(`  ${m}`);

  const next: SiteSettings = { ...current, announcementMessages: GREEK_ANNOUNCEMENTS };

  if (JSON.stringify(current.announcementMessages) === JSON.stringify(GREEK_ANNOUNCEMENTS)) {
    console.log("\nAlready Greek — nothing written.");
    return;
  }

  await prisma.siteContent.upsert({
    where: { key: "settings" },
    update: { data: next as unknown as Prisma.InputJsonObject },
    create: { key: "settings", data: next as unknown as Prisma.InputJsonObject },
  });

  console.log("\nAfter:");
  for (const m of GREEK_ANNOUNCEMENTS) console.log(`  ${m}`);
  console.log("\nDone. Redeploy or wait for revalidation for the bar to pick it up.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
