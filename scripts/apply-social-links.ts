import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import settingsFallback from "@/data/settings.json";
import seoFallback from "@/data/seo.json";
import homepageFallback from "@/data/homepage.json";
import type { HomepageConfig, SiteSeoDefaults, SiteSettings, SocialLink } from "@/types";

/**
 * Syncs every social identity this shop claims, from `data/settings.json` into the three live
 * `SiteContent` rows that carry one.
 *
 * The same unverified handle had been copied into four places serving three audiences, and it
 * was wrong in all of them:
 *
 *   settings.socialLinks       the footer links, for people
 *   seo.organization.sameAs    Organization JSON-LD, for search engines
 *   seo.twitterHandle          the twitter:creator meta tag on EVERY page
 *   homepage socialGrid.handle the "@..." under the homepage "Follow Along" heading
 *
 * `sameAs` and `twitter:creator` are the strong claims — they state that those accounts ARE
 * this business. The seeded values (instagram.com/alexandris and friends, @alexandris) were
 * never verified as belonging to this trader, so they pointed customers at strangers' profiles
 * and told Google and X that the strangers were the shop. All four are now empty, which is the
 * honest state until real profiles exist.
 *
 * `data/settings.json` is the single source. The other three are DERIVED from it rather than
 * kept as separate copies, because four hand-maintained copies of one fact is how three of them
 * came to be wrong: the X handle comes from the `x` link and the homepage handle from the
 * `instagram` link, each reduced to its final path segment. Add the real profiles to that file
 * and re-run — everything else follows:
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
type HomepageRow = HomepageConfig;

/**
 * "https://instagram.com/alexandris" -> "@alexandris". Returns undefined when there is no such
 * profile, so the caller can drop the field entirely rather than render a bare "@".
 */
function handleFor(links: SocialLink[], platform: SocialLink["platform"]): string | undefined {
  const url = links.find((l) => l.platform === platform)?.url;
  if (!url) return undefined;
  const segment = new URL(url).pathname.split("/").filter(Boolean).pop();
  if (!segment) return undefined;
  return segment.startsWith("@") ? segment : `@${segment}`;
}

async function main() {
  const desiredLinks: SocialLink[] = (settingsFallback as SiteSettings).socialLinks;

  for (const link of desiredLinks) {
    // A malformed URL here would render as a dead footer link and an invalid sameAs entry,
    // neither of which surfaces as an error anywhere. Fail now instead.
    new URL(link.url);
  }

  const settingsRow = await prisma.siteContent.findUnique({ where: { key: "settings" } });
  const seoRow = await prisma.siteContent.findUnique({ where: { key: "seo" } });
  const homepageRow = await prisma.siteContent.findUnique({ where: { key: "homepage" } });

  const currentSettings = (settingsRow?.data as SettingsRow | undefined) ?? (settingsFallback as SettingsRow);
  const currentSeo = (seoRow?.data as SeoRow | undefined) ?? (seoFallback as SeoRow);
  const currentHomepage = (homepageRow?.data as HomepageRow | undefined) ?? (homepageFallback as HomepageRow);

  const xHandle = handleFor(desiredLinks, "x");
  const instagramHandle = handleFor(desiredLinks, "instagram");

  report("Before:", currentSettings, currentSeo, currentHomepage);

  // Only the social keys are touched. Everything else in these rows was edited through the
  // admin and must survive — the Greek tagline, the customised page titles and the homepage
  // section order all live here, and rewriting a whole row would silently revert them.
  const nextSettings: SettingsRow = { ...currentSettings, socialLinks: desiredLinks };

  const nextSeo: SeoRow = {
    ...currentSeo,
    organization: { ...currentSeo.organization, sameAs: desiredLinks.map((l) => l.url) },
    // Deleted rather than set to "" — buildMetadata passes it straight to `twitter.creator`,
    // and an empty string still emits the meta tag, just pointing at nobody.
    ...(xHandle ? { twitterHandle: xHandle } : {}),
  };
  if (!xHandle) delete (nextSeo as Partial<SeoRow>).twitterHandle;

  const nextHomepage: HomepageRow = {
    ...currentHomepage,
    sections: currentHomepage.sections.map((section) => {
      if (section.type !== "socialGrid") return section;
      const data = { ...section.data };
      if (instagramHandle) data.handle = instagramHandle;
      else delete data.handle;
      return { ...section, data };
    }),
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
  await prisma.siteContent.upsert({
    where: { key: "homepage" },
    update: { data: nextHomepage as unknown as Prisma.InputJsonObject },
    create: { key: "homepage", data: nextHomepage as unknown as Prisma.InputJsonObject },
  });

  report("After:", nextSettings, nextSeo, nextHomepage);
}

function report(label: string, settings: SettingsRow, seo: SeoRow, homepage: HomepageRow): void {
  const socialGrid = homepage.sections.find((s) => s.type === "socialGrid");
  console.log(label);
  console.log(`  settings.socialLinks:        ${describe(settings.socialLinks.map((l) => l.url))}`);
  console.log(`  seo.organization.sameAs:     ${describe(seo.organization.sameAs)}`);
  console.log(`  seo.twitterHandle:           ${seo.twitterHandle ?? "(none)"}`);
  console.log(`  homepage socialGrid.handle:  ${socialGrid?.data.handle ?? "(none)"}`);
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
