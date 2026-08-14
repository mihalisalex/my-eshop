import { describe, expect, it } from "vitest";
import { getProductMargin } from "@/lib/product";
import type { Product } from "@/types/product";

/** Only the fields getProductMargin actually reads — the rest of Product is irrelevant here. */
function product(overrides: Partial<Product>): Product {
  return {
    price: { amount: 100, currencyCode: "EUR" },
    ...overrides,
  } as Product;
}

describe("getProductMargin", () => {
  it("returns null when no cost is set, rather than implying 100% margin", () => {
    expect(getProductMargin(product({}))).toBeNull();
  });

  it("computes gross margin against the list price", () => {
    const margin = getProductMargin(product({ costPrice: { amount: 40, currencyCode: "EUR" } }));
    expect(margin).toEqual({ profit: 60, marginPercent: 60 });
  });

  it("uses the sale price, not the list price, when one is set", () => {
    // The whole point: margin on a discounted item must reflect what's actually charged.
    const margin = getProductMargin(
      product({
        price: { amount: 100, currencyCode: "EUR" },
        salePrice: { amount: 50, currencyCode: "EUR" },
        costPrice: { amount: 40, currencyCode: "EUR" },
      })
    );
    expect(margin).toEqual({ profit: 10, marginPercent: 20 });
  });

  it("reports a negative margin when selling below cost instead of clamping to zero", () => {
    const margin = getProductMargin(
      product({
        price: { amount: 30, currencyCode: "EUR" },
        costPrice: { amount: 40, currencyCode: "EUR" },
      })
    );
    expect(margin?.profit).toBe(-10);
    expect(margin?.marginPercent).toBeCloseTo(-33.33, 1);
  });

  it("treats a zero cost as a real value, not a missing one", () => {
    expect(getProductMargin(product({ costPrice: { amount: 0, currencyCode: "EUR" } }))).toEqual({
      profit: 100,
      marginPercent: 100,
    });
  });

  it("does not divide by zero on a free product", () => {
    const margin = getProductMargin(
      product({ price: { amount: 0, currencyCode: "EUR" }, costPrice: { amount: 0, currencyCode: "EUR" } })
    );
    expect(margin).toEqual({ profit: 0, marginPercent: 0 });
    expect(Number.isNaN(margin!.marginPercent)).toBe(false);
  });
});
