import { describe, it, expect } from "vitest";
import { resolveCartAmounts, type ComputeTotalsLineItem } from "./cart-totals";
import { buildShippingRates, VAT_RATE, vatIncludedIn } from "@/lib/shipping";
import shippingFallback from "@/data/shipping.json";
import type { ShippingRate } from "@/lib/commerce/types";
import type { ShippingSettings } from "@/types";

// Built from the shipped defaults rather than from literals, so these assertions describe the
// configuration a fresh install actually runs on — a test hardcoding 150 keeps passing after
// someone changes the default and stops describing the shop.
const DEFAULTS = shippingFallback as ShippingSettings;
const FREE_SHIPPING_THRESHOLD = DEFAULTS.freeShippingThreshold!;
const RATES = buildShippingRates(DEFAULTS);
const STANDARD_SHIPPING_RATE = RATES.find((rate) => rate.id === "standard")!;
const EXPRESS_SHIPPING_RATE = RATES.find((rate) => rate.id === "express")!;

/**
 * resolveCartAmounts REQUIRES a rate now, so a production caller cannot forget one and
 * silently price against constants the admin can no longer see. Most cases here are not about
 * shipping, so this defaults it to Standard and lets a test override when it is the subject.
 */
type Input = Parameters<typeof resolveCartAmounts>[0];
const totals = (input: Omit<Input, "selectedShippingRate"> & { selectedShippingRate?: ShippingRate }) =>
  resolveCartAmounts({ selectedShippingRate: STANDARD_SHIPPING_RATE, ...input });

const CURRENCY = "EUR";
const item = (unitPriceAmount: number, quantity = 1, savedForLater = false): ComputeTotalsLineItem => ({
  unitPriceAmount,
  quantity,
  savedForLater,
});

describe("resolveCartAmounts", () => {
  it("computes base subtotal/tax/shipping with no discounts, gift cards, or wrap", () => {
    const result = totals({ lineItems: [item(50, 2)], discounts: [], giftCards: [], currencyCode: CURRENCY });
    expect(result.totals.subtotal.amount).toBe(100);
    expect(result.totals.shippingTotal.amount).toBe(6.95); // under the free-shipping threshold
    // VAT is contained in the prices, so it does not move the total.
    expect(result.totals.total.amount).toBe(106.95);
    expect(result.totals.taxTotal.amount).toBeCloseTo(vatIncludedIn(106.95), 2);
  });

  it("never adds tax on top of the displayed price", () => {
    // The regression that mattered most: a EUR 59 product used to bill at EUR 78.34
    // because 21% was ADDED to a price that already included VAT, contradicting both
    // Greek consumer law and this shop's own Terms of Service.
    const result = totals({ lineItems: [item(59)], discounts: [], giftCards: [], currencyCode: CURRENCY });
    expect(result.totals.total.amount).toBe(59 + 6.95);
    expect(result.totals.taxTotal.amount).toBeLessThan(result.totals.total.amount);
  });

  it("extracts VAT from the gross amount rather than adding it to a net one", () => {
    // gross x rate / (1 + rate), not gross x rate — confusing the two is the original bug.
    const result = totals({
      lineItems: [item(124)],
      discounts: [],
      giftCards: [],
      currencyCode: CURRENCY,
      selectedShippingRate: { ...STANDARD_SHIPPING_RATE, price: { amount: 0, currencyCode: CURRENCY } },
    });
    expect(result.totals.total.amount).toBe(124);
    expect(result.totals.taxTotal.amount).toBeCloseTo(24, 2); // 124 gross at 24% contains exactly 24
    expect(VAT_RATE).toBe(0.24);
  });

  it("shrinks the VAT figure when a discount shrinks the gross amount", () => {
    const full = totals({ lineItems: [item(100)], discounts: [], giftCards: [], currencyCode: CURRENCY });
    const discounted = totals({
      lineItems: [item(100)],
      discounts: [{ code: "TEN", type: "percentage", value: 10 }],
      giftCards: [],
      currencyCode: CURRENCY,
    });
    expect(discounted.totals.taxTotal.amount).toBeLessThan(full.totals.taxTotal.amount);
  });

  it("does not reduce VAT when a gift card pays part of the order", () => {
    // A gift card is a means of payment, not a price reduction, so the VAT the sale
    // bore is unchanged by redeeming one.
    const withoutCard = totals({ lineItems: [item(100)], discounts: [], giftCards: [], currencyCode: CURRENCY });
    const withCard = totals({
      lineItems: [item(100)],
      discounts: [],
      giftCards: [{ code: "GC", balanceAmount: 50 }],
      currencyCode: CURRENCY,
    });
    expect(withCard.totals.total.amount).toBeCloseTo(withoutCard.totals.total.amount - 50, 5);
    expect(withCard.totals.taxTotal.amount).toBeCloseTo(withoutCard.totals.taxTotal.amount, 5);
  });

  it("excludes saved-for-later items from the subtotal", () => {
    const result = totals({
      lineItems: [item(50), item(30, 1, true)],
      discounts: [],
      giftCards: [],
      currencyCode: CURRENCY,
    });
    expect(result.totals.subtotal.amount).toBe(50);
  });

  it("applies a percentage discount against the current subtotal", () => {
    const result = totals({
      lineItems: [item(100)],
      discounts: [{ code: "TEN", type: "percentage", value: 10 }],
      giftCards: [],
      currencyCode: CURRENCY,
    });
    expect(result.discounts[0].amount.amount).toBe(10);
  });

  it("clamps a fixed discount to the subtotal", () => {
    const result = totals({
      lineItems: [item(5)],
      discounts: [{ code: "BIG", type: "fixed", value: 50 }],
      giftCards: [],
      currencyCode: CURRENCY,
    });
    expect(result.discounts[0].amount.amount).toBe(5);
  });

  it("applies gift cards in order, each capped by what's still due", () => {
    const result = totals({
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
    const withWrap = totals({ lineItems: [item(20)], discounts: [], giftCards: [], currencyCode: CURRENCY, giftWrap: true });
    expect(withWrap.totals.giftWrapTotal.amount).toBeGreaterThan(0);

    const emptyCartWrap = totals({ lineItems: [], discounts: [], giftCards: [], currencyCode: CURRENCY, giftWrap: true });
    expect(emptyCartWrap.totals.giftWrapTotal.amount).toBe(0);
  });

  it("adds the payment fee to the total, and only when there are active items", () => {
    const withFee = totals({
      lineItems: [item(100)],
      discounts: [],
      giftCards: [],
      currencyCode: CURRENCY,
      paymentFee: 2,
    });
    const withoutFee = totals({ lineItems: [item(100)], discounts: [], giftCards: [], currencyCode: CURRENCY });
    expect(withFee.totals.paymentFeeTotal.amount).toBe(2);
    expect(withFee.totals.total.amount).toBeCloseTo(withoutFee.totals.total.amount + 2, 5);

    const emptyCart = totals({ lineItems: [], discounts: [], giftCards: [], currencyCode: CURRENCY, paymentFee: 2 });
    expect(emptyCart.totals.paymentFeeTotal.amount).toBe(0);
  });

  it("never lets a negative payment fee act as a discount", () => {
    const result = totals({
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
    const result = totals({
      lineItems: [item(10)],
      discounts: [],
      giftCards: [{ code: "GC", balanceAmount: 1000 }],
      currencyCode: CURRENCY,
      paymentFee: 2,
    });
    expect(result.totals.total.amount).toBe(0);
    // No tax term: it is already inside the 10 and the shipping/fee amounts.
    expect(result.giftCards[0].amountApplied.amount).toBeCloseTo(
      10 + result.totals.shippingTotal.amount + 2,
      5
    );
  });

  it("regression: an explicitly selected Standard rate stays free over the shipping threshold (past revenue bug — see PROGRESS.md)", () => {
    const result = totals({
      lineItems: [item(FREE_SHIPPING_THRESHOLD + 50)],
      discounts: [],
      giftCards: [],
      currencyCode: CURRENCY,
      selectedShippingRate: STANDARD_SHIPPING_RATE,
    });
    expect(result.totals.shippingTotal.amount).toBe(0);
  });

  it("charges Express in full even when explicitly selected over the threshold", () => {
    const result = totals({
      lineItems: [item(FREE_SHIPPING_THRESHOLD + 50)],
      discounts: [],
      giftCards: [],
      currencyCode: CURRENCY,
      selectedShippingRate: EXPRESS_SHIPPING_RATE,
    });
    expect(result.totals.shippingTotal.amount).toBe(EXPRESS_SHIPPING_RATE.price.amount);
  });
});
