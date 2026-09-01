import { describe, expect, it } from "vitest";
import { discountFormSchema } from "@/lib/validation/discount";

const base = { code: "summer", type: "percentage" as const, value: 10, active: true };

describe("discountFormSchema", () => {
  it("uppercases the code, because every lookup normalises that way", () => {
    const parsed = discountFormSchema.parse({ ...base, code: "  summer10  " });
    expect(parsed.code).toBe("SUMMER10");
  });

  /**
   * The regression this guards: `value` was bounded below but not above, so a mistyped
   * "100" as "1000" gave a discount of ten times the subtotal. Cart totals clamp the
   * taxable amount at zero, so nothing goes negative — the shopper simply gets the goods
   * for the price of shipping, and nothing in the admin looks wrong.
   */
  it("refuses a percentage over 100", () => {
    expect(discountFormSchema.safeParse({ ...base, value: 1000 }).success).toBe(false);
    expect(discountFormSchema.safeParse({ ...base, value: 101 }).success).toBe(false);
    expect(discountFormSchema.safeParse({ ...base, value: 100 }).success).toBe(true);
  });

  it("still allows a fixed amount above 100, which is a euro value and not a proportion", () => {
    expect(discountFormSchema.safeParse({ ...base, type: "fixed", value: 150 }).success).toBe(true);
  });

  it("rejects zero and negative values for either type", () => {
    expect(discountFormSchema.safeParse({ ...base, value: 0 }).success).toBe(false);
    expect(discountFormSchema.safeParse({ ...base, type: "fixed", value: -5 }).success).toBe(false);
  });
});
