import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Greek homepage copy — and the removal of claims the shop cannot support.
 *
 * Two separate problems, found together because they live in the same rows.
 *
 * 1. THE HOMEPAGE WAS STILL ENGLISH. Every section heading and the whole brand story, on the
 *    one page most visitors see first, after the rest of the site had been translated. It is
 *    section content in the `homepage` SiteContent row rather than a page file, which is why
 *    translating the routes missed it.
 *
 * 2. IT CLAIMED THINGS THAT ARE NOT TRUE. The live brand story read: "Every pair is developed
 *    in small batches with tanneries we've worked with for years." The catalogue is 175
 *    products, of which 47 are the shop's own "Alexandris Shoes" line and 128 are other
 *    brands — U.S Polo Assn., London, Verde, Mont Martre Paris. So "every pair" is false for
 *    roughly three quarters of the shelf, and the tanneries are a manufacturing claim nothing
 *    in the data supports. The hero made a smaller version of the same claim ("built on
 *    full-grain leather and honest construction") across a catalogue that includes synthetic
 *    athletic shoes.
 *
 * This is the same class of thing as the fabricated "N people bought this" counter and the
 * seeded social profiles that earlier passes removed: copy that reads as fact and isn't. It
 * matters more here than in the journal, because it is the shop describing itself.
 *
 * WHAT THE NEW COPY CLAIMS, and why each is safe: that ALEXANDRIS is a shoe shop in Heraklion
 * (the registered address), that it carries its own line alongside brands it selects (47 vs
 * 128, both verifiable from product names), and that it sells women's and men's shoes. It
 * claims nothing about manufacture, materials, tanneries or batch sizes.
 *
 * "Follow Along" became "Από το κατάστημα": the tiles have no link, because there are no
 * social profiles configured — a call to action with nowhere to go is its own small untruth.
 *
 * The two disabled sections are translated and corrected as well. Leaving false copy sitting
 * in a switched-off section only means it goes live the day someone switches it on.
 *
 * Keyed by section `type`, which is stable. Idempotent: writes only on a real difference.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** Patches applied per section type. Only the listed keys are touched. */
const SECTIONS: Record<string, Record<string, unknown>> = {
  hero: {
    eyebrow: "Φθινόπωρο / Χειμώνας 2026",
    headline: "Νέα σεζόν.\nΝέα βήματα.",
    // Was "New season shoes built on full-grain leather and honest construction." — a
    // materials claim across a catalogue that includes synthetic athletic shoes.
    subheadline: "Οι νέες παραλαβές σε γυναικεία και ανδρικά παπούτσια.",
  },
  featuredCollections: {
    title: "Οι συλλογές μας",
    subtitle: "Επιλογές για τη σεζόν",
  },
  newArrivals: {
    title: "Νέες αφίξεις",
    subtitle: "Μόλις παραλάβαμε",
  },
  brandStory: {
    eyebrow: "Ποιοι είμαστε",
    headline: "Διαλεγμένα ένα ένα.",
    body:
      "Το ALEXANDRIS είναι κατάστημα υποδημάτων στο Ηράκλειο της Κρήτης. Στα ράφια μας θα βρείτε " +
      "τη δική μας σειρά, Alexandris Shoes, μαζί με μάρκες που επιλέγουμε ένα ζευγάρι τη φορά — " +
      "γυναικεία και ανδρικά, για την καθημερινότητα και για τις πιο ιδιαίτερες μέρες.",
  },
  socialGrid: {
    // Not "Ακολουθήστε μας": the tiles are not links, because no social profiles are set.
    title: "Από το κατάστημα",
  },
  newsletter: {
    headline: "Μάθετε πρώτοι",
    subheadline: "Εγγραφείτε για να ενημερώνεστε για τις νέες παραλαβές και τις προσφορές μας.",
    ctaLabel: "Εγγραφή",
  },
  bestSellers: {
    // Deliberately still DISABLED — there is no sales history to base it on. Translated only
    // so it is not English the day it is switched on.
    title: "Τα πιο δημοφιλή",
    subtitle: "Τα ζευγάρια που ξεχωρίζουν",
  },
  editorialBanner: {
    // Also disabled. Body rewritten as advice rather than a claim about these products: it
    // said "Every pair starts with full-grain leather and a hand-finished edge."
    eyebrow: "Άρθρα",
    headline: "Τι κάνει ένα παπούτσι να αντέχει",
    body: "Από το δέρμα μέχρι τη σόλα — τι να προσέχετε όταν διαλέγετε ένα ζευγάρι που θέλετε να φοράτε για χρόνια.",
  },
};

/**
 * CTA labels live one level down, in differently-named objects per section (`primaryCta`,
 * `secondaryCta`, `cta`, `viewAllCta`). Keyed by the href they point at, which is stable and
 * unique here — patching a top-level `label` instead just adds a key nothing reads, which is
 * exactly the mistake this map exists to avoid repeating.
 */
const CTA_KEYS = ["primaryCta", "secondaryCta", "cta", "viewAllCta"] as const;

const CTA_LABELS: Record<string, string> = {
  "/women": "Γυναικεία",
  "/men": "Ανδρικά",
  "/about": "Σχετικά με εμάς",
  "/new-in": "Δείτε τα όλα",
  "/journal/the-art-of-the-oxford": "Διαβάστε το άρθρο",
};

/**
 * Keys an earlier version of this script wrote at the top level of a section, believing they
 * were the CTA label. Nothing reads them; they are removed so the row does not accumulate
 * fields that look meaningful and are not.
 */
const STRAY_TOP_LEVEL_KEYS: Record<string, string[]> = {
  brandStory: ["label"],
  bestSellers: ["label"],
};

async function main() {
  const row = await prisma.siteContent.findUnique({ where: { key: "homepage" } });
  if (!row) {
    console.log('No "homepage" row — nothing to do.');
    return;
  }

  // Cloned and patched rather than rebuilt, so product ids, collection ids, images and the
  // enabled flags all survive untouched.
  const homepage = JSON.parse(JSON.stringify(row.data)) as { sections: Record<string, unknown>[] };
  let changes = 0;

  for (const section of homepage.sections) {
    const patch = SECTIONS[section.type as string];
    const data = section.data as Record<string, unknown> | undefined;
    if (!patch || !data) continue;

    for (const [key, value] of Object.entries(patch)) {
      if (data[key] === value) continue;
      console.log(`  ${section.type}.${key}:`);
      console.log(`      was: ${String(data[key]).replace(/\n/g, " / ").slice(0, 96)}`);
      console.log(`      now: ${String(value).replace(/\n/g, " / ").slice(0, 96)}`);
      data[key] = value;
      changes++;
    }

    for (const ctaKey of CTA_KEYS) {
      const cta = data[ctaKey] as Record<string, unknown> | undefined;
      if (!cta) continue;
      const label = CTA_LABELS[cta.href as string];
      if (!label || cta.label === label) continue;
      console.log(`  ${section.type}.${ctaKey}.label: "${cta.label}" -> "${label}"`);
      cta.label = label;
      changes++;
    }

    for (const stray of STRAY_TOP_LEVEL_KEYS[section.type as string] ?? []) {
      if (!(stray in data)) continue;
      console.log(`  ${section.type}.${stray}: removed (stray key, nothing reads it)`);
      delete data[stray];
      changes++;
    }
  }

  if (changes === 0) {
    console.log("Nothing to change — already applied.");
    return;
  }

  await prisma.siteContent.update({
    where: { key: "homepage" },
    data: { data: homepage as unknown as Prisma.InputJsonObject },
  });
  console.log(`\n${changes} value(s) updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
