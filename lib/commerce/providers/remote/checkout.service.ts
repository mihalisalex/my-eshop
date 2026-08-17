import type { Checkout, CheckoutService, CompleteCheckoutResult } from "@/lib/commerce/types";
import { fetchJson } from "./http";

export function createRemoteCheckoutService(): CheckoutService {
  return {
    async createCheckout(cartId) {
      return (await fetchJson<{ checkout: Checkout }>("/api/checkout", { method: "POST", body: JSON.stringify({ cartId }) })).checkout;
    },

    async updateEmail(checkoutId, email) {
      return (
        await fetchJson<{ checkout: Checkout }>(`/api/checkout/${checkoutId}`, { method: "PATCH", body: JSON.stringify({ email }) })
      ).checkout;
    },

    async updateShippingAddress(checkoutId, address) {
      return (
        await fetchJson<{ checkout: Checkout }>(`/api/checkout/${checkoutId}`, {
          method: "PATCH",
          body: JSON.stringify({ shippingAddress: address }),
        })
      ).checkout;
    },

    async updateBillingAddress(checkoutId, address) {
      return (
        await fetchJson<{ checkout: Checkout }>(`/api/checkout/${checkoutId}`, {
          method: "PATCH",
          body: JSON.stringify({ billingAddress: address }),
        })
      ).checkout;
    },

    async setShippingRate(checkoutId, rateId) {
      return (
        await fetchJson<{ checkout: Checkout }>(`/api/checkout/${checkoutId}`, {
          method: "PATCH",
          body: JSON.stringify({ shippingRateId: rateId }),
        })
      ).checkout;
    },

    async setGiftWrap(checkoutId, input) {
      return (
        await fetchJson<{ checkout: Checkout }>(`/api/checkout/${checkoutId}`, {
          method: "PATCH",
          body: JSON.stringify({ giftWrap: input.giftWrap, giftMessage: input.giftMessage }),
        })
      ).checkout;
    },

    async setPaymentMethod(checkoutId, paymentMethodId) {
      return (
        await fetchJson<{ checkout: Checkout }>(`/api/checkout/${checkoutId}`, {
          method: "PATCH",
          body: JSON.stringify({ paymentMethodId }),
        })
      ).checkout;
    },

    // `cart` kept for interface parity — the server ignores it and always re-fetches
    // the authoritative cart itself (see app/api/checkout/[checkoutId]/complete/route.ts).
    async completeCheckout(checkoutId, cart) {
      return await fetchJson<CompleteCheckoutResult>(`/api/checkout/${checkoutId}/complete`, {
        method: "POST",
        body: JSON.stringify({ cart }),
      });
    },
  };
}
