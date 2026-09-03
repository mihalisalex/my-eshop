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
/**
 * What the shoe IS, in one noun — nothing about when it is worn.
 *
 * These used to carry the occasion too ("μποτάκι για τον χειμώνα"), which read fine until
 * STYLE_OCCASION started saying the same thing one sentence later: «μποτάκι για τον
 * χειμώνα … Για τον χειμώνα, με jeans». The occasion has a sentence of its own now, so the
 * lead just names the thing and the two stop competing.
 */
const STYLE_LEAD: Record<string, string> = {
  sneakers: "sneaker",
  loafers: "loafer",
  sandals: "πέδιλο",
  boots: "μποτάκι",
  // Deliberately just "παντόφλα": this catalogue files both fashion mules and furry house
  // slippers under the same word, and calling a lined winter slipper an "open mule" would
  // be wrong about the product rather than merely vague about it.
  mules: "παντόφλα",
  heels: "παπούτσι με τακούνι",
  oxfords: "δετό oxford",
  derby: "δετό derby",
  cowboy: "μποτάκι cowboy",
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
 * When and with what a shoe of this style is worn.
 *
 * This is where the search demand actually is. Nobody types «ποιοτικά παπούτσια» — they
 * type «παπούτσια για γάμο», «sneakers για καθημερινή χρήση», «μποτάκια για τον χειμώνα».
 * These sentences are the long-tail intent behind the head term, and they are also just
 * true statements about what the shoe is for, which is why they are safe to generate:
 * saying a heeled shoe suits a wedding is a fact about heels, not a claim about this pair.
 *
 * English words are left in where Greek shoppers genuinely use them — casual, smart casual,
 * ankle boot, western. Those are the words in the queries, not translations of them.
 */
const STYLE_OCCASION: Record<string, string> = {
  sneakers: "Ταιριάζει με jeans και casual σύνολα, για καθημερινές εμφανίσεις και πολλές ώρες περπάτημα.",
  loafers: "Φοριέται στο γραφείο και σε smart casual εμφανίσεις, με ή χωρίς κάλτσα.",
  sandals: "Για το καλοκαίρι, τις διακοπές και την παραλία, με φόρεμα ή σορτς.",
  boots: "Για τον χειμώνα, με jeans ή φόρεμα — ankle boot από το πρωί ως το βράδυ.",
  heels: "Επιλογή για γάμο, βάπτιση και βραδινές εμφανίσεις, αλλά και για το γραφείο.",
  oxfords: "Για επίσημες εμφανίσεις, κοστούμι και γαμπριάτικα σύνολα.",
  derby: "Φοριέται με κοστούμι ή chinos, σε γραφείο και επίσημες εμφανίσεις.",
  cowboy: "Western στιλ που ταιριάζει με jeans, φόρεμα ή φούστα.",
  /**
   * Says how it is worn, not where. Every one of the 40 mules in this catalogue is
   * merchandised under sandals or heels, so they are fashion mules rather than house
   * slippers — but some are lined and furry, and a beach line would be wrong about those.
   * Being open-backed is the one thing all of them share.
   */
  mules: "Μπαίνει και βγαίνει εύκολα, χωρίς κούμπωμα, για καθημερινές εμφανίσεις.",
};

/**
 * Above this many centimetres a shoe is dressed up, whatever the name calls it.
 *
 * 26 products in this catalogue are named πέδιλα or παντόφλες and carry a 5cm-plus heel.
 * Sold on the summer line they would read as beachwear, which is wrong about the shoe and
 * wrong for the shopper searching for it — a 7cm sandal is what someone buys for a wedding.
 */
const DRESSY_HEEL_CM = 5;

/**
 * What a construction detail means for the wearer. Only ever reached when the product's own
 * name states the feature, so each of these is grounded in something the shop wrote.
 */
const FEATURE_BENEFIT: Record<string, string> = {
  "με ανατομικό πάτο": "Ο ανατομικός πάτος το κάνει άνετο για όλη την ημέρα.",
  "σε δίσολη σόλα": "Η δίσολη σόλα δίνει ύψος χωρίς τακούνι.",
  "με φερμουάρ": "Το πλαϊνό φερμουάρ το κάνει εύκολο στο φόρεμα.",
};

/**
 * A product description, written from the name and the form's own attributes.
 *
 * Six or seven sentences: what it is, what it is made of, when it is worn, what its
 * construction does for the wearer, the head term, the size run and the dispatch window.
 * Long enough to say something and to carry the phrases people search for; short enough
 * that the owner will actually read it and correct it, which a wall of text never gets.
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

  // A tall heel outranks the name: a 7cm πέδιλο is an evening shoe, not a beach one.
  const heelCm = input.heel ? parseFloat(input.heel.replace(",", ".")) : NaN;
  // The heels CATEGORY counts too: the shop filing it there is a statement about the
  // shoe, and several such products never had a heel height recorded.
  const dressy = (Number.isFinite(heelCm) && heelCm >= DRESSY_HEEL_CM) || input.categorySlug === "heels";
  const occasionStyle = dressy && (style === "sandals" || style === "mules") ? "heels" : style;
  if (occasionStyle && STYLE_OCCASION[occasionStyle]) sentences.push(STYLE_OCCASION[occasionStyle]);

  // One benefit, from the first feature that has one. Two starts to read like a brochure.
  const benefit = features.map((f) => FEATURE_BENEFIT[f]).find(Boolean);
  if (benefit) sentences.push(benefit);

  /**
   * The head term goes in the size sentence rather than a sentence of its own, so
   * «Ανδρικά sneakers» earns its place by carrying information instead of being announced.
   *
   * Phrased as a bare noun phrase — «Ανδρικά sneakers σε νούμερα 40–44» — because the
   * labels differ in gender («Γυναικείες μπότες», «Ανδρικά sneakers») and any adjective
   * after them would have to agree. A noun phrase agrees with everything.
   */
  const label = (input.categorySlug && CATEGORY_LABEL[input.categorySlug]) || DEFAULT_CATEGORY_LABEL;
  const numeric = input.sizes.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (numeric.length >= 2) sentences.push(`${label} σε νούμερα ${numeric[0]}–${numeric[numeric.length - 1]}.`);
  else if (numeric.length === 1) sentences.push(`${label} σε νούμερο ${numeric[0]}.`);

  // No "σε όλη την Ελλάδα" here on purpose: the shop is single-market so it is true as a
  // statement, but bolted onto the timing it promises 3–5 days to the islands as well.
  sentences.push("Αποστολή σε 3–5 εργάσιμες.");

  return sentences.join(" ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Alt text for a product's photographs.
 *
 * The imported values were WooCommerce boilerplate: the full product name including its
 * code, then the same again with ", view 2" appended. What this writes instead is the
 * product described — colour and style from the name, material where the description
 * states it, brand where there is one — with the code removed.
 *
 * What it deliberately does NOT do is say what each photograph SHOWS. "Πλάγια όψη" and the
 * like would be invented: nobody has looked at these images, and alt text that describes
 * the wrong thing is worse for a blind user than alt text that is merely unambitious.
 *
 * Shared by the bulk script and the admin image manager, so a photo added today is
 * described the same way as the 175 already in the catalogue.
 */
export function composeImageAlt(input: {
  /** Already cleaned — pass `cleanProductTitle(name)`, not the raw name. */
  title: string;
  brand?: string | null;
  materials?: string[];
  index: number;
}): string {
  const descriptor = [
    input.brand && !input.title.toLowerCase().includes(input.brand.toLowerCase()) ? input.brand : null,
    input.title,
  ]
    .filter(Boolean)
    .join(" ");

  const material = input.materials?.length ? ` — ${input.materials.join(" / ")}` : "";
  const base = `${descriptor}${material}`;

  // The first photograph needs no number; the rest do, so a screen reader can tell them
  // apart. An index above zero is itself the proof that there is more than one.
  return input.index > 0 ? `${base} (φωτογραφία ${input.index + 1})` : base;
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
