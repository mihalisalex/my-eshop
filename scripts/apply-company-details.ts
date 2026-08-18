import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { COMPANY } from "@/constants/company";

/**
 * Writes the real trader contact details into the live `SiteContent` settings row.
 *
 * `data/settings.json` is only the fallback used when that row is missing — the running
 * shop reads the database, so editing the JSON alone changes nothing a customer sees.
 * That gap is exactly why the unreachable `hello@alexandris-demo.example` address
 * survived on the FAQ and Privacy pages for as long as it did.
 *
 * Idempotent, and prints before/after so the change is visible rather than assumed.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const dryRun = process.argv[2] === "--dry-run";

  const row = await prisma.siteContent.findUnique({ where: { key: "settings" } });
  if (!row) {
    console.log("No settings row — the JSON fallback is in use; nothing to update.");
    return;
  }

  const settings = row.data as Record<string, unknown>;
  console.log("before: contactEmail =", settings.contactEmail);

  settings.contactEmail = COMPANY.email;

  console.log("after:  contactEmail =", settings.contactEmail);

  if (dryRun) {
    console.log("\n(dry run — nothing written)");
    return;
  }

  await prisma.siteContent.update({
    where: { key: "settings" },
    data: { data: settings as Prisma.InputJsonObject },
  });
  console.log("\nsettings updated.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
