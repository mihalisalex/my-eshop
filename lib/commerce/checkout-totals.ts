import type { CartTotals, ShippingRate } from "@/lib/commerce/types";
import { computeShippingChargeForRate, vatIncludedIn } from "@/lib/shipping";
import { GIFT_WRAP_FEE } from "@/lib/gift-wrap";

/** Matches resolveCartAmounts: VAT is extracted from the pre-gift-card total, not added to it. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Every overlay below substitutes one VAT-INCLUSIVE component of the total, so the
 * informational tax line has to move with it. Under the old exclusive model tax was
 * computed on `subtotal - discount` alone and shipping genuinely did not affect it, which
 * is why these functions used to swap an amount and leave `taxTotal` untouched. That
 * shortcut is now wrong: changing Standard to Express changes how much VAT the order
 * bears.
 */
function withTotal(totals: CartTotals, nextTotal: number): CartTotals {
  const total = Math.max(nextTotal, 0);
  // Gift cards are a payment method, so they sit outside the VAT base — add back whatever
  // they covered to recover the figure the tax was borne on.
  const vatBase = total + totals.giftCardTotal.amount;
  return {
    ...totals,
    total: { amount: round2(total), currencyCode: totals.total.currencyCode },
    taxTotal: { amount: round2(vatIncludedIn(vatBase)), currencyCode: totals.taxTotal.currencyCode },
  };
}

/**
 * `Cart.totals` always reflects the generic standard/free shipping estimate
 * (`lib/shipping.ts`'s `computeShippingAmount`) — it has no concept of a
 * specific rate the shopper picked during checkout. Once `CheckoutProvider`
 * has a `selectedRateId`/`checkout.shippingRate`, this overlays that rate's
 * real charge onto the totals for both display (OrderSummary throughout the
 * checkout flow) and the final charge (`services/checkout.ts`'s
 * `completeCheckout`, via the Postgres-only `resolveCartAmounts`) — previously
 * neither did this, so choosing Express shipping cost the same as Standard
 * (or free): a real revenue leak, not just a display bug.
 *
 * The "real charge" still has to honor the free-shipping-over-threshold
 * promise for Standard specifically (Express is a paid upgrade and always
 * costs its listed price) — `computeShippingChargeForRate` is the single
 * source of truth for that distinction, shared with the server-side charge.
 *
 * The shipping charge is VAT-inclusive like every other amount here, so `withTotal`
 * re-derives the informational tax line rather than leaving it alone.
 */
export function applySelectedShippingRate(totals: CartTotals, selectedRate: ShippingRate | undefined | null): CartTotals {
  if (!selectedRate) return totals;
  const taxableAmount = totals.subtotal.amount - totals.discountTotal.amount;
  const shippingAmount = computeShippingChargeForRate(selectedRate, taxableAmount, totals.subtotal.amount > 0);
  return withTotal(
    { ...totals, shippingTotal: { amount: shippingAmount, currencyCode: totals.shippingTotal.currencyCode } },
    totals.total.amount - totals.shippingTotal.amount + shippingAmount
  );
}

/** Same overlay pattern as applySelectedShippingRate — a flat, VAT-inclusive fee. */
export function applyGiftWrap(totals: CartTotals, giftWrap: boolean): CartTotals {
  const giftWrapAmount = giftWrap && totals.subtotal.amount > 0 ? GIFT_WRAP_FEE : 0;
  return withTotal(
    { ...totals, giftWrapTotal: { amount: giftWrapAmount, currencyCode: totals.giftWrapTotal.currencyCode } },
    totals.total.amount - totals.giftWrapTotal.amount + giftWrapAmount
  );
}

/**
 * Overlays the payment-method surcharge for DISPLAY only.
 *
 * The fee itself is never computed here: the browser is handed an
 * already-calculated amount by `GET /api/payment-methods`, whose value came from
 * `lib/payments/fees.ts` reading the store's own configuration. That separation is
 * the point of §22 — if the client could derive the fee, a modified request could
 * show one number and pay another. The server recomputes it from scratch at order
 * time and that recomputation, not this one, is what is charged.
 */
export function applyPaymentFee(totals: CartTotals, feeAmount: number): CartTotals {
  const fee = totals.subtotal.amount > 0 ? Math.max(feeAmount, 0) : 0;
  return withTotal(
    { ...totals, paymentFeeTotal: { amount: fee, currencyCode: totals.paymentFeeTotal.currencyCode } },
    totals.total.amount - totals.paymentFeeTotal.amount + fee
  );
}
