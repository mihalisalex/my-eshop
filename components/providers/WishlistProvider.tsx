"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCommerceProvider } from "@/lib/commerce";
import type { Wishlist } from "@/lib/commerce/types";
import { generateId, readStorage, writeStorage } from "@/lib/client-storage";
import { useToast } from "@/components/providers/ToastProvider";

const ANONYMOUS_ID_KEY = "alexandris_anonymous_id";

function getAnonymousId(): string {
  const existing = readStorage<string | null>(ANONYMOUS_ID_KEY, null);
  if (existing) return existing;
  const id = generateId("anon");
  writeStorage(ANONYMOUS_ID_KEY, id);
  return id;
}

interface WishlistContextValue {
  wishlist: Wishlist | null;
  isLoading: boolean;
  productIds: Set<string>;
  toggle: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  /** Merges this browser's anonymous wishlist into the just-signed-in customer's — call once right after sign-in/sign-up. */
  linkToCustomer: () => Promise<void>;
  /** Returns the full shareable URL, generating the token on first call (idempotent server-side after that). */
  share: () => Promise<string>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const commerce = useMemo(() => getCommerceProvider(), []);
  const { toast } = useToast();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // localStorage isn't available during SSR, so the anonymous id and the wishlist it
  // owns can only be resolved after mount.
  useEffect(() => {
    const id = getAnonymousId();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOwnerId(id);
    commerce.wishlist.getWishlist(id).then((initial) => {
      setWishlist(initial);
      setIsLoading(false);
    });
  }, [commerce]);

  const toggle = useCallback(
    async (productId: string) => {
      if (!ownerId) return;
      const alreadyIn = wishlist?.items.some((item) => item.productId === productId) ?? false;
      const updated = alreadyIn
        ? await commerce.wishlist.removeItem(ownerId, productId)
        : await commerce.wishlist.addItem(ownerId, productId);
      setWishlist(updated);
      commerce.analytics.track({ name: alreadyIn ? "remove_from_wishlist" : "add_to_wishlist", properties: { productId } });
      toast({ title: alreadyIn ? "Removed from wishlist" : "Added to wishlist" });
    },
    [ownerId, wishlist, commerce, toast]
  );

  const productIds = useMemo(() => new Set((wishlist?.items ?? []).map((item) => item.productId)), [wishlist]);

  const linkToCustomer = useCallback(async () => {
    if (!ownerId) return;
    const merged = await commerce.wishlist.linkCustomer(ownerId);
    setWishlist(merged);
  }, [ownerId, commerce]);

  const share = useCallback(async () => {
    const params = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : "";
    const res = await fetch(`/api/wishlist/share${params}`, { method: "POST" });
    if (!res.ok) throw new Error("Couldn't create a share link.");
    const body = (await res.json()) as { shareToken: string };
    return `${window.location.origin}/wishlist/shared/${body.shareToken}`;
  }, [ownerId]);

  const value: WishlistContextValue = {
    wishlist,
    isLoading,
    productIds,
    toggle,
    isInWishlist: (productId: string) => productIds.has(productId),
    linkToCustomer,
    share,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
}
