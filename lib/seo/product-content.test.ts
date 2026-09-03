import { describe, expect, it } from "vitest";
import {
  cleanProductTitle,
  detectColour,
  detectStyle,
  extractHeel,
  extractMaterials,
  generateProductDescription,
  generateProductSeo,
} from "@/lib/seo/product-content";

describe("cleanProductTitle", () => {
  it("strips the stock code wherever it sits, keeping a trailing colour", () => {
    expect(cleanProductTitle("Alexandris Shoes δερμάτινα μοκασίνια – κωδικός 325 - Μπλε")).toBe(
      "Alexandris Shoes δερμάτινα μοκασίνια - Μπλε"
    );
  });

  it("consumes a hyphenated code and its trailing letter", () => {
    // `TR-1 S` once left "-1 S" dangling on the end of five titles.
    expect(cleanProductTitle("London μπέζ παντόφλες - κωδικός TR-1 S")).toBe("London μπέζ παντόφλες");
  });
});

describe("extractMaterials", () => {
  it("does not call a vegan shoe leather, even though «Οικ. δέρμα» contains «δέρμα»", () => {
    // Telling a customer a synthetic shoe is real leather is the bug this guards.
    expect(extractMaterials("Υλικό : VEGAN / Οικ. δέρμα")).toEqual(["Οικολογικό δέρμα"]);
  });

  it("keeps real leather when something says so explicitly", () => {
    expect(extractMaterials("Εσωτερική σόλα: Γνήσιο Δέρμα")).toContain("Δέρμα");
    expect(extractMaterials("δερμάτινα μοκασίνια")).toContain("Δέρμα");
  });
});

describe("extractHeel", () => {
  it("reads the height and normalises the decimal separator", () => {
    expect(extractHeel("Ύψος τακουνιού : 1.5 CM")).toBe("1,5");
    expect(extractHeel("ύψος τακουνιού: 4εκ.")).toBe("4");
    expect(extractHeel("no heel mentioned")).toBeNull();
  });
});

describe("detectStyle and detectColour", () => {
  it("reads the style from the product's own name", () => {
    expect(detectStyle("Μπεζ δίσολα sneaker με ανατομικό πάτο")).toBe("sneakers");
    expect(detectStyle("Alexandris Shoes δερμάτινα μοκασίνια")).toBe("loafers");
    expect(detectStyle("Πέδιλο με μπαρέτα σε χρώμα λευκό")).toBe("sandals");
    expect(detectStyle("Mont Martre Paris μποτάκια cowboy")).toBe("cowboy");
    expect(detectStyle("Κάτι εντελώς άλλο")).toBeNull();
  });

  it("reads inflected colour words, not just the dictionary form", () => {
    // Names say «Μαύρα», «Πέδιλα χρυσά» — never the bare swatch label.
    expect(detectColour("Μαύρα δίσολα sneaker")).toBe("μαύρο");
    expect(detectColour("Πέδιλα χρυσά με στρας")).toBe("χρυσό");
    expect(detectColour("Μπεζ suede loafers")).toBe("μπεζ");
  });
});

describe("generateProductDescription", () => {
  it("opens with what the shoe is, in its colour, with how it is built", () => {
    const text = generateProductDescription({
      name: "Μπεζ δίσολα sneaker με ανατομικό πάτο - κωδικός 9181",
      sizes: ["36", "37", "38", "39", "40"],
    });
    expect(text).toContain("Sneaker για καθημερινή χρήση");
    expect(text).toContain("σε μπεζ");
    expect(text).toContain("ανατομικό πάτο");
    expect(text).toContain("Διαθέσιμο σε νούμερα 36–40.");
  });

  it("never carries the stock code into the description", () => {
    const text = generateProductDescription({ name: "Πέδιλα χρυσά με στρας - κωδικός 1119", sizes: [] });
    expect(text).not.toContain("κωδικός");
    expect(text).not.toContain("1119");
  });

  it("states a material only where one is evidenced", () => {
    expect(generateProductDescription({ name: "Μπεζ suede loafers", sizes: [] })).toContain("Από καστόρι.");
    // Nothing in this name says what it is made of, so the description does not guess.
    expect(generateProductDescription({ name: "Πέδιλο με μπαρέτα", sizes: [] })).not.toContain("Από ");
  });

  it("makes no claim about quality, provenance or the shopper", () => {
    const text = generateProductDescription({
      name: "Alexandris Shoes δερμάτινα loafers με ανατομικό πάτο",
      brand: "Alexandris Shoes",
      sizes: ["40", "45"],
    });
    for (const word of ["ποιότητ", "χειροποίητ", "τέλει", "κορυφαί", "premium", "luxury", "εξαιρετικ"]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });

  it("stays short — a few true sentences, not a paragraph", () => {
    const text = generateProductDescription({
      name: "Mont Martre Paris μαύρα ανατομικά loafers με τοκά",
      sizes: ["36", "41"],
    });
    expect(text.length).toBeLessThan(260);
  });

  it("puts the brand first, which is how Greek reads", () => {
    // «Πέδιλο για το καλοκαίρι Mont Martre Paris» is two labels stapled together.
    const text = generateProductDescription({
      name: "Mont Martre Paris δερμάτινα πέδιλα μαύρα",
      brand: "Mont Martre Paris",
      sizes: [],
    });
    expect(text.startsWith("Mont Martre Paris πέδιλο για το καλοκαίρι")).toBe(true);
  });

  it("capitalises the lead when there is no brand to precede it", () => {
    expect(generateProductDescription({ name: "Μαύρο sneaker", sizes: [] }).startsWith("Sneaker")).toBe(true);
  });

  it("falls back to the category when the name states no style", () => {
    // «U.S Grand polo equipment μπεζ» names no style, but its category does.
    const text = generateProductDescription({
      name: "U.S Grand polo equipment μπεζ",
      categorySlug: "andrika-sneakers",
      sizes: [],
    });
    // Capitalised here because no brand was passed to precede it.
    expect(text).toContain("Sneaker για καθημερινή χρήση");
  });

  it("says only «παπούτσι» when neither the name nor a category settles the style", () => {
    expect(generateProductDescription({ name: "Κάτι άλλο", sizes: [] }).startsWith("Παπούτσι")).toBe(true);
  });

  it("varies by style, so a sandal does not read like a sneaker", () => {
    const sneaker = generateProductDescription({ name: "Μαύρο sneaker", sizes: [] });
    const sandal = generateProductDescription({ name: "Μαύρο πέδιλο", sizes: [] });
    expect(sneaker).not.toEqual(sandal);
  });
});

describe("the two generators stay in step", () => {
  /**
   * The point of "in touch": a description generated here must still be readable by the
   * SEO generator, which extracts material and heel from the description text. If the body
   * copy phrased them differently, pressing Generate SEO afterwards would silently lose
   * them.
   */
  it("a generated description feeds the SEO generator its material and heel back", () => {
    const name = "Alexandris Shoes δερμάτινα loafers με ανατομικό πάτο";
    const description = generateProductDescription({ name, heel: "4", sizes: ["40", "41"] });

    expect(extractMaterials(description)).toContain("Δέρμα");
    expect(extractHeel(description)).toBe("4");

    const seo = generateProductSeo({ name, description, sizes: ["40", "41"], categorySlug: "andrika-loafers" });
    expect(seo.description).toContain("Δέρμα");
    expect(seo.description).toContain("Ύψος τακουνιού 4 εκ.");
  });

  it("both use the same cleaned title, so they never disagree about the product's name", () => {
    const name = "London μπέζ ρουστίκ παντόφλες - κωδικός TR-1 S";
    expect(generateProductSeo({ name, description: "", sizes: [] }).title).toBe(cleanProductTitle(name));
  });
});
