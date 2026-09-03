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
import { detectBrand } from "../lib/seo/brands";
import {
  CATEGORY_LABEL,
  cleanProductTitle,
  composeImageAlt,
  composeProductDescription,
  extractHeel,
  extractMaterials,
} from "../lib/seo/product-content";

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
 * Brand detection lives in lib/seo/brands.ts, shared with the audit.
 *
 * They must agree: if the audit knows about a brand this script cannot extract, it reports
 * work that can never be done. That is how "U.S Grand polo equipment" was found — the audit
 * called it missing on seven products and the script had no pattern for it.
 *
 * 135 of 175 products name their brand in their own title. The remaining 40 are genuinely
 * unbranded or mixed-supplier stock, confirmed by the owner, and are deliberately left with
 * no brand rather than being assigned one.
 */
const extractBrand = detectBrand;

/**
 * Title cleaning, material and heel extraction, and the description itself all live in
 * lib/seo/product-content.ts, shared with the "Generate SEO" button in the admin product
 * form. Two implementations producing different text for the same product is the kind of
 * drift that makes an owner distrust both.
 */
const cleanTitle = cleanProductTitle;
const composeDescription = composeProductDescription;

/**
 * Filter facets, as English slugs — the convention already in the database (`slippers`,
 * `large-sizes`, `anatomical`, `boat-shoes`). These drive the PLP filter sidebar, so they
 * are values a shopper picks from a list rather than prose.
 *
 * Not in the shared module: the form has no tag editor, so only the bulk pass needs them.
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
  let imagesSet = 0;

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

    /**
     * Every visible category has no image at all — not a card image, not a banner — which
     * leaves the nav menus, the category grids and every social share of a category URL
     * with nothing to show.
     *
     * The image is taken from one of the category's own products. That invents nothing: a
     * category card showing something actually in that category is what every shop does,
     * and it is a far better answer than an empty box. Chosen deterministically (oldest
     * product with a photograph) so re-running does not shuffle the storefront around.
     *
     * The owner can replace any of these with real category photography whenever they like;
     * `keepExisting` means a re-run will not undo them.
     */
    let imageData: { src: string; alt: string } | null = null;
    if (!category.image) {
      const source = await prisma.product.findFirst({
        where: { categoryId: category.id, status: "active" },
        orderBy: { createdAt: "asc" },
        select: { images: true, name: true },
      });
      const first = ((source?.images as { src: string; alt: string }[] | null) ?? [])[0];
      if (first?.src) {
        imageData = { src: first.src, alt: `${content.title} — ${cleanTitle(source!.name)}` };
      }
    }

    const seoChanged = JSON.stringify(existing) !== JSON.stringify(next);
    if (!seoChanged && !imageData) {
      console.log(`  same   ${category.slug}`);
      continue;
    }

    console.log(`  WRITE  ${category.slug}`);
    if (seoChanged) {
      console.log(`         title:  ${existing?.title ?? "(none)"}  ->  ${next.title}`);
      console.log(`         intro:  ${(existing?.introContent as string | undefined)?.length ?? 0} chars -> ${(next.introContent as string).length} chars`);
    }
    if (imageData) {
      console.log(`         image:  (none) -> ${imageData.src.slice(0, 60)}…`);
      imagesSet += 1;
    }
    changed += 1;

    if (!DRY_RUN) {
      await prisma.category.update({
        where: { id: category.id },
        data: {
          ...(seoChanged ? { seo: next as never } : {}),
          ...(imageData ? { image: imageData as never } : {}),
        },
      });
    }
  }

  return { changed, imagesSet };
}

async function applyProducts() {
  const products = await prisma.product.findMany({
    where: { status: "active" },
    include: { sizes: true, category: true },
  });

  let changed = 0;
  const stats = { brand: 0, materials: 0, tags: 0, seo: 0, alt: 0 };
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

    /**
     * Images are rewritten only where the alt is still the imported boilerplate — the
     * product name, with or without a ", view N" suffix. Anything else is someone's own
     * writing and is left alone, the same rule the SEO overrides follow.
     */
    const images = (product.images as { src: string; alt: string }[] | null) ?? [];
    const boilerplate = (alt: string) =>
      alt.trim().toLowerCase().replace(/,\s*view\s*\d+$/i, "").trim() === product.name.trim().toLowerCase();

    const nextImages = images.map((image, index) =>
      boilerplate(image.alt ?? "")
        ? { ...image, alt: composeImageAlt({ title, brand, materials, index }) }
        : image
    );
    const altChanged = JSON.stringify(images) !== JSON.stringify(nextImages);

    const data: Record<string, unknown> = {};
    if (altChanged) {
      data.images = nextImages;
      stats.alt += 1;
    }
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
  const categories = await applyCategories();

  console.log("\nPRODUCTS");
  const products = await applyProducts();

  console.log("\nSUMMARY");
  console.log(`  categories updated:      ${categories.changed}`);
  console.log(`    category images set:   ${categories.imagesSet}`);
  console.log(`  products updated:        ${products.changed} of ${products.total}`);
  console.log(`    brand filled in:       ${products.stats.brand}`);
  console.log(`    materials filled in:   ${products.stats.materials}`);
  console.log(`    tags added:            ${products.stats.tags}`);
  console.log(`    seo title/description: ${products.stats.seo}`);
  console.log(`    image alt text:        ${products.stats.alt}`);
  console.log(`  duplicate descriptions:  ${products.collisions}`);
  if (DRY_RUN) console.log("\nRe-run without --dry-run to apply.");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
