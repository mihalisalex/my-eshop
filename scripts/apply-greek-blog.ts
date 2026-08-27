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
  /**
   * REWRITTEN, not just translated. This post used to say that every ALEXANDRIS pair is made
   * by a small in-house team, "from the first cut of leather to the final polish". The
   * catalogue is 175 products: 47 are the shop's own Alexandris Shoes line and 128 are other
   * brands, so the claim was false for roughly three quarters of the shelf — and nothing in
   * the data supports in-house manufacture of the rest either.
   *
   * The replacement is about the thing a shop genuinely does and can stand behind: choosing
   * what to stock. It names the own line and the fact that other brands sit beside it, which
   * is verifiable, and claims nothing about who made the shoes or how.
   *
   * The SLUG stays "inside-the-atelier" even though the title no longer mentions one. It is a
   * URL, it is in the sitemap, and blog posts have no slug-history redirect the way categories
   * do — so renaming it would break the link to gain a tidier address.
   */
  "inside-the-atelier": {
    title: "Πώς διαλέγουμε τι μπαίνει στο ράφι",
    excerpt: "Τι κοιτάμε πριν ένα ζευγάρι μπει στη συλλογή μας.",
    content:
      "Στο κατάστημά μας στο Ηράκλειο θα βρείτε δύο πράγματα δίπλα δίπλα: τη δική μας σειρά, Alexandris Shoes, και μάρκες που διαλέγουμε ένα ζευγάρι τη φορά.\n\n" +
      "Το κριτήριο είναι πάντα το ίδιο — πώς πατάει, πώς εφαρμόζει, και αν θα αντέξει μια ολόκληρη σεζόν και την επόμενη. Ένα παπούτσι μπορεί να φαίνεται σωστό σε μια φωτογραφία και να μη στέκει στο πόδι· γι' αυτό τίποτα δεν μπαίνει στο ράφι πριν το δούμε από κοντά.\n\n" +
      "Δεν κυνηγάμε τον μεγαλύτερο δυνατό κατάλογο. Προτιμάμε λιγότερα ζευγάρια, για τα οποία μπορούμε να απαντήσουμε όταν μας ρωτήσετε.",
    tags: ["κατάστημα", "επιλογή"],
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

  console.log(changed === 0 ? "\nNothing to change — already applied." : `\n${changed} post(s) written.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
