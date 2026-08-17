import { describe, expect, it } from "vitest";
import { evaluateMethodAvailability, type AvailabilityInput } from "./availability";
import type { PaymentMethodDefinition, PaymentMethodSettings } from "./types";

const definition: PaymentMethodDefinition = {
  id: "test-method",
  providerId: "test-provider",
  name: "Test method",
  defaultDisplayName: "Test",
  defaultDescription: "",
  type: "offline",
  defaultEnabled: true,
  requiresRedirect: false,
  requiresManualConfirmation: true,
  requiresWebhook: false,
  supportsRefunds: true,
  supportsPartialRefunds: true,
  supportsCapture: false,
  supportsRecurring: false,
  supportedCurrencies: "any",
  icon: "cash",
};

const settings: PaymentMethodSettings = {
  methodId: "test-method",
  enabled: true,
  sortOrder: 0,
  displayName: null,
  description: null,
  feeType: "none",
  feeValue: 0,
  minimumAmount: null,
  maximumAmount: null,
  countries: [],
  shippingRateIds: [],
};

function evaluate(overrides: Partial<AvailabilityInput> = {}) {
  return evaluateMethodAvailability({
    definition,
    settings,
    providerEnabled: true,
    providerConfigured: true,
    amount: 100,
    currencyCode: "EUR",
    ...overrides,
  });
}

describe("evaluateMethodAvailability", () => {
  it("is available when everything lines up", () => {
    expect(evaluate().available).toBe(true);
  });

  it("hides a disabled method", () => {
    expect(evaluate({ settings: { ...settings, enabled: false } }).available).toBe(false);
  });

  it("hides every method of a disabled provider", () => {
    expect(evaluate({ providerEnabled: false }).available).toBe(false);
  });

  it("hides an unconfigured provider even when the method is enabled", () => {
    // This is the gate that keeps an unconnected integration (IRIS, Piraeus) off the
    // storefront no matter how much configuration has been entered.
    const result = evaluate({ providerConfigured: false });
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/not configured/i);
  });

  it("enforces minimum and maximum order amounts", () => {
    const bounded = { ...settings, minimumAmount: 20, maximumAmount: 500 };
    expect(evaluate({ settings: bounded, amount: 19.99 }).available).toBe(false);
    expect(evaluate({ settings: bounded, amount: 20 }).available).toBe(true);
    expect(evaluate({ settings: bounded, amount: 500 }).available).toBe(true);
    expect(evaluate({ settings: bounded, amount: 500.01 }).available).toBe(false);
  });

  it("treats an empty country list as 'everywhere', not 'nowhere'", () => {
    // The opposite default would silently disable a method the moment someone opened
    // and saved its settings form.
    expect(evaluate({ countryCode: undefined }).available).toBe(true);
    expect(evaluate({ countryCode: "AU" }).available).toBe(true);
  });

  it("restricts by country when a list is set, case-insensitively", () => {
    const restricted = { ...settings, countries: ["GR", "CY"] };
    expect(evaluate({ settings: restricted, countryCode: "gr" }).available).toBe(true);
    expect(evaluate({ settings: restricted, countryCode: "DE" }).available).toBe(false);
    // No destination known yet — refuse rather than assume it's allowed.
    expect(evaluate({ settings: restricted, countryCode: undefined }).available).toBe(false);
  });

  it("restricts by delivery method when a list is set", () => {
    const restricted = { ...settings, shippingRateIds: ["standard"] };
    expect(evaluate({ settings: restricted, shippingRateId: "standard" }).available).toBe(true);
    expect(evaluate({ settings: restricted, shippingRateId: "express" }).available).toBe(false);
  });

  it("refuses a currency the method doesn't support", () => {
    const eurOnly = { ...definition, supportedCurrencies: ["EUR"] as const };
    expect(evaluate({ definition: eurOnly, currencyCode: "eur" }).available).toBe(true);
    expect(evaluate({ definition: eurOnly, currencyCode: "USD" }).available).toBe(false);
  });
});
