import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Greek translations of the four journal posts.
 *
 * Keyed by slug, which is the URL and is NOT translated — these are indexed pages.
 *
 * Tags are translated because they are display-only here: app/journal/[slug]/page.tsx renders
 * them as plain labels, with no tag filter and no tag in any URL. If a tag archive is ever
 * added, they become identifiers and this decision needs revisiting.
 *
 * BlogPost has no `*El` columns, so Greek replaces the canonical text — the same convention as
 * products and navigation, and for the same reason. See scripts/apply-greek-navigation.ts.
 *
 * Idempotent: writes only when a value actually differs.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

interface PostTranslation {
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
}

const AUTHOR = "Ομάδα ALEXANDRIS";

const POSTS: Record<string, PostTranslation> = {
  "the-art-of-the-oxford": {
    title: "Η τέχνη του oxford",
    excerpt: "Το ράψιμο στο χέρι και το φινίρισμα που ξεχωρίζουν ένα γνήσιο oxford από μια απομίμηση.",
    content:
      "Ένα σπουδαίο oxford ξεκινά από ένα ενιαίο κομμάτι δέρματος full-grain, κομμένο στο χέρι πάνω σε ξύλινο καλαπόδι. Όσα ακολουθούν — το κλειστό κορδόνιασμα, η φινιρισμένη στο χέρι άκρη, η δερμάτινη σόλα φτιαγμένη ώστε να αλλάζει αντί να πετιέται — είναι η διαφορά ανάμεσα σε ένα παπούτσι που φοράτε μια σεζόν και σε ένα που φοράτε μια δεκαετία.",
    tags: ["τεχνική", "oxfords"],
  },
  "caring-for-leather": {
    title: "Φροντίδα του δέρματος, σεζόν με σεζόν",
    excerpt: "Μια απλή ρουτίνα που κρατά το δέρμα full-grain σαν καινούργιο για χρόνια.",
    content:
      "Σκουπίστε κάθε ζευγάρι μετά τη χρήση, ενυδατώστε το δέρμα κάθε λίγους μήνες, και αφήνετε πάντα ένα βρεγμένο παπούτσι να στεγνώσει μακριά από άμεση θερμότητα. Λίγη φροντίδα, επαναλαμβανόμενη συχνά, κάνει περισσότερα για τη διάρκεια ζωής ενός παπουτσιού από οποιαδήποτε μεμονωμένη περιποίηση.",
    tags: ["φροντίδα", "δέρμα"],
  },
  "how-to-style-ankle-boots": {
    title: "Πώς να φορέσετε μποτάκια, με τρεις τρόπους",
    excerpt: "Από το κλασικό παντελόνι μέχρι το slip dress, η διακριτική ευελιξία του μποτακιού.",
    content:
      "Ένα μαύρο δερμάτινο μποτάκι είναι από τα λίγα ζευγάρια που περνούν πειστικά από το γραφείο, σε ένα δείπνο και σε ένα σαββατοκύριακο εκτός. Το κοντό παντελόνι κρατά τη σιλουέτα καθαρή· ένα slip dress αντιπαραθέτει τη δομή του μποτακιού με κάτι πιο απαλό.",
    tags: ["στυλ", "μπότες"],
  },
  "inside-the-atelier": {
    title: "Μέσα στο εργαστήριο",
    excerpt: "Μια ματιά στο μικρό εργαστήριο όπου ξεκινά κάθε ζευγάρι ALEXANDRIS.",
    content:
      "Κάθε ζευγάρι περνά από την ίδια μικρή ομάδα, από το πρώτο κόψιμο του δέρματος μέχρι το τελικό γυάλισμα. Είναι πιο αργό από μια γραμμή παραγωγής, και αυτό ακριβώς είναι το ζητούμενο.",
    tags: ["τεχνική", "εργαστήριο"],
  },
};

async function main() {
  let changed = 0;

  for (const [slug, want] of Object.entries(POSTS)) {
    const row = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true, title: true, excerpt: true, content: true, author: true, tags: true },
    });
    if (!row) {
      console.log(`  post "${slug}" not found — skipped`);
      continue;
    }

    const same =
      row.title === want.title &&
      row.excerpt === want.excerpt &&
      row.content === want.content &&
      row.author === AUTHOR &&
      row.tags.join("|") === want.tags.join("|");
    if (same) continue;

    await prisma.blogPost.update({
      where: { id: row.id },
      data: { title: want.title, excerpt: want.excerpt, content: want.content, author: AUTHOR, tags: want.tags },
    });
    console.log(`  ${slug}: "${row.title}" -> "${want.title}"`);
    changed++;
  }

  console.log(changed === 0 ? "\nNothing to change — already applied." : `\n${changed} post(s) translated.`);

  if (changed > 0) {
    console.log(
      '\nNOTE: "inside-the-atelier" states that every ALEXANDRIS pair is made by a small in-house\n' +
        "team. This catalogue is third-party brands (U.S Polo Assn., London, Verde, Mont Martre\n" +
        "Paris), so that reads as a manufacturing claim the shop may not be able to support.\n" +
        "Translating it did not create the problem — it was already live in English — but it is\n" +
        "now in the language the customer reads. Worth rewriting or unpublishing.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
