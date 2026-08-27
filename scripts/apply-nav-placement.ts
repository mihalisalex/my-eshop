import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { NavigationConfig } from "@/types";

/**
 * Marks the editorial links as mobile-only, so the desktop header stops carrying them.
 *
 * The header and the mobile menu render the SAME `navigation.primary` array, so shortening
 * one shortened both. `NavItem.mobileOnly` splits them: `DesktopNav` filters on it,
 * `MobileMenu` ignores it.
 *
 * Journal and About earn their place in a phone menu, where the list IS the navigation. On
 * desktop they compete with the five links that lead into the catalogue, on a homepage whose
 * job is to sell shoes.
 *
 * SAFE ONLY BECAUSE THE FOOTER ALREADY CARRIES BOTH — /journal as "Άρθρα" and /about as "Η
 * ιστορία μας", in the "Η εταιρεία" column. Hiding a link from the header with no other
 * desktop route to it would be removing it, not moving it. Check the footer before adding an
 * id here.
 *
 * Keyed by id, and applied to the live row and to data/navigation.json so a fresh seed agrees
 * with production. Idempotent.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Primary-nav ids to hide from the desktop header. */
const MOBILE_ONLY_IDS = new Set(["journal", "about"]);

let changes = 0;

function applyPlacement(source: unknown): NavigationConfig {
  const nav = JSON.parse(JSON.stringify(source)) as NavigationConfig;

  for (const item of nav.primary) {
    const shouldHide = MOBILE_ONLY_IDS.has(item.id);
    const currentlyHidden = item.mobileOnly === true;
    if (shouldHide === currentlyHidden) continue;

    if (shouldHide) {
      item.mobileOnly = true;
      console.log(`  ${item.id} ("${item.label}") -> mobile menu only`);
    } else {
      // Keeps the set authoritative: removing an id here puts the link back on desktop.
      delete item.mobileOnly;
      console.log(`  ${item.id} ("${item.label}") -> visible on desktop again`);
    }
    changes++;
  }

  return nav;
}

async function main() {
  const row = await prisma.siteContent.findUnique({ where: { key: "navigation" } });
  if (row) {
    console.log("Live navigation row:");
    const nav = applyPlacement(row.data);
    if (changes > 0) {
      await prisma.siteContent.update({
        where: { key: "navigation" },
        data: { data: nav as unknown as Prisma.InputJsonObject },
      });
    }
  } else {
    console.log('No "navigation" row — the JSON fallback is in use.');
  }

  const jsonPath = resolve(process.cwd(), "data/navigation.json");
  const before = changes;
  console.log("\ndata/navigation.json:");
  const fromJson = applyPlacement(JSON.parse(readFileSync(jsonPath, "utf8")));
  if (changes > before) writeFileSync(jsonPath, `${JSON.stringify(fromJson, null, 2)}\n`, "utf8");

  console.log(changes === 0 ? "\nNothing to change — already applied." : `\n${changes} item(s) updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
