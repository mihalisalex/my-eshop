import type { Product } from "@/types";
import type { AddLineItemInput, Address, Cart, CartService, ShippingRate } from "@/lib/commerce/types";
import { fetchJson } from "./http";

interface CartResponse {
  cart: Cart;
}

/** Browser-side CartService — cart id is a capability token (see app/api/cart/route.ts), no auth headers needed for any method here except linkCustomer. */
export function createRemoteCartService(): CartService {
  return {
    async getOrCreateCart(cartId) {
      const query = cartId ? `?cartId=${encodeURIComponent(cartId)}` : "";
      return (await fetchJson<CartResponse>(`/api/cart${query}`)).cart;
    },

    async getCart(cartId) {
      const { cart } = await fetchJson<{ cart: Cart | null }>(`/api/cart/${cartId}`);
      return cart;
    },

    async addLineItem(cartId, input: AddLineItemInput) {
      return (await fetchJson<CartResponse>(`/api/cart/${cartId}/items`, { method: "POST", body: JSON.stringify(input) })).cart;
    },

    async updateLineItemQuantity(cartId, lineItemId, quantity) {
      return (
        await fetchJson<CartResponse>(`/api/cart/${cartId}/items/${lineItemId}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity }),
        })
      ).cart;
    },

    async removeLineItem(cartId, lineItemId) {
      return (await fetchJson<CartResponse>(`/api/cart/${cartId}/items/${lineItemId}`, { method: "DELETE" })).cart;
    },

    async saveForLater(cartId, lineItemId) {
      return (
        await fetchJson<CartResponse>(`/api/cart/${cartId}/items/${lineItemId}`, {
          method: "PATCH",
          body: JSON.stringify({ savedForLater: true }),
        })
      ).cart;
    },

    async moveToCart(cartId, lineItemId) {
      return (
        await fetchJson<CartResponse>(`/api/cart/${cartId}/items/${lineItemId}`, {
          method: "PATCH",
          body: JSON.stringify({ savedForLater: false }),
        })
      ).cart;
    },

    async applyDiscountCode(cartId, code) {
      return (
        await fetchJson<CartResponse>(`/api/cart/${cartId}/discount-codes`, { method: "POST", body: JSON.stringify({ code }) })
      ).cart;
    },

    async removeDiscountCode(cartId, code) {
      return (
        await fetchJson<CartResponse>(`/api/cart/${cartId}/discount-codes?code=${encodeURIComponent(code)}`, { method: "DELETE" })
      ).cart;
    },

    async applyGiftCard(cartId, code) {
      return (
        await fetchJson<CartResponse>(`/api/cart/${cartId}/gift-cards`, { method: "POST", body: JSON.stringify({ code }) })
      ).cart;
    },

    async removeGiftCard(cartId, code) {
      return (
        await fetchJson<CartResponse>(`/api/cart/${cartId}/gift-cards?code=${encodeURIComponent(code)}`, { method: "DELETE" })
      ).cart;
    },

    async estimateShipping(cartId, address: Partial<Address>) {
      return (
        await fetchJson<{ rates: ShippingRate[] }>(`/api/cart/${cartId}/shipping-rates`, {
          method: "POST",
          body: JSON.stringify({ address }),
        })
      ).rates;
    },

    async linkCustomer(cartId) {
      return (await fetchJson<CartResponse>(`/api/cart/${cartId}/link-customer`, { method: "POST" })).cart;
    },

    async getRecommendations(cartId, limit) {
      const query = limit ? `?limit=${limit}` : "";
      return (await fetchJson<{ products: Product[] }>(`/api/cart/${cartId}/recommendations${query}`)).products;
    },

    async clearCart(cartId) {
      return (await fetchJson<CartResponse>(`/api/cart/${cartId}`, { method: "DELETE" })).cart;
    },
  };
}
