import { describe, it, expect } from "vitest";
import { resolveCartAmounts, type ComputeTotalsLineItem } from "./cart-totals";
import { STANDARD_SHIPPING_RATE, EXPRESS_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";

const CURRENCY = "EUR";
const item = (unitPriceAmount: number, quantity = 1, savedForLater = false): ComputeTotalsLineItem => ({
  unitPriceAmount,
  quantity,
  savedForLater,
});

describe("resolveCartAmounts", () => {
  it("computes base subtotal/tax/shipping with no discounts, gift cards, or wrap", () => {
    const result = resolveCartAmounts({ lineItems: [item(50, 2)], discounts: [], giftCards: [], currencyCode: CURRENCY });
    expect(result.totals.subtotal.amount).toBe(100);
    expect(result.totals.shippingTotal.amount).toBe(6.95); // under the free-shipping threshold
    expect(result.totals.taxTotal.amount).toBeCloseTo(100 * 0.21, 5);
  });

  it("excludes saved-for-later items from the subtotal", () => {
    const result = resolveCartAmounts({
      lineItems: [item(50), item(30, 1, true)],
      discounts: [],
      giftCards: [],
      currencyCode: CURRENCY,
    });
    expect(result.totals.subtotal.amount).toBe(50);
  });

  it("applies a percentage discount against the current subtotal", () => {
    const result = resolveCartAmounts({
      lineItems: [item(100)],
      discounts: [{ code: "TEN", type: "percentage", value: 10 }],
      giftCards: [],
      currencyCode: CURRENCY,
    });
    expect(result.discounts[0].amount.amount).toBe(10);
  });

  it("clamps a fixed discount to the subtotal", () => {
    const result = resolveCartAmounts({
      lineItems: [item(5)],
      discounts: [{ code: "BIG", type: "fixed", value: 50 }],
      giftCards: [],
      currencyCode: CURRENCY,
    });
    expect(result.discounts[0].amount.amount).toBe(5);
  });

  it("applies gift cards in order, each capped by what's still due", () => {
    const result = resolveCartAmounts({
      lineItems: [item(20)],
      discounts: [],
      giftCards: [
        { code: "GC1", balanceAmount: 5 },
        { code: "GC2", balanceAmount: 100 },
      ],
      currencyCode: CURRENCY,
    });
    expect(result.giftCards[0].amountApplied.amount).toBe(5);
    expect(result.totals.total.amount).toBe(0); // second card covers the rest, clamped at zero due
  });

  it("adds the gift wrap fee only when there are active items", () => {
    const withWrap = resolveCartAmounts({ lineItems: [item(20)], discounts: [], giftCards: [], currencyCode: CURRENCY, giftWrap: true });
    expect(withWrap.totals.giftWrapTotal.amount).toBeGreaterThan(0);

    const emptyCartWrap = resolveCartAmounts({ lineItems: [], discounts: [], giftCards: [], currencyCode: CURRENCY, giftWrap: true });
    expect(emptyCartWrap.totals.giftWrapTotal.amount).toBe(0);
  });

  it("adds the payment fee to the total, and only when there are active items", () => {
    const withFee = resolveCartAmounts({
      lineItems: [item(100)],
      discounts: [],
      giftCards: [],
      currencyCode: CURRENCY,
      paymentFee: 2,
    });
    const withoutFee = resolveCartAmounts({ lineItems: [item(100)], discounts: [], giftCards: [], currencyCode: CURRENCY });
    expect(withFee.totals.paymentFeeTotal.amount).toBe(2);
    expect(withFee.totals.total.amount).toBeCloseTo(withoutFee.totals.total.amount + 2, 5);

    const emptyCart = resolveCartAmounts({ lineItems: [], discounts: [], giftCards: [], currencyCode: CURRENCY, paymentFee: 2 });
    expect(emptyCart.totals.paymentFeeTotal.amount).toBe(0);
  });

  it("never lets a negative payment fee act as a discount", () => {
    const result = resolveCartAmounts({
      lineItems: [item(100)],
      discounts: [],
      giftCards: [],
      currencyCode: CURRENCY,
      paymentFee: -50,
    });
    expect(result.totals.paymentFeeTotal.amount).toBe(0);
  });

  it("applies the payment fee before gift cards, so a gift card can cover it", () => {
    // The fee is part of what's owed, not an extra charged after settlement.
    const result = resolveCartAmounts({
      lineItems: [item(10)],
      discounts: [],
      giftCards: [{ code: "GC", balanceAmount: 1000 }],
      currencyCode: CURRENCY,
      paymentFee: 2,
    });
    expect(result.totals.total.amount).toBe(0);
    expect(result.giftCards[0].amountApplied.amount).toBeCloseTo(
      10 + 10 * 0.21 + result.totals.shippingTotal.amount + 2,
      5
    );
  });

  it("regression: an explicitly selected Standard rate stays free over the shipping threshold (past revenue bug — see PROGRESS.md)", () => {
    const result = resolveCartAmounts({
      lineItems: [item(FREE_SHIPPING_THRESHOLD + 50)],
      discounts: [],
      giftCards: [],
      currencyCode: CURRENCY,
      selectedShippingRate: STANDARD_SHIPPING_RATE,
    });
    expect(result.totals.shippingTotal.amount).toBe(0);
  });

  it("charges Express in full even when explicitly selected over the threshold", () => {
    const result = resolveCartAmounts({
      lineItems: [item(FREE_SHIPPING_THRESHOLD + 50)],
      discounts: [],
      giftCards: [],
      currencyCode: CURRENCY,
      selectedShippingRate: EXPRESS_SHIPPING_RATE,
    });
    expect(result.totals.shippingTotal.amount).toBe(EXPRESS_SHIPPING_RATE.price.amount);
  });
});
