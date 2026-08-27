import { DEFAULT_LOCALE, LOCALE_TAG } from "@/i18n/config";
import type { Money } from "@/types";

export function formatMoney({ amount, currencyCode }: Money, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/**
 * The short, human-quotable form of an order/payment/return id — the last 8 characters
 * of the cuid, uppercased.
 *
 * It already existed, inlined identically in the admin order and payment tables, the
 * returns lists, the order-confirmation email subject and the Cash-on-Delivery payment
 * instructions. The one place that did NOT use it was the customer's own confirmation
 * page, which printed the raw 25-character cuid under the heading "Order number" while
 * the payment instructions two inches below it quoted the short form — so a shopper
 * emailing about "order cmsx5ks17002aycoc38qlumg3" and an admin looking at "#38QLUMG3"
 * were discussing the same order without either string matching the other.
 */
export function orderReference(id: string): string {
  return id.slice(-8).toUpperCase();
}

/**
 * Defaults to the site's own locale, not "en-US". It is called from Server and Client
 * Components alike and so cannot read the request locale itself; hard-coding English meant
 * every date on the Greek storefront rendered as "JULY 1, 2026". Pass a tag explicitly where
 * a different one is genuinely wanted.
 */
export function formatDate(dateString: string, locale = LOCALE_TAG[DEFAULT_LOCALE]): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
}
