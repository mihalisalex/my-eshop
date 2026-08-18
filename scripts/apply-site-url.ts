import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import seoFallback from "@/data/seo.json";
import type { SiteSeoDefaults } from "@/types";

/**
 * Writes the canonical site URL into the live `SiteContent` "seo" row.
 *
 * `data/seo.json` is only the fallback used when that row is missing. The running shop reads
 * the database, so editing the JSON alone changes nothing a visitor or a crawler sees — which
 * is exactly how `alexandris-demo.example` survived in every canonical tag, in robots.txt and
 * in all ~190 sitemap entries while the repo looked fine.
 *
 * Run it whenever the domain changes:
 *   npx tsx scripts/apply-site-url.ts https://example.com
 *   npx tsx scripts/apply-site-url.ts            # falls back to NEXT_PUBLIC_SITE_URL
 *
 * Set NEXT_PUBLIC_SITE_URL to the same value in the hosting environment. The two are read by
 * different things — this row drives canonicals, OG tags, robots.txt and the sitemap, while
 * the env var drives links inside emails sent from contexts with no incoming request (the
 * back-in-stock notification and the daily follow-up cron). A mismatch between them is not a
 * crash, it is emails pointing at a different host than the one Google is told about.
 *
 * Idempotent, and prints before/after so the change is visible rather than assumed.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// The declared interface, not `typeof` the JSON — with no social profiles seeded,
// `sameAs: []` infers as `never[]` and would make adding a real one a type error.
type SeoRow = SiteSeoDefaults;

function resolveTargetUrl(): string {
  const raw = process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) {
    throw new Error(
      "No URL given. Pass one as an argument or set NEXT_PUBLIC_SITE_URL:\n" +
        "  npx tsx scripts/apply-site-url.ts https://example.com",
    );
  }

  // Parsed rather than string-checked so a typo fails here instead of becoming a canonical
  // tag on every page. Trailing slash stripped because every consumer joins paths onto it.
  const parsed = new URL(raw);
  if (parsed.protocol !== "https:") {
    throw new Error(`Refusing to set a non-HTTPS canonical URL: ${raw}`);
  }
  return parsed.origin;
}

async function main() {
  const origin = resolveTargetUrl();

  const row = await prisma.siteContent.findUnique({ where: { key: "seo" } });
  const current = (row?.data as SeoRow | undefined) ?? (seoFallback as SeoRow);

  if (!row) {
    console.log('No "seo" row exists yet — seeding one from data/seo.json with the new URL.');
  }

  // The logo path is preserved and only its host swapped, so a logo that was moved or renamed
  // in the admin isn't quietly reset to whatever data/seo.json happens to say.
  const logoPath = (() => {
    try {
      return new URL(current.organization.logo).pathname;
    } catch {
      return current.organization.logo.startsWith("/") ? current.organization.logo : `/${current.organization.logo}`;
    }
  })();

  const next: SeoRow = {
    ...current,
    siteUrl: origin,
    organization: { ...current.organization, logo: `${origin}${logoPath}` },
  };

  console.log("Before:");
  console.log(`  siteUrl: ${current.siteUrl}`);
  console.log(`  logo:    ${current.organization.logo}`);

  await prisma.siteContent.upsert({
    where: { key: "seo" },
    update: { data: next as unknown as Prisma.InputJsonObject },
    create: { key: "seo", data: next as unknown as Prisma.InputJsonObject },
  });

  console.log("After:");
  console.log(`  siteUrl: ${next.siteUrl}`);
  console.log(`  logo:    ${next.organization.logo}`);
  console.log("\nDone. Redeploy (or wait for revalidation) for canonicals and the sitemap to pick it up.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
