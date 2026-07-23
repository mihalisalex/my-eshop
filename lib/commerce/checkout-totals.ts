import type { CartTotals, ShippingRate } from "@/lib/commerce/types";
import { computeShippingChargeForRate } from "@/lib/shipping";
import { GIFT_WRAP_FEE } from "@/lib/gift-wrap";

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
 * Shipping doesn't factor into VAT in this app's model (tax is computed on
 * `subtotal - discount`, before shipping is added), so swapping the shipping
 * amount is a safe direct substitution — no need to re-run discount/tax
 * math, which is why this one function works for both the client-side
 * display (no Prisma/server-only dependency) and the server-side charge.
 */
export function applySelectedShippingRate(totals: CartTotals, selectedRate: ShippingRate | undefined | null): CartTotals {
  if (!selectedRate) return totals;
  const taxableAmount = totals.subtotal.amount - totals.discountTotal.amount;
  const shippingAmount = computeShippingChargeForRate(selectedRate, taxableAmount, totals.subtotal.amount > 0);
  const totalAmount = Math.max(totals.total.amount - totals.shippingTotal.amount + shippingAmount, 0);
  return {
    ...totals,
    shippingTotal: { amount: shippingAmount, currencyCode: totals.shippingTotal.currencyCode },
    total: { amount: totalAmount, currencyCode: totals.total.currencyCode },
  };
}

/** Same overlay pattern as applySelectedShippingRate — a flat fee that doesn't affect tax (added post-tax, same as shipping). */
export function applyGiftWrap(totals: CartTotals, giftWrap: boolean): CartTotals {
  const giftWrapAmount = giftWrap && totals.subtotal.amount > 0 ? GIFT_WRAP_FEE : 0;
  const totalAmount = Math.max(totals.total.amount - totals.giftWrapTotal.amount + giftWrapAmount, 0);
  return {
    ...totals,
    giftWrapTotal: { amount: giftWrapAmount, currencyCode: totals.giftWrapTotal.currencyCode },
    total: { amount: totalAmount, currencyCode: totals.total.currencyCode },
  };
}
