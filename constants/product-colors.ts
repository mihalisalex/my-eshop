/**
 * The shop's colour palette.
 *
 * Every hex here was READ from the catalogue, not chosen. All 175 products already agree on
 * one hex per colour name — 65 products call black `#111111`, 24 call beige `#D9C7A8`, and
 * no name anywhere carries two different values. Picking prettier swatches would have split
 * that: a new beige product would show a different swatch from the twenty-four beside it on
 * the same listing page, and nobody would know which was wrong.
 *
 * Ordered by how much of the catalogue uses them, so the common choices are the first ones
 * under the cursor.
 *
 * Names are Greek because the swatch label is what a shopper reads on the product page.
 */
export interface ProductColorPreset {
  /** Stored on ProductColor.name and shown to shoppers. */
  name: string;
  hex: string;
  /** For the admin, whose UI is in English. */
  english: string;
}

export const PRODUCT_COLOR_PRESETS: ProductColorPreset[] = [
  { name: "Μαύρο", hex: "#111111", english: "Black" },
  { name: "Καφέ", hex: "#6B4226", english: "Brown" },
  { name: "Μπεζ", hex: "#D9C7A8", english: "Beige" },
  { name: "Ταμπά", hex: "#A69B8D", english: "Tan" },
  { name: "Μπλε", hex: "#1F3A5F", english: "Blue" },
  { name: "Άσπρο", hex: "#F5F5F0", english: "White" },
  { name: "Γκρι", hex: "#808080", english: "Grey" },
  { name: "Μπορντό", hex: "#6B1F2A", english: "Burgundy" },
  { name: "Χρυσό", hex: "#D4AF37", english: "Gold" },
  { name: "Ασημί", hex: "#C0C0C0", english: "Silver" },
];
