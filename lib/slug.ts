/**
 * Turns a product or category name into a URL slug.
 *
 * Greek-aware, because that is the only kind of name this shop has. The slug field accepts
 * `[a-z0-9-]` only, so a Greek name cannot simply be lowercased — until now every new
 * product needed its slug transliterated by hand, which is both tedious and the sort of
 * thing that quietly ends up as `proion-2`.
 *
 * The mapping matches the convention already in the catalogue, which came from the
 * WooCommerce import: «London μπέζ ρουστίκ παντόφλες με χρυσές λεπτομέρειες» is stored at
 * `london-mpez-roystik-pantofles-me-chryses`. So υ is `y` (not `u`, and ου is not `ou`),
 * χ is `ch`, and accents are stripped to their base letter. Deviating would make new slugs
 * inconsistent with the 175 already indexed.
 */
const GREEK_TO_LATIN: Record<string, string> = {
  α: "a", ά: "a", β: "v", γ: "g", δ: "d", ε: "e", έ: "e", ζ: "z",
  η: "i", ή: "i", θ: "th", ι: "i", ί: "i", ϊ: "i", ΐ: "i", κ: "k",
  λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", ό: "o", π: "p", ρ: "r",
  σ: "s", ς: "s", τ: "t", υ: "y", ύ: "y", ϋ: "y", ΰ: "y", φ: "f",
  χ: "ch", ψ: "ps", ω: "o", ώ: "o",
};

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .split("")
      .map((char) => GREEK_TO_LATIN[char] ?? char)
      .join("")
      // Strips accents from Latin characters too — a supplier name like "Montmartre Café"
      // should not lose its last word.
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      // The regex the slug field validates against rejects a doubled hyphen.
      .replace(/-{2,}/g, "-")
  );
}
