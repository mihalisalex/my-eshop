import "server-only";
import type { AppliedDiscount, AppliedGiftCard, CartTotals, ShippingRate } from "@/lib/commerce/types";
import type { Money } from "@/types";
import { computeShippingChargeForRate, vatIncludedIn } from "@/lib/shipping";
import { GIFT_WRAP_FEE } from "@/lib/gift-wrap";

/** Relocated from the mock's providers/mock/storage.ts — now purely a server-side money-rounding helper. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function money(amount: number, currencyCode: string): Money {
  return { amount: round2(amount), currencyCode };
}

export interface ComputeTotalsLineItem {
  unitPriceAmount: number;
  quantity: number;
  savedForLater: boolean;
}

export interface CartDiscountRule {
  code: string;
  type: "percentage" | "fixed";
  value: number;
}

export interface CartGiftCardRule {
  code: string;
  /** Snapshot of the gift card's balance taken at apply-time (see CartGiftCard's schema comment) — not necessarily the live GiftCard.balanceAmount. */
  balanceAmount: number;
}

export interface ResolvedCartAmounts {
  totals: CartTotals;
  discounts: AppliedDiscount[];
  giftCards: AppliedGiftCard[];
}

/**
 * Recomputes discount/gift-card amounts fresh against the cart's CURRENT
 * subtotal on every call — never trusts a previously-persisted amount.
 *
 * A discount/gift-card's effective amount depends on the cart's subtotal
 * (and, for gift cards, the running total after tax/shipping), both of
 * which change every time a line item is added, removed, or its quantity
 * changes. The original implementation computed `amount`/`amountApplied`
 * once at apply-time and persisted it verbatim — a real, exploitable bug:
 * apply a code against a large cart (e.g. a 10% discount on €300), then
 * remove items down to a few euros, and the frozen €30 discount (plus any
 * gift card) would still apply in full, clamped to zero rather than
 * re-percented, letting the order complete for near-free. Recomputing here
 * on every read closes that gap — the persisted `type`/`value` (discount)
 * and balance snapshot (gift card) are the source of truth for the RULE,
 * never for the computed RESULT.
 */
export function resolveCartAmounts(input: {
  lineItems: ComputeTotalsLineItem[];
  discounts: CartDiscountRule[];
  giftCards: CartGiftCardRule[];
  currencyCode: string;
  /**
   * The rate to price against: whichever the shopper picked during checkout, or the store's
   * default one for a cart that has not reached checkout yet.
   *
   * Required rather than optional now that rates are configurable. It used to be omittable,
   * falling back to a hardcoded Standard rate and a hardcoded threshold inside this module —
   * which meant a caller that forgot to pass one silently priced against constants the admin
   * could no longer see. Making it required turns that into a compile error.
   */
  selectedShippingRate: ShippingRate | undefined;
  /** Set once a shopper has opted into gift wrapping during checkout — a flat fee, not tied to line items. */
  giftWrap?: boolean;
  /**
   * Surcharge for the selected payment method, already computed by
   * lib/payments/fees.ts. Passed in rather than computed here so this module stays
   * free of database access — the fee's *rule* lives in PaymentMethodSetting, and
   * the caller (services/payments.ts / the checkout API) is what reads it. Both the
   * quote shown at checkout and the amount actually charged go through this same
   * parameter, so they cannot disagree.
   */
  paymentFee?: number;
}): ResolvedCartAmounts {
  const { lineItems, discounts, giftCards, currencyCode, selectedShippingRate, giftWrap, paymentFee } = input;
  const activeItems = lineItems.filter((item) => !item.savedForLater);
  const subtotalAmount = activeItems.reduce((sum, item) => sum + item.unitPriceAmount * item.quantity, 0);

  const resolvedDiscounts: AppliedDiscount[] = discounts.map((d) => {
    const amount = d.type === "percentage" ? (subtotalAmount * d.value) / 100 : Math.min(d.value, subtotalAmount);
    return { code: d.code, type: d.type, value: d.value, amount: money(amount, currencyCode) };
  });
  const discountAmount = resolvedDiscounts.reduce((sum, d) => sum + d.amount.amount, 0);

  const taxableAmount = Math.max(subtotalAmount - discountAmount, 0);
  // No rate at all means no rate is configured or enabled — charge nothing rather than
  // inventing a price. The free-shipping rule travels on the rate itself (buildShippingRates).
  const shippingAmount = selectedShippingRate
    ? computeShippingChargeForRate(selectedShippingRate, taxableAmount, activeItems.length > 0)
    : 0;
  const giftWrapAmount = giftWrap && activeItems.length > 0 ? GIFT_WRAP_FEE : 0;
  // An empty cart can't owe a payment surcharge — same guard as gift wrapping.
  const paymentFeeAmount = activeItems.length > 0 ? Math.max(paymentFee ?? 0, 0) : 0;

  // Every one of these amounts already includes VAT, so the total is a plain sum — the
  // tax figure below is extracted FROM it for the invoice, never added TO it. This is the
  // whole shape of the inclusive model: what the shopper saw on the product card is what
  // they pay, and `taxTotal` only tells them how much of it was VAT.
  const preGiftCardTotal = taxableAmount + shippingAmount + giftWrapAmount + paymentFeeAmount;

  // Computed on the pre-gift-card figure on purpose. A gift card is a means of payment,
  // not a price reduction, so redeeming one does not change how much VAT the sale bore.
  const taxAmount = activeItems.length === 0 ? 0 : vatIncludedIn(preGiftCardTotal);

  // Gift cards apply in stored (application) order, each capped at whatever's
  // still owed after the ones before it — same re-derive-don't-trust fix.
  let remainingDue = preGiftCardTotal;
  const resolvedGiftCards: AppliedGiftCard[] = giftCards.map((g) => {
    const amountApplied = Math.min(g.balanceAmount, Math.max(remainingDue, 0));
    remainingDue -= amountApplied;
    return {
      code: g.code,
      balance: money(g.balanceAmount, currencyCode),
      amountApplied: money(amountApplied, currencyCode),
    };
  });
  const giftCardAmount = resolvedGiftCards.reduce((sum, g) => sum + g.amountApplied.amount, 0);
  const totalAmount = Math.max(preGiftCardTotal - giftCardAmount, 0);

  return {
    totals: {
      subtotal: money(subtotalAmount, currencyCode),
      discountTotal: money(discountAmount, currencyCode),
      giftCardTotal: money(giftCardAmount, currencyCode),
      shippingTotal: money(shippingAmount, currencyCode),
      giftWrapTotal: money(giftWrapAmount, currencyCode),
      paymentFeeTotal: money(paymentFeeAmount, currencyCode),
      taxTotal: money(taxAmount, currencyCode),
      total: money(totalAmount, currencyCode),
    },
    discounts: resolvedDiscounts,
    giftCards: resolvedGiftCards,
  };
}
