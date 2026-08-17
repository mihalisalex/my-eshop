import "server-only";
import type {
  PaymentMethodDefinition,
  PaymentMethodId,
  PaymentProvider,
  PaymentProviderId,
} from "@/lib/payments/types";
import { PaymentError } from "@/lib/payments/types";

import { cashOnDeliveryProvider } from "@/lib/payments/providers/cash-on-delivery";
import { bankTransferProvider } from "@/lib/payments/providers/bank-transfer";
import { stripeProvider } from "@/lib/payments/providers/stripe";
import { irisProvider } from "@/lib/payments/providers/iris";
import { piraeusProvider } from "@/lib/payments/providers/piraeus";
import { applePayProvider } from "@/lib/payments/providers/apple-pay";

/**
 * The central provider registry (§28).
 *
 * Registration order is the default display order for a store that hasn't sorted
 * its methods yet — the two methods that work with no external account at all
 * come first, so a fresh install has a working checkout before any credentials
 * exist anywhere.
 *
 * Adding a provider is exactly this: implement `PaymentProvider`, add one line
 * here. Nothing in the checkout, the order system, the admin dashboard, the
 * database or the webhook route needs to change — the admin settings screen
 * renders itself from the provider's own `configFields`, and checkout renders
 * itself from whatever the backend reports as available.
 */
class PaymentProviderRegistry {
  private readonly providers = new Map<PaymentProviderId, PaymentProvider>();

  register(provider: PaymentProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Payment provider "${provider.id}" is already registered.`);
    }
    // Two providers claiming the same method id would make `getMethod` ambiguous
    // and silently route payments to whichever registered first — catch it at
    // boot rather than at checkout.
    for (const method of provider.methods) {
      const owner = this.findMethodOwner(method.id);
      if (owner) {
        throw new Error(`Payment method "${method.id}" is already provided by "${owner.id}".`);
      }
    }
    this.providers.set(provider.id, provider);
  }

  list(): PaymentProvider[] {
    return [...this.providers.values()];
  }

  get(id: PaymentProviderId): PaymentProvider | null {
    return this.providers.get(id) ?? null;
  }

  require(id: PaymentProviderId): PaymentProvider {
    const provider = this.get(id);
    if (!provider) {
      throw new PaymentError("PROVIDER_NOT_FOUND", `No payment provider registered with id "${id}".`);
    }
    return provider;
  }

  /** Every method across every provider, in registration order. */
  listMethods(): PaymentMethodDefinition[] {
    return this.list().flatMap((provider) => [...provider.methods]);
  }

  getMethod(methodId: PaymentMethodId): PaymentMethodDefinition | null {
    return this.listMethods().find((method) => method.id === methodId) ?? null;
  }

  requireMethod(methodId: PaymentMethodId): PaymentMethodDefinition {
    const method = this.getMethod(methodId);
    if (!method) {
      throw new PaymentError("METHOD_NOT_AVAILABLE", `No payment method registered with id "${methodId}".`);
    }
    return method;
  }

  private findMethodOwner(methodId: PaymentMethodId): PaymentProvider | null {
    return this.list().find((provider) => provider.methods.some((m) => m.id === methodId)) ?? null;
  }
}

export const paymentProviderRegistry = new PaymentProviderRegistry();

paymentProviderRegistry.register(cashOnDeliveryProvider);
paymentProviderRegistry.register(bankTransferProvider);
paymentProviderRegistry.register(stripeProvider);
paymentProviderRegistry.register(applePayProvider);
paymentProviderRegistry.register(irisProvider);
paymentProviderRegistry.register(piraeusProvider);
