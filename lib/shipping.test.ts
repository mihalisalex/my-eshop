import { describe, it, expect } from "vitest";
import {
  computeShippingAmount,
  computeShippingChargeForRate,
  STANDARD_SHIPPING_RATE,
  EXPRESS_SHIPPING_RATE,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_AMOUNT,
  EXPRESS_SHIPPING_AMOUNT,
} from "./shipping";

describe("computeShippingAmount", () => {
  it("charges the standard rate under the free-shipping threshold", () => {
    expect(computeShippingAmount(FREE_SHIPPING_THRESHOLD - 1, true)).toBe(STANDARD_SHIPPING_AMOUNT);
  });

  it("is free at and over the threshold", () => {
    expect(computeShippingAmount(FREE_SHIPPING_THRESHOLD, true)).toBe(0);
    expect(computeShippingAmount(FREE_SHIPPING_THRESHOLD + 50, true)).toBe(0);
  });

  it("is free with no active items regardless of amount", () => {
    expect(computeShippingAmount(10, false)).toBe(0);
  });
});

describe("computeShippingChargeForRate", () => {
  it("charges Express its full listed price even over the free-shipping threshold", () => {
    expect(computeShippingChargeForRate(EXPRESS_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD + 50, true)).toBe(EXPRESS_SHIPPING_AMOUNT);
  });

  it("charges Standard under the threshold", () => {
    expect(computeShippingChargeForRate(STANDARD_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD - 1, true)).toBe(STANDARD_SHIPPING_AMOUNT);
  });

  it("regression: an explicitly selected Standard rate stays free at/over the threshold (past revenue bug — see PROGRESS.md)", () => {
    expect(computeShippingChargeForRate(STANDARD_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD, true)).toBe(0);
  });

  it("is free with no active items regardless of rate", () => {
    expect(computeShippingChargeForRate(EXPRESS_SHIPPING_RATE, 500, false)).toBe(0);
  });
});
