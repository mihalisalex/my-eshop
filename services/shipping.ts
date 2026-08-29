import "server-only";
import { cache } from "react";
import shippingFallback from "@/data/shipping.json";
import { getSiteContent, setSiteContent } from "@/lib/site-content";
import { buildShippingRates, resolveShippingRate } from "@/lib/shipping";
import type { ShippingSettings } from "@/types";

/**
 * Editable shipping configuration.
 *
 * Same SiteContent pattern as site settings, SEO, navigation and the homepage: the database
 * row is authoritative and `data/shipping.json` is only the fallback for a fresh install.
 * Editing that JSON alone therefore changes nothing a customer sees — the same trap that let
 * the demo domain and the English announcement bar survive for months.
 *
 * Request-scoped via `cache`. Pricing a cart reads these settings, and a cart is mapped
 * several times in one request (read it, mutate it, re-read it), so an uncached read would
 * put a query behind every one. This collapses them to a single query per request without
 * introducing a stale window across requests — an admin saving new rates takes effect on the
 * very next one.
 */
export const getShippingSettings = cache(async function getShippingSettings(): Promise<ShippingSettings> {
  return getSiteContent<ShippingSettings>("shipping", shippingFallback as ShippingSettings);
});

/** Every rate a shopper can currently pick, with the free-shipping threshold already folded in. */
export const getShippingRates = cache(async function getShippingRates() {
  return buildShippingRates(await getShippingSettings());
});

/**
 * The rate a cart is priced against before the shopper has chosen one — the first enabled.
 * Returns undefined when the store has no enabled rate, which prices shipping at zero rather
 * than inventing a number.
 */
export const getDefaultShippingRate = cache(async function getDefaultShippingRate() {
  return resolveShippingRate(await getShippingRates());
});

export async function saveShippingSettings(settings: ShippingSettings): Promise<void> {
  await setSiteContent<ShippingSettings>("shipping", settings);
}
