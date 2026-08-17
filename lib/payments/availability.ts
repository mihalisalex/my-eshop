import type { PaymentMethodDefinition, PaymentMethodSettings } from "@/lib/payments/types";

/**
 * Whether one payment method may be offered for one specific order.
 *
 * Deliberately a PURE function with every input passed in, for two reasons.
 * First, it's the single rule the checkout API and the order-time re-validation
 * both call — §21's "the frontend must never determine whether a payment method
 * is actually valid; the backend validates it again" only holds if both
 * validations run the same code. Second, it makes every branch unit-testable
 * without a database.
 *
 * `reason` is populated even when unavailable so the admin can see *why* a method
 * isn't showing (the most common support question about payment configuration),
 * while the storefront simply omits the method.
 */
export interface AvailabilityInput {
  definition: PaymentMethodDefinition;
  settings: PaymentMethodSettings;
  /** The provider's master switch. */
  providerEnabled: boolean;
  /** Whether the provider has the credentials it needs. Always false for an unconnected integration. */
  providerConfigured: boolean;
  /** Order total the method would be used for, before this method's own fee. */
  amount: number;
  currencyCode: string;
  /** Shipping destination, when known. */
  countryCode?: string;
  /** Selected shipping rate id, when known. */
  shippingRateId?: string;
}

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
}

export function evaluateMethodAvailability(input: AvailabilityInput): AvailabilityResult {
  const { definition, settings, providerEnabled, providerConfigured, amount, currencyCode, countryCode, shippingRateId } =
    input;

  if (!settings.enabled) return { available: false, reason: "The payment method is disabled." };
  if (!providerEnabled) return { available: false, reason: `The ${definition.providerId} provider is disabled.` };
  // The gate that keeps an unconnected integration (IRIS, Piraeus) off the
  // storefront no matter how much configuration has been entered.
  if (!providerConfigured) return { available: false, reason: "The provider is not configured." };

  if (definition.supportedCurrencies !== "any" && !definition.supportedCurrencies.includes(currencyCode.toUpperCase())) {
    return { available: false, reason: `This method doesn't support ${currencyCode}.` };
  }

  if (settings.minimumAmount !== null && amount < settings.minimumAmount) {
    return { available: false, reason: `Order total is below the ${settings.minimumAmount} minimum.` };
  }
  if (settings.maximumAmount !== null && amount > settings.maximumAmount) {
    return { available: false, reason: `Order total is above the ${settings.maximumAmount} maximum.` };
  }

  // An empty list means "everywhere" rather than "nowhere" — the opposite default
  // would silently disable a method the moment someone opened and saved its form.
  if (settings.countries.length > 0) {
    if (!countryCode) return { available: false, reason: "A shipping country is required for this method." };
    if (!settings.countries.includes(countryCode.toUpperCase())) {
      return { available: false, reason: `Not available for shipments to ${countryCode}.` };
    }
  }

  if (settings.shippingRateIds.length > 0) {
    if (!shippingRateId) return { available: false, reason: "A delivery method is required for this payment method." };
    if (!settings.shippingRateIds.includes(shippingRateId)) {
      return { available: false, reason: "Not available with the selected delivery method." };
    }
  }

  return { available: true };
}
