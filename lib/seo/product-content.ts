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
