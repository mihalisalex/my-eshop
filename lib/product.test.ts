import { describe, expect, it } from "vitest";
import { getProductBadges, getProductMargin } from "@/lib/product";
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

/**
 * The scarcity badge is measured in sizes remaining rather than total units, because this
 * shop genuinely stocks about one pair per size. Counting units made the badge fire on
 * 147 of 164 active products — a signal that appears almost everywhere is not a signal,
 * and it dressed ordinary stock as urgency.
 */
function withSizes(quantities: number[]): Product {
  return {
    availableForSale: true,
    sizes: quantities.map((quantity, index) => ({
      name: String(40 + index),
      quantity,
      inStock: quantity > 0,
    })),
  } as Product;
}

describe("getProductBadges — scarcity", () => {
  const scarcity = (product: Product) => getProductBadges(product).find((badge) => badge.tone === "low-stock");

  it("says nothing for a fully stocked size run", () => {
    // Seven sizes at one pair each is a healthy shoe shop, not a warning.
    expect(scarcity(withSizes([1, 1, 1, 1, 1, 1, 1]))).toBeUndefined();
  });

  it("stays quiet at three sizes left", () => {
    expect(scarcity(withSizes([1, 1, 1, 0, 0, 0, 0]))).toBeUndefined();
  });

  it("warns when two sizes remain", () => {
    expect(scarcity(withSizes([1, 1, 0, 0, 0]))?.key).toBe("fewSizesLeft");
  });

  it("distinguishes the last size, which is a different message to a shopper", () => {
    expect(scarcity(withSizes([1, 0, 0, 0, 0]))?.key).toBe("lastSize");
  });

  it("counts sizes rather than units, so plentiful stock in one size is not scarcity", () => {
    // 40 units, but only one size anyone can actually buy.
    expect(scarcity(withSizes([40, 0, 0, 0, 0]))?.key).toBe("lastSize");
  });

  it("says nothing when the product is sold out entirely", () => {
    // Out of stock is communicated by the size selector and the disabled CTA, not by a
    // scarcity badge that implies something is still available.
    expect(scarcity(withSizes([0, 0, 0]))).toBeUndefined();
  });

  it("says nothing when the product is not available for sale", () => {
    const product = { ...withSizes([1, 0, 0]), availableForSale: false } as Product;
    expect(scarcity(product)).toBeUndefined();
  });
});
