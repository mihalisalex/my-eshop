import type { ShippingRate } from "@/lib/commerce/types";

/**
 * Single source of truth for shipping/tax constants. Previously duplicated
 * independently in the mock's cart.service.ts and checkout.service.ts (same two
 * rates, defined twice) — Postgres-backed carts/checkouts both import this instead.
 */

/** Illustrative flat VAT — a real adapter (Shopify/Avalara/etc) computes this from the destination address. */
export const VAT_RATE = 0.21;
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
