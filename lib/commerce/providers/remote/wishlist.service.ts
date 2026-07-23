import type { Wishlist, WishlistService } from "@/lib/commerce/types";
import { fetchJson } from "./http";

interface WishlistResponse {
  wishlist: Wishlist;
}

export function createRemoteWishlistService(): WishlistService {
  return {
    async getWishlist(ownerId) {
      return (await fetchJson<WishlistResponse>(`/api/wishlist?ownerId=${encodeURIComponent(ownerId)}`)).wishlist;
    },

    async addItem(ownerId, productId) {
      return (
        await fetchJson<WishlistResponse>(`/api/wishlist?ownerId=${encodeURIComponent(ownerId)}`, {
          method: "POST",
          body: JSON.stringify({ productId }),
        })
      ).wishlist;
    },

    async removeItem(ownerId, productId) {
      return (
        await fetchJson<WishlistResponse>(
          `/api/wishlist?ownerId=${encodeURIComponent(ownerId)}&productId=${encodeURIComponent(productId)}`,
          { method: "DELETE" }
        )
      ).wishlist;
    },

    async linkCustomer(anonymousId) {
      return (
        await fetchJson<WishlistResponse>("/api/wishlist/link-customer", {
          method: "POST",
          body: JSON.stringify({ anonymousId }),
        })
      ).wishlist;
    },
  };
}
