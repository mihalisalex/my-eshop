import type { PaymentMethodSettings } from "@/lib/payments/types";

/** Same rounding helper the cart totals use — kept local so this module stays pure and importable from tests. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The ONLY place a payment fee is computed.
 *
 * §22 requires this to be server-side, and the reason is concrete: the browser
 * knows which method the shopper picked, so if it also computed the surcharge,
 * a modified request could zero out a €2 COD fee — or, worse, the fee shown at
 * checkout could drift from the fee actually charged. The checkout API calls
 * this to *display* a fee and services/payments.ts calls the same function to
 * *charge* it, so the two cannot disagree.
 *
 * `base` is the amount the fee applies to (order total before the payment fee),
 * which matters for percentage fees.
 */
export function computePaymentFee(settings: Pick<PaymentMethodSettings, "feeType" | "feeValue">, base: number): number {
  if (settings.feeType === "none") return 0;
  if (!Number.isFinite(settings.feeValue) || settings.feeValue <= 0) return 0;
  if (base <= 0) return 0;

  const fee = settings.feeType === "percentage" ? (base * settings.feeValue) / 100 : settings.feeValue;
  // A negative fee would be a discount smuggled in through the payments config,
  // and an unbounded one is almost certainly a data-entry slip (2 vs 200%).
  return round2(Math.max(fee, 0));
}

/** Human-readable summary for the checkout radio and the admin table, e.g. "+€2.00" or "+2%". */
export function describePaymentFee(
  settings: Pick<PaymentMethodSettings, "feeType" | "feeValue">,
  currencyCode: string,
  locale = "en-US"
): string | null {
  if (settings.feeType === "none" || settings.feeValue <= 0) return null;
  if (settings.feeType === "percentage") return `+${settings.feeValue}%`;
  return `+${new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(settings.feeValue)}`;
}
