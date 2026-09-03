import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("slugify", () => {
  /**
   * The catalogue's own convention, from the WooCommerce import. New slugs have to match
   * it or they will be inconsistent with the 175 URLs already indexed.
   */
  it("transliterates Greek the way the existing slugs do", () => {
    expect(slugify("London μπέζ ρουστίκ παντόφλες με χρυσές")).toBe("london-mpez-roystik-pantofles-me-chryses");
  });

  it("uses y for υ and ch for χ, not u and h", () => {
    expect(slugify("ρουστίκ")).toBe("roystik");
    expect(slugify("χρυσές")).toBe("chryses");
  });

  it("strips accents rather than dropping the letter", () => {
    expect(slugify("Πέδιλα")).toBe("pedila");
    expect(slugify("Montmartre Café")).toBe("montmartre-cafe");
  });

  it("handles final sigma, which is the same letter as σ for a URL", () => {
    expect(slugify("παντόφλες")).toBe("pantofles");
  });

  it("collapses punctuation and spacing into single hyphens", () => {
    expect(slugify("Μαύρα  δίσολα — sneaker!!")).toBe("mayra-disola-sneaker");
  });

  it("never leaves a leading or trailing hyphen", () => {
    expect(slugify("  - Πέδιλα -  ")).toBe("pedila");
  });

  it("always produces something the slug field will accept", () => {
    for (const name of [
      "Alexandris Shoes δερμάτινα μοκασίνια – κωδικός 325 - Μπλε",
      "U.S Grand polo equipment καφέ - 525405",
      "Πέδιλο με μπαρέτα σε χρώμα μπλέ electric",
    ]) {
      expect(slugify(name)).toMatch(SLUG_PATTERN);
    }
  });

  it("returns an empty string for a name with nothing usable, rather than a stray hyphen", () => {
    // The caller decides what to do with that; a slug of "-" would fail validation with a
    // confusing message about hyphens.
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });
});
