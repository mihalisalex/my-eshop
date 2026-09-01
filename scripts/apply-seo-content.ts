/**
 * Fills in the catalogue's SEO data from what the catalogue already knows about itself.
 *
 * Run:  npx tsx scripts/apply-seo-content.ts --dry-run
 *       npx tsx scripts/apply-seo-content.ts
 *
 * Re-runnable and idempotent. Prints before/after for every change, and never touches a
 * field an admin has already written by hand — see `keepExisting` below.
 *
 * ── What this does NOT do, and why ──────────────────────────────────────────────────────
 *
 * It does not write "trend-based" copy. There is no Search Console connected and no keyword
 * data in this project, so any claim about what is trending would be invented and then
 * baked into 175 pages. Everything below is derived from data that is verifiably in the
 * database: the brand in a product's own name, the material named in its own description,
 * its real sizes, its real price.
 *
 * It does not write Greek and English versions of the same sentence, and it does not salt
 * English keywords into Greek text. Both are keyword stuffing, and on a shop whose customers
 * and content are Greek they would cost rankings rather than win them. What it DOES do is
 * write Greek that carries the English loanwords Greek footwear shoppers actually type —
 * sneakers, loafers, oxfords, mules, boots — because that is genuinely how the vocabulary
 * works here, and because this shop's own categories are already named that way
 * (`Ανδρικά Sneakers`, `Γυναικεία Loafers`). Filter tags stay English slugs, matching the
 * ones already in use (`slippers`, `large-sizes`, `anatomical`).
 *
 * The product descriptions are COMPOSED from real attributes, not authored. That is an
 * honest description of what they are: better than the 113 thin or truncated ones they
 * replace, unique per product because the attributes differ, and truthful — but not a
 * substitute for a human writing the best sellers properly. The categories, which are only
 * nine and carry most of the traffic, are hand-written.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Re-derive the generated fields even where a value is already stored.
 *
 * Needed because the ordinary behaviour is "never overwrite" — which is right for protecting
 * an owner's edits, and wrong when a bug in THIS script has already written something. It
 * was needed exactly once, for a code pattern (`TR-1 S`) that a first version left dangling
 * on the end of five titles.
 *
 * Use it only when nobody has hand-edited SEO yet, because it cannot tell a generated value
 * from an authored one. Once the admin has been used in anger, fix mistakes there instead.
 */
const OVERWRITE = process.argv.includes("--overwrite");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }),
});

// ---------------------------------------------------------------------------
// Extraction — every rule below reads something the product already states.
// ---------------------------------------------------------------------------

/**
 * Brands, longest-first so "Mont Martre Paris" wins over "Mont Martre" and
 * "Alexandris Leather" is not mistaken for a different label than "Alexandris Shoes".
 * 125 of 175 products name their brand in their own title; the rest are unbranded stock
 * and are left with no brand rather than being assigned one.
 */
const BRANDS: { match: string[]; brand: string }[] = [
  { match: ["u.s polo assn", "u.s. polo assn", "us polo assn", "us polo"], brand: "U.S. Polo Assn." },
  { match: ["mont martre paris", "mont martre"], brand: "Mont Martre Paris" },
  { match: ["alexandris shoes", "alexandris leather", "αλεξανδρής"], brand: "Alexandris Shoes" },
  { match: ["verde"], brand: "Verde" },
  { match: ["london"], brand: "London" },
];

function extractBrand(name: string): string | null {
  const haystack = name.toLowerCase();
  for (const entry of BRANDS) {
    if (entry.match.some((needle) => haystack.includes(needle))) return entry.brand;
  }
  return null;
}

/**
 * Materials, as the shop's own descriptions name them, mapped to one canonical Greek label
 * each. Order matters: "οικολογικό δέρμα" and "eco leather" must be tested before the bare
 * "δέρμα" they contain, or every vegan shoe would be labelled leather.
 */
const MATERIALS: { match: string[]; label: string }[] = [
  { match: ["eco leather", "οικ. δέρμα", "οικολογικό δέρμα", "δερματίνη", "δερματίν"], label: "Οικολογικό δέρμα" },
  { match: ["vegan"], label: "Vegan" },
  { match: ["καστόρι", "suede"], label: "Καστόρι" },
  { match: ["γνήσιο δέρμα", "δερμάτιν", "leather", "δέρμα"], label: "Δέρμα" },
  { match: ["ύφασμα", "textile"], label: "Ύφασμα" },
];

/** Phrases that only ever describe real leather, never the synthetic kind. */
const REAL_LEATHER_MARKERS = ["γνήσιο δέρμα", "δερμάτιν", "leather boots", "φυσικό δέρμα"];

function extractMaterials(text: string): string[] {
  const haystack = text.toLowerCase();
  const found: string[] = [];
  for (const entry of MATERIALS) {
    if (entry.match.some((needle) => haystack.includes(needle)) && !found.includes(entry.label)) {
      found.push(entry.label);
    }
  }

  /**
   * "Οικ. δέρμα" and "δερματίνη" both CONTAIN the word δέρμα, so a naive pass labels every
   * vegan shoe as leather as well — which is not a cosmetic bug, it is telling a customer a
   * synthetic shoe is real leather.
   *
   * Real leather is therefore kept only when something says so explicitly. "VEGAN / Οικ.
   * δέρμα", which is how most of these descriptions are written, resolves to eco alone.
   */
  if (found.includes("Οικολογικό δέρμα")) {
    const hasRealLeather = REAL_LEATHER_MARKERS.some((marker) => haystack.includes(marker));
    return found.filter((m) => m !== "Vegan" && (m !== "Δέρμα" || hasRealLeather));
  }
  return found;
}

/**
 * Filter facets, as English slugs — the convention already in the database (`slippers`,
 * `large-sizes`, `anatomical`, `boat-shoes`). These drive the PLP filter sidebar, so they
 * are values a shopper picks from a list rather than prose.
 */
const TAG_RULES: { match: string[]; tag: string }[] = [
  { match: ["sneaker"], tag: "sneakers" },
  { match: ["loafer", "μοκασ"], tag: "loafers" },
  { match: ["πέδιλ", "πεδιλ", "sandal"], tag: "sandals" },
  { match: ["μπότ", "μποτάκ", "boot"], tag: "boots" },
  { match: ["mule", "παντόφλ", "slipper"], tag: "slippers" },
  { match: ["oxford"], tag: "oxfords" },
  { match: ["derby"], tag: "derby" },
  { match: ["γόβ", "στιλέτο"], tag: "heels" },
  { match: ["ανατομικ"], tag: "anatomical" },
  { match: ["δίσολ", "πλατφόρμ", "flatform"], tag: "platform" },
  { match: ["στρας"], tag: "embellished" },
  { match: ["cowboy"], tag: "cowboy" },
];

const MATERIAL_TAGS: Record<string, string> = {
  "Δέρμα": "leather",
  "Οικολογικό δέρμα": "eco-leather",
  "Καστόρι": "suede",
  "Ύφασμα": "textile",
  Vegan: "vegan",
};

function extractTags(name: string, description: string, materials: string[]): string[] {
  const haystack = `${name} ${description}`.toLowerCase();
  const tags = new Set<string>();
  for (const rule of TAG_RULES) {
    if (rule.match.some((needle) => haystack.includes(needle))) tags.add(rule.tag);
  }
  for (const material of materials) {
    const tag = MATERIAL_TAGS[material];
    if (tag) tags.add(tag);
  }
  return [...tags];
}

/**
 * The product code is useful in the shop and useless in a search result — it is 12-16
 * characters of a title that Google already truncates. Stripped for the SEO title only;
 * the product's actual name is left alone, because staff search for that code.
 */
function cleanTitle(name: string): string {
  return (
    name
      /**
       * The code is not always last: several names read "… – κωδικός 325 - Μπλε", where the
       * colour after it is worth keeping. So the code is removed wherever it sits, along
       * with whichever dash introduced it.
       *
       * The code itself is not always one token either — real ones here include `TR-1 S`,
       * `4787-1`, `OC-01` and `WC-11501`. A pattern that stopped at the first hyphen left
       * "-1 S" dangling on the end of a title, which is how this was found. So hyphen-joined
       * segments are consumed, plus one trailing single Latin capital (the `S` in `TR-1 S`).
       *
       * A trailing " - Μπλε" survives because the space before its dash is not part of the
       * code, and because a lone Greek word is not a single Latin capital.
       */
      .replace(/\s*[-–—]?\s*κωδικ[όο]ς\s*[\w\dΑ-Ωα-ωίϊΐόάέύϋΰήώ]+(?:[-–][\w\d]+)*(?:\s+[A-Z]\b)?/gi, "")
      .replace(/\s*[-–—]\s*[-–—]\s*/g, " - ")
      .replace(/^\s*[-–—]\s*/, "")
      .replace(/\s*[-–—]\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

const HEEL_PATTERN = /ύψος\s*τακουνιού\s*:?\s*([\d.,]+)\s*(?:cm|εκ)/i;

/** Returns "4" or "1,5" — the unit and the sentence's full stop are the caller's business. */
function extractHeel(description: string): string | null {
  const match = description.match(HEEL_PATTERN);
  return match ? match[1].replace(".", ",").replace(/,$/, "") : null;
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/**
 * A meta description built from what the product actually is.
 *
 * Deliberately concrete: style and colour from the name, material and heel height from the
 * description, the real size run, and one true delivery fact. No adjectives the shop cannot
 * stand behind, and nothing about quality or craftsmanship that the catalogue does not
 * evidence — this shop has already had invented provenance copy removed once.
 */
function composeDescription(input: {
  title: string;
  materials: string[];
  heel: string | null;
  sizes: string[];
  categoryLabel: string;
}): string {
  const parts: string[] = [`${input.title}.`];

  if (input.materials.length) parts.push(`Υλικό: ${input.materials.join(" / ")}.`);
  if (input.heel) parts.push(`Ύψος τακουνιού ${input.heel} εκ.`);

  const numeric = input.sizes.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (numeric.length >= 2) parts.push(`Νούμερα ${numeric[0]}–${numeric[numeric.length - 1]}.`);
  else if (numeric.length === 1) parts.push(`Νούμερο ${numeric[0]}.`);

  parts.push(`${input.categoryLabel} με αποστολή σε 3–5 εργάσιμες.`);

  const composed = parts.join(" ").replace(/\s{2,}/g, " ").trim();
  // Trimmed at a word boundary rather than mid-word if the attributes ran long.
  if (composed.length <= 158) return composed;
  const cut = composed.slice(0, 158);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
}

/** What a product of this category IS, for the closing clause of its description. */
const CATEGORY_LABEL: Record<string, string> = {
  sandals: "Γυναικεία πέδιλα",
  heels: "Παπούτσια με τακούνι",
  "andrika-sneakers": "Ανδρικά sneakers",
  "andrika-loafers": "Ανδρικά loafers",
  "gynaikeia-boots": "Γυναικείες μπότες",
  oxfords: "Ανδρικά oxfords",
  "gynaikeia-loafers": "Γυναικεία loafers",
  "gynaikeia-sneakers": "Γυναικεία sneakers",
  "andrika-boots": "Ανδρικά μποτάκια",
};

// ---------------------------------------------------------------------------
// Categories — hand-written. Nine pages carry most of the traffic, so these are
// authored rather than composed, and every factual claim is checkable against the
// catalogue: price ranges, size runs and materials were read from the database.
// ---------------------------------------------------------------------------

interface CategoryContent {
  title: string;
  description: string;
  introContent: string;
  faqs?: { question: string; answer: string }[];
}

const CATEGORY_CONTENT: Record<string, CategoryContent> = {
  sandals: {
    title: "Γυναικεία Πέδιλα",
    description:
      "Γυναικεία πέδιλα σε νούμερα 36–41, από 24,90 €. Επίπεδα και με τακούνι, σε δέρμα και οικολογικό δέρμα. Αποστολή σε 3–5 εργάσιμες.",
    introContent:
      "Τα πέδιλα είναι η μεγαλύτερη κατηγορία του καταστήματος — πάνω από πενήντα σχέδια, από απλά επίπεδα για την καθημερινότητα μέχρι πέδιλα με τακούνι και στρας για το βράδυ.\n\nΘα βρείτε δέρμα και οικολογικό δέρμα, σε νούμερα 36 έως 41. Αν ψάχνετε κάτι για όλη μέρα, δείτε τα μοντέλα με ανατομικό πάτο· για εμφάνιση, τα πέδιλα με μπαρέτα και τα κοσμηματένια σχέδια.",
    faqs: [
      {
        question: "Σε ποια νούμερα υπάρχουν τα πέδιλα;",
        answer: "Τα γυναικεία πέδιλα καλύπτουν τα νούμερα 36 έως 41. Το διαθέσιμο εύρος φαίνεται στη σελίδα κάθε προϊόντος.",
      },
      {
        question: "Από τι υλικό είναι;",
        answer:
          "Ανάλογα με το μοντέλο: γνήσιο δέρμα ή οικολογικό δέρμα (vegan). Το υλικό αναγράφεται στην περιγραφή κάθε πέδιλου.",
      },
    ],
  },
  heels: {
    title: "Παπούτσια με Τακούνι",
    description:
      "Γυναικεία παπούτσια με τακούνι: γόβες, mules και πέδιλα με τακούνι, σε νούμερα 36–41. Τιμές από 37,90 €, αποστολή σε 3–5 εργάσιμες.",
    introContent:
      "Γόβες, mules και σχέδια με τακούνι για δουλειά, γάμο ή έξοδο. Τα ύψη ξεκινούν από 1,5 εκατοστό και φτάνουν τα 8 — το ακριβές ύψος αναγράφεται σε κάθε προϊόν, ώστε να ξέρετε τι παίρνετε πριν παραγγείλετε.\n\nΑν φοράτε τακούνι όλη μέρα, κοιτάξτε τα χαμηλότερα ύψη και τα μοντέλα με πιο φαρδύ τακούνι· είναι αισθητά πιο άνετα από ένα στιλέτο.",
    faqs: [
      {
        question: "Πόσο ψηλά είναι τα τακούνια;",
        answer:
          "Από 1,5 έως 8 εκατοστά, ανάλογα με το μοντέλο. Το ύψος τακουνιού αναγράφεται στην περιγραφή κάθε προϊόντος.",
      },
    ],
  },
  "andrika-sneakers": {
    title: "Ανδρικά Sneakers",
    description:
      "Ανδρικά sneakers σε νούμερα 40–47, από 49 €. U.S. Polo Assn., Alexandris Shoes και άλλα, σε δέρμα και οικολογικό δέρμα.",
    introContent:
      "Ανδρικά sneakers για καθημερινή χρήση, σε δέρμα και οικολογικό δέρμα. Στην κατηγορία θα βρείτε τόσο τα δικά μας σχέδια Alexandris Shoes όσο και μάρκες όπως U.S. Polo Assn.\n\nΤα νούμερα ξεκινούν από το 40 και φτάνουν το 47. Αν χρειάζεστε μεγάλο νούμερο, φιλτράρετε με την ετικέτα large-sizes.",
  },
  "andrika-loafers": {
    title: "Ανδρικά Loafers & Μοκασίνια",
    description:
      "Ανδρικά loafers και μοκασίνια σε δέρμα, νούμερα 40–46. Τιμές από 49 €, με ανατομικό πάτο σε επιλεγμένα σχέδια.",
    introContent:
      "Loafers και μοκασίνια χωρίς κορδόνια, για γραφείο και για έξοδο. Αρκετά σχέδια έχουν ανατομικό πάτο, που κάνει διαφορά αν είστε όρθιοι πολλές ώρες.\n\nΤα δερμάτινα μοντέλα Alexandris Shoes κατασκευάζονται σε κλασικές γραμμές που δεν παλιώνουν· τα boat shoes είναι η πιο ανάλαφρη επιλογή για το καλοκαίρι.",
  },
  "gynaikeia-boots": {
    title: "Γυναικείες Μπότες & Μποτάκια",
    description:
      "Γυναικείες μπότες και μποτάκια σε νούμερα 36–41, από 39,90 €. Δέρμα και οικολογικό δέρμα, σχέδια cowboy και κλασικά.",
    introContent:
      "Μπότες και μποτάκια για τον χειμώνα, από κλασικά μαύρα μέχρι σχέδια cowboy με μυτερή σόλα.\n\nΤο υλικό — δέρμα ή οικολογικό δέρμα — αναγράφεται σε κάθε προϊόν. Για καθημερινή χρήση σε πόλη, τα χαμηλά μποτάκια με φαρδύ τακούνι είναι η πιο πρακτική επιλογή.",
  },
  oxfords: {
    title: "Oxfords",
    description:
      "Δερμάτινα oxfords σε νούμερα 40–46, από 59 €. Κλασικά δετά παπούτσια για γραφείο, γάμο και επίσημες εμφανίσεις.",
    introContent:
      "Κλασικά δετά παπούτσια, στα υλικά και τις γραμμές που αντέχουν στον χρόνο. Είναι η επιλογή για γάμο, βάφτιση ή γραφείο όπου το ντύσιμο είναι επίσημο.\n\nΌλα τα μοντέλα της κατηγορίας είναι δερμάτινα. Με φροντίδα — βερνίκι και τακούνια όταν χρειαστεί — κρατούν χρόνια.",
  },
  "gynaikeia-loafers": {
    title: "Γυναικεία Loafers",
    description:
      "Γυναικεία loafers και μοκασίνια σε νούμερα 36–41, από 37,90 €. Επίπεδα σχέδια σε δέρμα, καστόρι και οικολογικό δέρμα.",
    introContent:
      "Επίπεδα loafers για κάθε μέρα — η άνετη εναλλακτική στη γόβα, χωρίς να χάνετε σε εμφάνιση.\n\nΘα βρείτε δέρμα, καστόρι και οικολογικό δέρμα. Τα σχέδια με ανατομικό πάτο είναι αυτά που αντέχουν σε πολύωρο περπάτημα.",
  },
  "gynaikeia-sneakers": {
    title: "Γυναικεία Sneakers",
    description:
      "Γυναικεία sneakers σε νούμερα 36–41, από 29,90 €. Δίσολα και κλασικά σχέδια, αρκετά με ανατομικό πάτο.",
    introContent:
      "Γυναικεία sneakers για καθημερινή χρήση, από κλασικά χαμηλά μέχρι δίσολα σχέδια που προσθέτουν ύψος.\n\nΑρκετά μοντέλα έχουν ανατομικό πάτο. Αν περπατάτε πολύ, είναι το πρώτο πράγμα που θα κοιτούσαμε.",
  },
  "andrika-boots": {
    title: "Ανδρικά Μποτάκια",
    description: "Ανδρικά δερμάτινα μποτάκια σε νούμερα 40–46, από 59 €. Σχέδια derby και κλασικά, για χειμώνα.",
    introContent:
      "Δερμάτινα μποτάκια για τον χειμώνα, σε σχέδια derby και κλασικές γραμμές. Μικρή αλλά επιλεγμένη κατηγορία — τα μοντέλα που κρατάμε είναι αυτά που φοριούνται και με τζιν και με παντελόνι.",
  },
};

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

interface SeoOverride {
  title?: string;
  description?: string;
  introContent?: string;
  faqs?: { question: string; answer: string }[];
  [key: string]: unknown;
}

/**
 * Never overwrite a value a human wrote.
 *
 * This script is re-runnable, and a re-run must not undo the owner's edits — which is the
 * whole reason the generated values live in the `seo` override rather than replacing the
 * product's own name and description. Existing keys win; missing ones get filled.
 */
function keepExisting(existing: SeoOverride | null, generated: SeoOverride): SeoOverride {
  const merged: SeoOverride = { ...(existing ?? {}) };
  for (const [key, value] of Object.entries(generated)) {
    if (OVERWRITE) {
      merged[key] = value;
      continue;
    }
    const current = merged[key];
    const isEmpty =
      current === undefined ||
      current === null ||
      (typeof current === "string" && current.trim() === "") ||
      (Array.isArray(current) && current.length === 0);
    if (isEmpty) merged[key] = value;
  }
  return merged;
}

async function applyCategories() {
  const categories = await prisma.category.findMany({ where: { isVisible: true } });
  let changed = 0;

  for (const category of categories) {
    const content = CATEGORY_CONTENT[category.slug];
    if (!content) {
      console.log(`  skip   ${category.slug} — no authored content (hidden or new category)`);
      continue;
    }

    const existing = (category.seo as SeoOverride | null) ?? null;
    const next = keepExisting(existing, {
      title: content.title,
      description: content.description,
      introContent: content.introContent,
      ...(content.faqs ? { faqs: content.faqs } : {}),
    });

    if (JSON.stringify(existing) === JSON.stringify(next)) {
      console.log(`  same   ${category.slug}`);
      continue;
    }

    console.log(`  WRITE  ${category.slug}`);
    console.log(`         title:  ${existing?.title ?? "(none)"}  ->  ${next.title}`);
    console.log(`         intro:  ${(existing?.introContent as string | undefined)?.length ?? 0} chars -> ${(next.introContent as string).length} chars`);
    changed += 1;

    if (!DRY_RUN) {
      await prisma.category.update({ where: { id: category.id }, data: { seo: next as never } });
    }
  }

  return changed;
}

async function applyProducts() {
  const products = await prisma.product.findMany({
    where: { status: "active" },
    include: { sizes: true, category: true },
  });

  let changed = 0;
  const stats = { brand: 0, materials: 0, tags: 0, seo: 0 };
  /**
   * Composed descriptions must still come out unique, or this script would be manufacturing
   * exactly the duplicate-description problem the audit exists to report. Collected here so
   * a dry run says so BEFORE anything is written.
   */
  const descriptionUses = new Map<string, string[]>();

  /**
   * The product code is noise in a search result — except where it is the only thing telling
   * two products apart.
   *
   * Eleven products here share a name and differ only by their code: "…μποτάκια cowboy με
   * μυτερή σόλα - κωδικός 8888" and "- κωδικός 8886". Stripping it from both gives them one
   * title and one description between them, which is precisely the duplicate-title problem
   * the audit reports as high severity. So the code is stripped by default and kept for the
   * ones that need it, decided in a first pass over the whole catalogue.
   */
  const cleanedCounts = new Map<string, number>();
  for (const product of products) {
    const cleaned = cleanTitle(product.name);
    cleanedCounts.set(cleaned, (cleanedCounts.get(cleaned) ?? 0) + 1);
  }

  for (const product of products) {
    const cleaned = cleanTitle(product.name);
    const title = (cleanedCounts.get(cleaned) ?? 0) > 1 ? product.name.trim().replace(/\s{2,}/g, " ") : cleaned;
    const materials = extractMaterials(`${product.name} ${product.description}`);
    const brand = extractBrand(product.name);
    const tags = extractTags(product.name, product.description, materials);
    const heel = extractHeel(product.description);

    const description = composeDescription({
      title,
      materials,
      heel,
      sizes: product.sizes.map((size) => size.name),
      categoryLabel: CATEGORY_LABEL[product.category.slug] ?? "Παπούτσια",
    });

    const existingSeo = (product.seo as SeoOverride | null) ?? null;
    const nextSeo = keepExisting(existingSeo, { title, description });

    const finalDescription = String(nextSeo.description ?? "");
    descriptionUses.set(finalDescription, [...(descriptionUses.get(finalDescription) ?? []), product.name]);

    // Existing tags are preserved and merged rather than replaced — `sale` and
    // `large-sizes` are merchandising decisions this script knows nothing about.
    const nextTags = [...new Set([...product.tags, ...tags])].sort();

    const data: Record<string, unknown> = {};
    if (!product.brand && brand) {
      data.brand = brand;
      stats.brand += 1;
    }
    if (product.materials.length === 0 && materials.length > 0) {
      data.materials = materials;
      stats.materials += 1;
    }
    if (nextTags.join(",") !== [...product.tags].sort().join(",")) {
      data.tags = nextTags;
      stats.tags += 1;
    }
    if (JSON.stringify(existingSeo) !== JSON.stringify(nextSeo)) {
      data.seo = nextSeo;
      stats.seo += 1;
    }

    if (Object.keys(data).length === 0) continue;
    changed += 1;

    if (changed <= 8) {
      console.log(`  WRITE  ${product.name}`);
      if (data.brand) console.log(`         brand:     -> ${data.brand}`);
      if (data.materials) console.log(`         materials: -> ${(data.materials as string[]).join(", ")}`);
      if (data.tags) console.log(`         tags:      ${JSON.stringify(product.tags)} -> ${JSON.stringify(data.tags)}`);
      if (data.seo) {
        console.log(`         title:     -> ${nextSeo.title}`);
        console.log(`         meta (${(nextSeo.description as string).length}): ${nextSeo.description}`);
      }
    }

    if (!DRY_RUN) {
      await prisma.product.update({ where: { id: product.id }, data: data as never });
    }
  }

  if (changed > 8) console.log(`  … and ${changed - 8} more products (output truncated)`);

  const collisions = [...descriptionUses.entries()].filter(([, names]) => names.length > 1);
  if (collisions.length > 0) {
    console.log(`\n  WARNING — ${collisions.length} description(s) are not unique:`);
    for (const [description, names] of collisions.slice(0, 5)) {
      console.log(`    "${description.slice(0, 70)}…"`);
      for (const name of names) console.log(`      · ${name}`);
    }
    if (collisions.length > 5) console.log(`    … and ${collisions.length - 5} more`);
  }

  return { changed, stats, total: products.length, collisions: collisions.length };
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — nothing will be written\n" : "APPLYING changes\n");

  console.log("CATEGORIES");
  const categoriesChanged = await applyCategories();

  console.log("\nPRODUCTS");
  const products = await applyProducts();

  console.log("\nSUMMARY");
  console.log(`  categories updated:      ${categoriesChanged}`);
  console.log(`  products updated:        ${products.changed} of ${products.total}`);
  console.log(`    brand filled in:       ${products.stats.brand}`);
  console.log(`    materials filled in:   ${products.stats.materials}`);
  console.log(`    tags added:            ${products.stats.tags}`);
  console.log(`    seo title/description: ${products.stats.seo}`);
  console.log(`  duplicate descriptions:  ${products.collisions}`);
  if (DRY_RUN) console.log("\nRe-run without --dry-run to apply.");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
