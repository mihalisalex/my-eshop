import { describe, expect, it } from "vitest";
import { paymentProviderRegistry } from "./registry";

/**
 * Structural guarantees the whole architecture rests on. These would all pass
 * trivially today and start failing the moment someone adds a provider carelessly
 * — which is exactly when they earn their keep.
 */
describe("payment provider registry", () => {
  it("registers the six providers the shop supports", () => {
    expect(paymentProviderRegistry.list().map((p) => p.id).sort()).toEqual([
      "apple-pay",
      "bank-transfer",
      "cash-on-delivery",
      "iris",
      "piraeus",
      "stripe",
    ]);
  });

  it("gives every method a unique id owned by exactly one provider", () => {
    const ids = paymentProviderRegistry.listMethods().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("makes every method resolvable back to its own provider", () => {
    for (const method of paymentProviderRegistry.listMethods()) {
      expect(paymentProviderRegistry.get(method.providerId)?.id).toBe(method.providerId);
    }
  });

  it("throws rather than returning null for an unknown provider or method", () => {
    expect(paymentProviderRegistry.get("does-not-exist")).toBeNull();
    expect(() => paymentProviderRegistry.require("does-not-exist")).toThrow(/No payment provider/);
    expect(() => paymentProviderRegistry.requireMethod("does-not-exist")).toThrow(/No payment method/);
  });

  it("refuses to register the same provider twice", () => {
    const existing = paymentProviderRegistry.require("stripe");
    expect(() => paymentProviderRegistry.register(existing)).toThrow(/already registered/);
  });

  it("keeps each provider's default-enabled state in step with its methods'", () => {
    // These two switches must agree. When they didn't, a fresh install shipped
    // methods that were enabled but whose provider was off, so checkout offered
    // nothing at all — found during live verification, not by the type checker.
    for (const provider of paymentProviderRegistry.list()) {
      const anyMethodDefaultsOn = provider.methods.some((m) => m.defaultEnabled);
      expect(provider.defaultEnabled).toBe(anyMethodDefaultsOn);
    }
  });

  it("only defaults the two credential-free methods to enabled", () => {
    // A method that needs credentials must never be on before someone supplies them,
    // or the first real shopper hits a failure the shop never chose to risk.
    const defaultOn = paymentProviderRegistry
      .listMethods()
      .filter((m) => m.defaultEnabled)
      .map((m) => m.id)
      .sort();
    expect(defaultOn).toEqual(["bank-transfer", "cash-on-delivery"]);
  });

  it("marks unconnected integrations as pending and never as configured", () => {
    for (const id of ["iris", "piraeus"] as const) {
      const provider = paymentProviderRegistry.require(id);
      expect(provider.integrationPending).toBe(true);
      // Whatever configuration is present, it reports itself unconfigured — which is
      // what keeps it off the checkout.
      expect(
        provider.isConfigured({
          providerId: id,
          environment: "production",
          values: { merchantId: "anything", apiBaseUrl: "https://example.test" },
          secrets: { apiKey: "anything", apiSecret: "anything" },
          sourcedFromEnv: new Set(),
        })
      ).toBe(false);
    }
  });

  it("declares a webhook parser for exactly the providers that claim webhook support", () => {
    for (const provider of paymentProviderRegistry.list()) {
      expect(typeof provider.parseWebhook === "function").toBe(provider.webhookSupported);
    }
  });

  it("only lets a provider that declares a processor delegate to a registered one", () => {
    for (const provider of paymentProviderRegistry.list()) {
      if (!provider.processingProviderIdFor) continue;
      const processorId = provider.processingProviderIdFor({
        providerId: provider.id,
        environment: "production",
        values: {},
        secrets: {},
        sourcedFromEnv: new Set(),
      });
      expect(processorId).not.toBeNull();
      expect(paymentProviderRegistry.get(processorId!)).not.toBeNull();
    }
  });
});
