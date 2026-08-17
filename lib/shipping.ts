import type { ShippingRate } from "@/lib/commerce/types";

/**
 * Single source of truth for shipping/tax constants. Previously duplicated
 * independently in the mock's cart.service.ts and checkout.service.ts (same two
 * rates, defined twice) — Postgres-backed carts/checkouts both import this instead.
 */

/**
 * Greek standard VAT.
 *
 * Every customer-facing amount in this app — product price, shipping, gift wrap, the
 * payment surcharge — is VAT-INCLUSIVE. The tax line on the cart, the checkout and the
 * order is therefore informational: it says how much of what the shopper is already
 * paying is VAT, and it is NOT added to the total.
 *
 * This was previously 0.21 and applied the other way round, as tax ADDED on top of the
 * displayed price, which had three separate problems: the rate was not a Greek one, EU
 * consumer law requires displayed prices to include VAT, and the site's own Terms of
 * Service already told shoppers "all prices ... include VAT". A EUR 59 product billed at
 * EUR 78.34.
 *
 * A real tax adapter (Avalara and similar) would derive both the rate and the
 * inclusive/exclusive treatment from the destination address; this is a single-market
 * shop, so one constant is the honest representation.
 */
export const VAT_RATE = 0.24;

/**
 * The VAT contained within a gross, VAT-inclusive amount — `gross × rate / (1 + rate)`,
 * NOT `gross × rate`, which is the amount you would ADD to a net figure. Getting these
 * two confused is exactly how the old behaviour arose.
 */
export function vatIncludedIn(grossAmount: number): number {
  return (grossAmount * VAT_RATE) / (1 + VAT_RATE);
}
export const FREE_SHIPPING_THRESHOLD = 150;
export const STANDARD_SHIPPING_AMOUNT = 6.95;
export const EXPRESS_SHIPPING_AMOUNT = 14.95;

export const STANDARD_SHIPPING_RATE: ShippingRate = {
  id: "standard",
  label: "Standard Shipping",
  description: "3–5 business days",
  price: { amount: STANDARD_SHIPPING_AMOUNT, currencyCode: "EUR" },
  estimatedDelivery: "3–5 business days",
};

export const EXPRESS_SHIPPING_RATE: ShippingRate = {
  id: "express",
  label: "Express Shipping",
  description: "1–2 business days",
  price: { amount: EXPRESS_SHIPPING_AMOUNT, currencyCode: "EUR" },
  estimatedDelivery: "1–2 business days",
};

export function getShippingRates(): ShippingRate[] {
  return [STANDARD_SHIPPING_RATE, EXPRESS_SHIPPING_RATE];
}

export function resolveShippingRate(rateId: string): ShippingRate {
  return rateId === "express" ? EXPRESS_SHIPPING_RATE : STANDARD_SHIPPING_RATE;
}

export function computeShippingAmount(taxableAmount: number, hasActiveItems: boolean): number {
  if (!hasActiveItems || taxableAmount >= FREE_SHIPPING_THRESHOLD) return 0;
  return STANDARD_SHIPPING_AMOUNT;
}

/**
 * Once a shopper has picked a specific rate at checkout, this is what actually
 * gets charged. Express is a paid upgrade and always costs its listed price —
 * but Standard is the same rate the free-shipping-over-threshold promise
 * applies to, so picking it explicitly must not bypass that promise. Without
 * this, `resolveCartAmounts`'s override path charged Standard's flat €6.95 on
 * every order regardless of subtotal, contradicting the "free shipping over
 * €150" banner shown sitewide and silently overcharging every checkout.
 */
export function computeShippingChargeForRate(rate: ShippingRate, taxableAmount: number, hasActiveItems: boolean): number {
  if (!hasActiveItems) return 0;
  if (rate.id === STANDARD_SHIPPING_RATE.id && taxableAmount >= FREE_SHIPPING_THRESHOLD) return 0;
  return rate.price.amount;
}
