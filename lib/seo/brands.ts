/**
 * Which brand a product name is announcing, if any.
 *
 * Shared by the content script that FILLS the brand column and by the audit that reports it
 * missing, because the two disagreeing is worse than either being wrong alone: the audit
 * would report work the script cannot do, forever.
 *
 * Longest-first, so "Mont Martre Paris" wins over "Mont Martre", and "U.S Grand polo
 * equipment" is not mistaken for "U.S. Polo Assn." — they are different labels that share
 * three words.
 */
export const BRAND_PATTERNS: { match: string[]; brand: string }[] = [
  { match: ["u.s grand polo", "u.s. grand polo", "us grand polo", "grand polo equipment"], brand: "U.S. Grand Polo Equipment" },
  { match: ["u.s polo assn", "u.s. polo assn", "us polo assn", "us polo"], brand: "U.S. Polo Assn." },
  { match: ["mont martre paris", "mont martre"], brand: "Mont Martre Paris" },
  { match: ["alexandris shoes", "alexandris leather", "αλεξανδρής"], brand: "Alexandris Shoes" },
  { match: ["verde"], brand: "Verde" },
  { match: ["london"], brand: "London" },
];

/** The brand named in this product's own title, or null when it names none. */
export function detectBrand(productName: string): string | null {
  const haystack = productName.toLowerCase();
  for (const entry of BRAND_PATTERNS) {
    if (entry.match.some((needle) => haystack.includes(needle))) return entry.brand;
  }
  return null;
}
