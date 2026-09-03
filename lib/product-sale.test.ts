import { describe, expect, it } from "vitest";
import { getEffectivePrice, getListPrice, isOnSale } from "@/lib/product";
import type { Product } from "@/types";

const eur = (amount: number) => ({ amount, currencyCode: "EUR" });

/** Only the price fields matter here; the rest of Product is irrelevant to the sale rules. */
function product(fields: Partial<Product>): Product {
  return { price: eur(65), isSale: false, ...fields } as Product;
}

describe("isOnSale", () => {
  it("sees a discount from the list price with no compare-at set", () => {
    /**
     * The reported bug. SKU 9262 is priced at 65 and discounted to 45, with no
     * compareAtPrice — and the page showed a bare "45 €", no strike-through, nothing to say
     * it was reduced. The old rule required compareAtPrice to be present.
     */
    const p = product({ price: eur(65), salePrice: eur(45), isSale: true });
    expect(isOnSale(p)).toBe(true);
    expect(getEffectivePrice(p).amount).toBe(45);
    expect(getListPrice(p).amount).toBe(65);
  });

  it("still prefers an explicit compare-at when the shop set one", () => {
    // 172 of the 173 discounted products are stored this way.
    const p = product({ price: eur(59), salePrice: eur(34.9), compareAtPrice: eur(59), isSale: true });
    expect(getListPrice(p).amount).toBe(59);
    expect(isOnSale(p)).toBe(true);
  });

  it("is not a sale when nothing is actually reduced", () => {
    expect(isOnSale(product({ price: eur(65) }))).toBe(false);
    expect(isOnSale(product({ price: eur(65), salePrice: eur(65) }))).toBe(false);
  });

  it("ignores an isSale flag that the prices do not back up", () => {
    // A flag left on after a sale ended must not strike through a price equal to itself.
    expect(isOnSale(product({ price: eur(65), salePrice: eur(65), isSale: true }))).toBe(false);
  });
});
