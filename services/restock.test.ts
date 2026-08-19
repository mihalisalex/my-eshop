import { describe, expect, it } from "vitest";
import { readReturnLines, subtractCreditedQuantities, variantKey } from "./restock";

/**
 * These two functions decide whether a cancelled-after-return order invents stock or loses
 * it. Both failure modes are silent: phantom stock only surfaces when an order cannot be
 * fulfilled, and lost stock only when a customer cannot buy something that is on the shelf.
 */
describe("subtractCreditedQuantities", () => {
  const line = (productId: string, size: string, quantity: number) => ({ productId, size, quantity });

  it("credits the full order when no return has credited anything", () => {
    const lines = [line("p1", "38", 2), line("p2", "40", 1)];
    expect(subtractCreditedQuantities(lines, new Map())).toEqual([line("p1", "38", 2), line("p2", "40", 1)]);
  });

  it("subtracts what a return already put back, so the unit is not credited twice", () => {
    // The customer returned one of the two pairs, then the whole order was refunded.
    const lines = [line("p1", "38", 2)];
    const credited = new Map([[variantKey("p1", "38"), 1]]);
    expect(subtractCreditedQuantities(lines, credited)).toEqual([line("p1", "38", 1)]);
  });

  it("credits nothing when a return already covered the whole line", () => {
    const lines = [line("p1", "38", 2)];
    const credited = new Map([[variantKey("p1", "38"), 2]]);
    expect(subtractCreditedQuantities(lines, credited)).toEqual([line("p1", "38", 0)]);
  });

  it("never returns a negative quantity, which would DEDUCT stock", () => {
    // Bad data: a return claiming more units than the order line ever held.
    const lines = [line("p1", "38", 1)];
    const credited = new Map([[variantKey("p1", "38"), 5]]);
    expect(subtractCreditedQuantities(lines, credited)).toEqual([line("p1", "38", 0)]);
  });

  it("does not let one returned unit cancel out two separate lines of the same variant", () => {
    // Without consuming the credit, both lines would subtract the same single returned unit
    // and the order would credit back 0 instead of 1.
    const lines = [line("p1", "38", 1), line("p1", "38", 1)];
    const credited = new Map([[variantKey("p1", "38"), 1]]);
    expect(subtractCreditedQuantities(lines, credited)).toEqual([line("p1", "38", 0), line("p1", "38", 1)]);
  });

  it("only subtracts from the matching variant", () => {
    const lines = [line("p1", "38", 1), line("p1", "40", 1)];
    const credited = new Map([[variantKey("p1", "38"), 1]]);
    expect(subtractCreditedQuantities(lines, credited)).toEqual([line("p1", "38", 0), line("p1", "40", 1)]);
  });

  it("leaves the caller's map untouched", () => {
    const credited = new Map([[variantKey("p1", "38"), 1]]);
    subtractCreditedQuantities([line("p1", "38", 1)], credited);
    expect(credited.get(variantKey("p1", "38"))).toBe(1);
  });
});

describe("readReturnLines", () => {
  it("reads well-formed return items", () => {
    const items = [{ productId: "p1", name: "Shoe", color: "Black", size: "38", quantity: 2 }];
    expect(readReturnLines(items)).toEqual([{ productId: "p1", size: "38", quantity: 2 }]);
  });

  it("returns nothing for a non-array, rather than throwing inside a stock calculation", () => {
    expect(readReturnLines(null)).toEqual([]);
    expect(readReturnLines(undefined)).toEqual([]);
    expect(readReturnLines({ productId: "p1" })).toEqual([]);
    expect(readReturnLines("[]")).toEqual([]);
  });

  it("drops malformed lines instead of guessing, erring toward crediting less", () => {
    const items = [
      { productId: "p1", size: "38", quantity: 1 },
      { productId: "p2", size: "40" }, // no quantity
      { productId: "p3", quantity: 1 }, // no size
      { size: "41", quantity: 1 }, // no productId
      null,
      "nonsense",
      { productId: "p4", size: "42", quantity: 0 }, // zero credits nothing
      { productId: "p5", size: "43", quantity: -3 }, // negative would DEDUCT
      { productId: "p6", size: "44", quantity: Number.NaN },
    ];
    expect(readReturnLines(items)).toEqual([{ productId: "p1", size: "38", quantity: 1 }]);
  });
});
