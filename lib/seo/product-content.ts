/**
 * Composing a product's SEO title and meta description from what the product already
 * states about itself.
 *
 * Shared by the bulk script (scripts/apply-seo-content.ts) and the "Generate" button in the
 * admin product form. Those two producing different text for the same product is the kind
 * of drift that makes an owner distrust both — so there is one implementation and the
 * script imports it rather than keeping its own.
 *
 * No `server-only`: the admin form runs this in the browser.
 *
 * Everything here reads real attributes. Nothing invents adjectives, provenance or quality
 * claims — this shop has had fabricated copy removed from it twice.
 */

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

export function extractMaterials(text: string): string[] {
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
 * The product code is useful in the shop and useless in a search result — it is 12-16
 * characters of a title that Google already truncates. Stripped for the SEO title only;
 * the product's actual name is left alone, because staff search for that code.
 */
export function cleanProductTitle(name: string): string {
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
export function extractHeel(description: string): string | null {
  const match = description.match(HEEL_PATTERN);
  return match ? match[1].replace(".", ",").replace(/,$/, "") : null;
}

/** What a product of this category IS, for the closing clause of its description. */
export const CATEGORY_LABEL: Record<string, string> = {
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

export const DEFAULT_CATEGORY_LABEL = "Παπούτσια";

/**
 * A meta description built from what the product actually is.
 *
 * Deliberately concrete: style and colour from the name, material and heel height from the
 * description, the real size run, and one true delivery fact.
 */
export function composeProductDescription(input: {
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

// ---------------------------------------------------------------------------
// Body copy
//
// The product description a shopper reads, composed from what the product's own name and
// attributes say. Two rules govern everything below:
//
//   1. Only facts. Style, colour, material, construction and size range — all read from
//      the name or the form. No adjectives about quality, no provenance, no "crafted"
//      or "premium". This shop has had invented copy removed from it twice, and a
//      generator is exactly how it would come back at scale.
//   2. It has to read like a sentence, not a spec sheet. The spec sheet already exists in
//      the imported descriptions; if this produced another one it would be worth nothing.
// ---------------------------------------------------------------------------

/** The shoe styles this catalogue actually sells, detected from the product's own name. */
const STYLE_RULES: { match: string[]; style: string }[] = [
  { match: ["oxford"], style: "oxfords" },
  { match: ["derby"], style: "derby" },
  { match: ["cowboy"], style: "cowboy" },
  { match: ["sneaker"], style: "sneakers" },
  { match: ["loafer", "μοκασ"], style: "loafers" },
  { match: ["μποτάκ", "μπότ", "boot"], style: "boots" },
  { match: ["πέδιλ", "πεδιλ", "sandal"], style: "sandals" },
  { match: ["mule", "παντόφλ", "slipper"], style: "mules" },
  { match: ["γόβ", "στιλέτο"], style: "heels" },
];

/**
 * How each style opens its description.
 *
 * Descriptive of the product type rather than promotional — "a sandal for summer" is what
 * a sandal is, whereas "the perfect sandal for your summer" is a claim about the shopper.
 */
const STYLE_LEAD: Record<string, string> = {
  sneakers: "sneaker για καθημερινή χρήση",
  loafers: "loafer χωρίς κορδόνια",
  sandals: "πέδιλο για το καλοκαίρι",
  boots: "μποτάκι για τον χειμώνα",
  // Deliberately just "παντόφλα": this catalogue files both fashion mules and furry house
  // slippers under the same word, and calling a lined winter slipper an "open mule" would
  // be wrong about the product rather than merely vague about it.
  mules: "παντόφλα",
  heels: "παπούτσι με τακούνι",
  oxfords: "κλασικό δετό oxford",
  derby: "δετό παπούτσι derby",
  cowboy: "μποτάκι σε γραμμή cowboy",
};

const DEFAULT_LEAD = "παπούτσι";

/**
 * The style a category implies, for the products whose name does not say.
 *
 * «U.S Grand polo equipment μπεζ» names no style at all, but it sits in Ανδρικά Sneakers —
 * and which category a product is filed under is a fact, not a guess.
 */
const CATEGORY_STYLE: Record<string, string> = {
  sandals: "sandals",
  heels: "heels",
  "andrika-sneakers": "sneakers",
  "gynaikeia-sneakers": "sneakers",
  "andrika-loafers": "loafers",
  "gynaikeia-loafers": "loafers",
  "gynaikeia-boots": "boots",
  "andrika-boots": "boots",
  oxfords: "oxfords",
};

/** Construction details, taken only where the product's own name states them. */
const FEATURE_NOTES: { match: string[]; note: string }[] = [
  { match: ["ανατομικ"], note: "με ανατομικό πάτο" },
  { match: ["δίσολ", "πλατφόρμ", "flatform"], note: "σε δίσολη σόλα" },
  { match: ["στρας"], note: "με στρας" },
  { match: ["τοκά", "αγκράφα"], note: "με μεταλλική αγκράφα" },
  { match: ["φερμουάρ"], note: "με φερμουάρ" },
  { match: ["μυτερή"], note: "με μυτερή γραμμή" },
];

/**
 * Colour words as they appear inside product names, which are inflected — «Μαύρα δίσολα»,
 * «Μπεζ suede», «Πέδιλα χρυσά». Matched on the stem, and mapped to the same names the
 * colour swatches use (constants/product-colors.ts) so the description and the swatch
 * agree on what to call it.
 */
const COLOUR_STEMS: { stems: string[]; name: string }[] = [
  { stems: ["μαύρ", "μαυρ"], name: "μαύρο" },
  { stems: ["μπεζ"], name: "μπεζ" },
  { stems: ["καφέ", "καφε"], name: "καφέ" },
  { stems: ["ταμπά", "ταμπα"], name: "ταμπά" },
  { stems: ["μπλέ", "μπλε"], name: "μπλε" },
  { stems: ["λευκ", "άσπρ", "ασπρ"], name: "λευκό" },
  { stems: ["γκρι"], name: "γκρι" },
  { stems: ["χρυσ"], name: "χρυσό" },
  { stems: ["ασημ"], name: "ασημί" },
  { stems: ["μπορντό", "μπορντο"], name: "μπορντό" },
];

export function detectStyle(name: string): string | null {
  const haystack = name.toLowerCase();
  return STYLE_RULES.find((rule) => rule.match.some((needle) => haystack.includes(needle)))?.style ?? null;
}

export function detectColour(name: string): string | null {
  const haystack = name.toLowerCase();
  return COLOUR_STEMS.find((entry) => entry.stems.some((stem) => haystack.includes(stem)))?.name ?? null;
}

function detectFeatures(name: string): string[] {
  const haystack = name.toLowerCase();
  return FEATURE_NOTES.filter((entry) => entry.match.some((needle) => haystack.includes(needle))).map((e) => e.note);
}

/**
 * A short product description, written from the name and the form's own attributes.
 *
 * Short on purpose. Three or four sentences of true, specific detail rank better than a
 * paragraph of filler, and are also something an owner will actually read and correct — a
 * wall of generated text just gets saved unread.
 */
export function generateProductDescription(input: {
  name: string;
  brand?: string;
  materials?: string[];
  heel?: string | null;
  sizes: string[];
  /** Used only when the name itself names no style — see CATEGORY_STYLE. */
  categorySlug?: string;
}): string {
  const cleaned = cleanProductTitle(input.name);
  const style = detectStyle(cleaned) ?? (input.categorySlug ? CATEGORY_STYLE[input.categorySlug] : null);
  const colour = detectColour(cleaned);
  const features = detectFeatures(cleaned);
  const materials = input.materials?.length ? input.materials : extractMaterials(cleaned);

  const sentences: string[] = [];

  /**
   * Brand first, then what it is. Greek puts the label in front — «Mont Martre Paris πέδιλο
   * για το καλοκαίρι» reads as a sentence, while appending it («Πέδιλο για το καλοκαίρι
   * Mont Martre Paris») reads as two labels stapled together. Which is why the leads above
   * are stored lowercase: only one of these two positions gets the capital.
   */
  const lead = (style && STYLE_LEAD[style]) || DEFAULT_LEAD;
  const subject = input.brand ? `${input.brand} ${lead}` : lead.charAt(0).toUpperCase() + lead.slice(1);

  const opening = [
    subject,
    colour ? `σε ${colour}` : null,
    // Two details is a sentence; four is a list. The rest stay for the spec fields.
    features.slice(0, 2).join(" και ") || null,
  ]
    .filter(Boolean)
    .join(", ");
  sentences.push(`${opening}.`);

  if (materials.length) sentences.push(`Από ${materials.join(" και ").toLowerCase()}.`);
  if (input.heel) sentences.push(`Ύψος τακουνιού ${input.heel} εκ.`);

  const numeric = input.sizes.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (numeric.length >= 2) sentences.push(`Διαθέσιμο σε νούμερα ${numeric[0]}–${numeric[numeric.length - 1]}.`);
  else if (numeric.length === 1) sentences.push(`Διαθέσιμο σε νούμερο ${numeric[0]}.`);

  sentences.push("Αποστολή σε 3–5 εργάσιμες.");

  return sentences.join(" ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Everything the "Generate" button needs, from the values already on the form.
 *
 * Returns both fields together because they are one decision: a title with the stock code
 * stripped and a description built from the same cleaned title read as a pair.
 */
export function generateProductSeo(input: {
  name: string;
  description: string;
  sizes: string[];
  categorySlug?: string;
}): { title: string; description: string } {
  const title = cleanProductTitle(input.name);
  return {
    title,
    description: composeProductDescription({
      title,
      materials: extractMaterials(`${input.name} ${input.description}`),
      heel: extractHeel(input.description),
      sizes: input.sizes,
      categoryLabel: (input.categorySlug && CATEGORY_LABEL[input.categorySlug]) || DEFAULT_CATEGORY_LABEL,
    }),
  };
}
