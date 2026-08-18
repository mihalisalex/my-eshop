import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import settingsFallback from "@/data/settings.json";
import seoFallback from "@/data/seo.json";
import type { SiteSeoDefaults, SiteSettings, SocialLink } from "@/types";

/**
 * Syncs the store's social profiles from `data/settings.json` into the two live
 * `SiteContent` rows that carry them.
 *
 * They live in two places for two different audiences, and they were wrong in both: the
 * footer renders `settings.socialLinks` for people, and the Organization JSON-LD emits
 * `seo.organization.sameAs` for search engines. `sameAs` is the stronger claim of the two —
 * it tells Google those accounts ARE this business. The four seeded values
 * (instagram.com/alexandris and friends) were never verified as belonging to this trader, so
 * they pointed customers at strangers' profiles and told Google those strangers were the shop.
 * They are now empty, which is the honest state until real URLs exist.
 *
 * `data/settings.json` is the single source: this script derives `sameAs` from the same list
 * rather than letting a second copy drift. To add the real profiles, edit that file and re-run:
 *   npx tsx scripts/apply-social-links.ts
 *
 * Idempotent, and prints before/after so the change is visible rather than assumed.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// The declared interfaces, not `typeof` the JSON. With the seeded profiles removed,
// `socialLinks: []` infers as `never[]`, so inferring the shape from the file would make
// putting a real link back a type error.
type SettingsRow = SiteSettings;
type SeoRow = SiteSeoDefaults;

async function main() {
  const desiredLinks: SocialLink[] = (settingsFallback as SiteSettings).socialLinks;

  for (const link of desiredLinks) {
    // A malformed URL here would render as a dead footer link and an invalid sameAs entry,
    // neither of which surfaces as an error anywhere. Fail now instead.
    new URL(link.url);
  }

  const settingsRow = await prisma.siteContent.findUnique({ where: { key: "settings" } });
  const seoRow = await prisma.siteContent.findUnique({ where: { key: "seo" } });

  const currentSettings = (settingsRow?.data as SettingsRow | undefined) ?? (settingsFallback as SettingsRow);
  const currentSeo = (seoRow?.data as SeoRow | undefined) ?? (seoFallback as SeoRow);

  console.log("Before:");
  console.log(`  settings.socialLinks:        ${describe(currentSettings.socialLinks.map((l) => l.url))}`);
  console.log(`  seo.organization.sameAs:     ${describe(currentSeo.organization.sameAs)}`);

  // Only these two keys are touched. Everything else in both rows was edited through the
  // admin and must survive — the Greek tagline and the customised page titles live here.
  const nextSettings: SettingsRow = { ...currentSettings, socialLinks: desiredLinks };
  const nextSeo: SeoRow = {
    ...currentSeo,
    organization: { ...currentSeo.organization, sameAs: desiredLinks.map((l) => l.url) },
  };

  await prisma.siteContent.upsert({
    where: { key: "settings" },
    update: { data: nextSettings as unknown as Prisma.InputJsonObject },
    create: { key: "settings", data: nextSettings as unknown as Prisma.InputJsonObject },
  });
  await prisma.siteContent.upsert({
    where: { key: "seo" },
    update: { data: nextSeo as unknown as Prisma.InputJsonObject },
    create: { key: "seo", data: nextSeo as unknown as Prisma.InputJsonObject },
  });

  console.log("After:");
  console.log(`  settings.socialLinks:        ${describe(nextSettings.socialLinks.map((l) => l.url))}`);
  console.log(`  seo.organization.sameAs:     ${describe(nextSeo.organization.sameAs)}`);
}

function describe(urls: string[]): string {
  return urls.length === 0 ? "(none)" : urls.join(", ");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
