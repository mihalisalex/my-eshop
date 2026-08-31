import { describe, expect, it } from "vitest";
import { resolveSizeQuantity } from "@/lib/products-import/write";

/**
 * The regression these guard is a lost update, which is invisible in every other check:
 * types pass, lint passes, the save succeeds, and the only symptom is stock that quietly
 * climbs back to a number nobody entered.
 */
describe("resolveSizeQuantity", () => {
  it("leaves stock alone when the admin didn't touch the field", () => {
    // Form loaded at 3, a sale took one, admin saves without editing quantity.
    expect(resolveSizeQuantity(3, 3, 2)).toBe(2);
  });

  it("applies an edit as a change, not as an overwrite", () => {
    // Loaded at 3, admin typed 10 (+7), meanwhile a sale took one.
    expect(resolveSizeQuantity(10, 3, 2)).toBe(9);
  });

  it("applies a reduction the same way", () => {
    expect(resolveSizeQuantity(1, 3, 3)).toBe(1);
    expect(resolveSizeQuantity(1, 3, 5)).toBe(3);
  });

  it("treats the submitted value as absolute when there is no baseline", () => {
    // A newly added size, and every CSV import row — both are authoritative by definition.
    expect(resolveSizeQuantity(12, undefined, 4)).toBe(12);
    expect(resolveSizeQuantity(0, undefined, 99)).toBe(0);
  });

  it("never returns a negative quantity", () => {
    // Admin reduces by 5 while only 2 remain on the shelf.
    expect(resolveSizeQuantity(0, 5, 2)).toBe(0);
    expect(resolveSizeQuantity(-4, undefined, 1)).toBe(0);
  });

  it("falls back to absolute for a baseline that isn't a real number", () => {
    // A hidden form field can arrive as NaN if it was ever rendered empty.
    expect(resolveSizeQuantity(7, Number.NaN, 2)).toBe(7);
  });

  it("is a no-op when nothing changed anywhere", () => {
    expect(resolveSizeQuantity(4, 4, 4)).toBe(4);
  });
});
