import type { ShippingRate } from "@/lib/commerce/types";
import type { ShippingSettings } from "@/types";

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
/**
 * Turns the editable settings into the rates the rest of the app prices against.
 *
 * The free-shipping threshold is folded ONTO each eligible rate here, once, at the single
 * point where configuration becomes domain objects. Everything downstream — cart totals,
 * checkout totals, the review step in the browser — then prices from the rate alone and
 * needs no access to settings at all.
 *
 * Disabled rates are dropped: a rate a shopper cannot pick should not appear at checkout.
 */
export function buildShippingRates(settings: ShippingSettings, currencyCode = "EUR"): ShippingRate[] {
  return settings.rates
    .filter((rate) => rate.enabled)
    .map((rate) => ({
      id: rate.id,
      label: rate.label,
      description: rate.description,
      estimatedDelivery: rate.estimatedDelivery,
      price: { amount: rate.amount, currencyCode },
      freeOverAmount: rate.freeShippingEligible ? settings.freeShippingThreshold : null,
    }));
}

/**
 * The rate a shopper picked, or the first available one when they have not picked yet or
 * picked something that no longer exists — a rate can be disabled between a cart being
 * built and its checkout being completed, and an order must still price against something.
 */
export function resolveShippingRate(rates: ShippingRate[], rateId?: string | null): ShippingRate | undefined {
  return rates.find((rate) => rate.id === rateId) ?? rates[0];
}



/**
 * What a rate actually costs for a given basket — the single source of truth, used both to
 * QUOTE a charge at checkout and to CHARGE it server-side, so the two cannot disagree.
 *
 * Express is a paid upgrade and costs its listed price at any basket size; Standard is the
 * rate the sitewide free-shipping promise is about. Without this, `resolveCartAmounts`'s
 * override path charged Standard's flat fee on every order regardless of subtotal,
 * contradicting the "free shipping over €150" banner and silently overcharging every
 * checkout.
 *
 * The threshold now travels on the rate (see `buildShippingRates`) rather than being a
 * constant compared against a hardcoded rate id, so a third rate can be made free-eligible
 * from the admin without touching this function.
 */
export function computeShippingChargeForRate(rate: ShippingRate, taxableAmount: number, hasActiveItems: boolean): number {
  if (!hasActiveItems) return 0;
  if (rate.freeOverAmount != null && taxableAmount >= rate.freeOverAmount) return 0;
  return rate.price.amount;
}
