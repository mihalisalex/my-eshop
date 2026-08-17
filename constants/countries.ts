export interface Country {
  code: string;
  name: string;
}

/**
 * The shop's home market, and the default selection on every address form.
 *
 * Both forms used to default to "US" with Greece ninth in the list, so a Greek
 * customer had to notice and change it — and anyone who didn't got a US address on
 * their order.
 */
export const DEFAULT_COUNTRY_CODE = "GR";

/**
 * Greece first, then the rest alphabetically.
 *
 * NOTE: this list is what the shop currently offers to ship to, and it still includes
 * destinations served by the same flat EUR 6.95 / EUR 14.95 rates as a domestic order
 * (see lib/shipping.ts) — shipping a pair of shoes to Australia at that price, or free
 * over EUR 150, loses money on every order. Narrowing this list, or introducing
 * per-zone rates, is a commercial decision rather than a code fix.
 */
export const COUNTRIES: Country[] = [
  { code: "GR", name: "Greece" },
  { code: "AU", name: "Australia" },
  { code: "BE", name: "Belgium" },
  { code: "CA", name: "Canada" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "PT", name: "Portugal" },
  { code: "ES", name: "Spain" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
];

export function isSupportedCountryCode(code: string): boolean {
  return COUNTRIES.some((country) => country.code === code.trim().toUpperCase());
}
