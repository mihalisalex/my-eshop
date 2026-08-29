"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getCommerceProvider } from "@/lib/commerce";
import { CommerceError, type AddLineItemInput, type Cart } from "@/lib/commerce/types";
import { readStorage, writeStorage } from "@/lib/client-storage";
import { useToast } from "@/components/providers/ToastProvider";
import { useTranslations } from "next-intl";

const CART_ID_KEY = "alexandris_cart_id";

interface CartContextValue {
  cart: Cart | null;
  isLoading: boolean;
  isMutating: boolean;
  itemCount: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (input: AddLineItemInput) => Promise<void>;
  updateQuantity: (lineItemId: string, quantity: number) => Promise<void>;
  removeItem: (lineItemId: string) => Promise<void>;
  saveForLater: (lineItemId: string) => Promise<void>;
  moveToCart: (lineItemId: string) => Promise<void>;
  /** One box for both kinds of code — see the implementation for why the UI cannot do this itself. */
  applyCode: (code: string) => Promise<void>;
  applyDiscountCode: (code: string) => Promise<void>;
  removeDiscountCode: (code: string) => Promise<void>;
  applyGiftCard: (code: string) => Promise<void>;
  removeGiftCard: (code: string) => Promise<void>;
  clearCart: () => Promise<void>;
  /** Associates this cart with the just-signed-in customer (adopt or merge server-side) — call once right after sign-in/sign-up. */
  linkToCustomer: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const commerce = useMemo(() => getCommerceProvider(), []);
  const { toast } = useToast();
  const t = useTranslations("Cart");
  const tError = useTranslations("CartError");
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // A `?cart=` link (e.g. an abandoned-cart recovery email) takes priority over
    // whatever's already in localStorage — the whole point is to resume THAT cart, on
    // whatever browser the link is opened in. Cart ids are unguessable cuids, same
    // security posture as the existing wishlist-share-token pattern.
    const linkedCartId = new URLSearchParams(window.location.search).get("cart");
    // Postgres needs an id to look up a cart — the mock's "whole cart object lives in
    // localStorage" shortcut is gone, so only the id itself is persisted client-side now.
    const storedCartId = readStorage<string | null>(CART_ID_KEY, null);
    commerce.cart
      .getOrCreateCart(linkedCartId ?? storedCartId)
      .then((initial) => {
        if (cancelled) return;
        writeStorage(CART_ID_KEY, initial.id);
        setCart(initial);
        if (linkedCartId) {
          const url = new URL(window.location.href);
          url.searchParams.delete("cart");
          window.history.replaceState({}, "", url);
        }
      })
      // Cart creation failing must not pin the header/drawer in a permanent loading
      // state — consumers already treat a null cart as "empty" via optional chaining.
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load cart", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [commerce]);

  /**
   * Translates by ERROR CODE, not by the server's message.
   *
   * This used to prefer `error.message`, which is written in English at the throw site deep
   * in services/carts.ts — so every cart failure a Greek shopper saw was in English, and the
   * translated strings here only ever appeared for errors that were not CommerceErrors at
   * all. The code is the stable contract between server and client; the message is a
   * developer-facing detail that happened to be rendered to customers.
   *
   * An unrecognised code falls back to the caller's string rather than to the raw message,
   * so a new code added server-side degrades to something translated and generic instead of
   * leaking English.
   */
  const reportError = useCallback(
    (error: unknown, fallback: string) => {
      const code = error instanceof CommerceError ? error.code : null;
      const description = code && tError.has(code) ? tError(code) : fallback;
      toast({ title: t("somethingWentWrong"), description, tone: "error" });
    },
    [toast, t, tError]
  );

  const withMutation = useCallback(
    async (run: (cartId: string) => Promise<Cart>) => {
      if (!cart) return;
      setIsMutating(true);
      try {
        const updated = await run(cart.id);
        setCart(updated);
      } finally {
        setIsMutating(false);
      }
    },
    [cart]
  );

  const addItem = useCallback(
    async (input: AddLineItemInput) => {
      if (!cart) return;
      try {
        await withMutation((cartId) => commerce.cart.addLineItem(cartId, input));
        commerce.analytics.track({ name: "add_to_cart", properties: { productId: input.productId, quantity: input.quantity } });
        toast({ title: t("added"), tone: "success" });
        setIsDrawerOpen(true);
      } catch (error) {
        reportError(error, t("couldNotAdd"));
      }
    },
    [cart, commerce, withMutation, reportError, toast, t]
  );

  const updateQuantity = useCallback(
    async (lineItemId: string, quantity: number) => {
      try {
        await withMutation((cartId) => commerce.cart.updateLineItemQuantity(cartId, lineItemId, quantity));
      } catch (error) {
        reportError(error, t("couldNotUpdateQuantity"));
      }
    },
    [commerce, withMutation, reportError, t]
  );

  const removeItem = useCallback(
    async (lineItemId: string) => {
      if (!cart) return;
      // BOTH lists. toCart splits a cart into active `lineItems` and `savedItems`, so looking
      // only in the first meant the × on a saved-for-later row found nothing and returned
      // before doing anything at all — no request, no toast, no error. The button looked
      // live and was inert.
      const removed =
        cart.lineItems.find((item) => item.id === lineItemId) ??
        cart.savedItems.find((item) => item.id === lineItemId);
      if (!removed) return;

      // Optimistic: pull it out of view immediately, before the (instant, but
      // interface-generic) service call resolves. Filters both lists for the same reason.
      setCart((prev) =>
        prev
          ? {
              ...prev,
              lineItems: prev.lineItems.filter((i) => i.id !== lineItemId),
              savedItems: prev.savedItems.filter((i) => i.id !== lineItemId),
            }
          : prev
      );

      try {
        const updated = await commerce.cart.removeLineItem(cart.id, lineItemId);
        setCart(updated);
        commerce.analytics.track({ name: "remove_from_cart", properties: { productId: removed.productId } });
        toast({
          title: t("removed"),
          description: removed.name,
          action: {
            label: t("undo"),
            onClick: () => {
              // Undo has to put it back where it was. addLineItem always creates an ACTIVE
              // row, so a saved item is re-saved afterwards — otherwise "undo" quietly moves
              // it into the bag, which is a different cart than the one it undid.
              commerce.cart
                .addLineItem(updated.id, { productId: removed.productId, color: removed.color, size: removed.size, quantity: removed.quantity })
                .then((next) => {
                  if (!removed.savedForLater) return setCart(next);
                  const restored = next.lineItems.find(
                    (i) => i.productId === removed.productId && i.color === removed.color && i.size === removed.size
                  );
                  if (!restored) return setCart(next);
                  return commerce.cart.saveForLater(next.id, restored.id).then(setCart);
                });
            },
          },
        });
      } catch (error) {
        reportError(error, t("couldNotRemove"));
      }
    },
    [cart, commerce, toast, reportError, t]
  );

  const saveForLater = useCallback(
    async (lineItemId: string) => {
      try {
        await withMutation((cartId) => commerce.cart.saveForLater(cartId, lineItemId));
        toast({ title: t("savedForLater") });
      } catch (error) {
        reportError(error, t("couldNotSaveForLater"));
      }
    },
    [commerce, withMutation, reportError, toast, t]
  );

  const moveToCart = useCallback(
    async (lineItemId: string) => {
      try {
        await withMutation((cartId) => commerce.cart.moveToCart(cartId, lineItemId));
        toast({ title: t("movedToBag") });
      } catch (error) {
        reportError(error, t("couldNotMoveToBag"));
      }
    },
    [commerce, withMutation, reportError, toast, t]
  );

  /**
   * A shopper has "a code". They do not know, and should not have to know, whether the shop
   * filed it as a discount rule or as stored value — so there is one box, and this works out
   * which it is.
   *
   * This cannot live in the form, because `applyDiscountCode` and `applyGiftCard` each raise
   * their own toast and swallow their own error. Calling them in sequence from the UI would
   * show a failure toast for the discount attempt before the gift-card attempt had even run.
   *
   * It only falls through on INVALID_DISCOUNT_CODE — "there is no such discount". Any other
   * failure means the code WAS a discount and something else was wrong with it (already
   * applied, expired), and reporting that beats retrying it as a gift card and then claiming
   * the code does not exist.
   */
  const applyCode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;

      try {
        await withMutation((cartId) => commerce.cart.applyDiscountCode(cartId, code));
        toast({ title: t("promoApplied"), tone: "success" });
        return;
      } catch (error) {
        const noSuchDiscount = error instanceof CommerceError && error.code === "INVALID_DISCOUNT_CODE";
        if (!noSuchDiscount) {
          reportError(error, t("invalidCode"));
          return;
        }
      }

      try {
        await withMutation((cartId) => commerce.cart.applyGiftCard(cartId, code));
        toast({ title: t("giftCardApplied"), tone: "success" });
      } catch (error) {
        // Neither kind matched. One message for both, which also avoids telling a stranger
        // which of the two code namespaces a guess landed in.
        reportError(error, t("invalidCode"));
      }
    },
    [commerce, withMutation, reportError, toast, t]
  );

  const applyDiscountCode = useCallback(
    async (code: string) => {
      try {
        await withMutation((cartId) => commerce.cart.applyDiscountCode(cartId, code));
        toast({ title: t("promoApplied"), tone: "success" });
      } catch (error) {
        reportError(error, t("invalidPromoCode"));
      }
    },
    [commerce, withMutation, reportError, toast, t]
  );

  const removeDiscountCode = useCallback(
    async (code: string) => {
      await withMutation((cartId) => commerce.cart.removeDiscountCode(cartId, code));
    },
    [commerce, withMutation]
  );

  const applyGiftCard = useCallback(
    async (code: string) => {
      try {
        await withMutation((cartId) => commerce.cart.applyGiftCard(cartId, code));
        toast({ title: t("giftCardApplied"), tone: "success" });
      } catch (error) {
        reportError(error, t("invalidGiftCard"));
      }
    },
    [commerce, withMutation, reportError, toast, t]
  );

  const removeGiftCard = useCallback(
    async (code: string) => {
      await withMutation((cartId) => commerce.cart.removeGiftCard(cartId, code));
    },
    [commerce, withMutation]
  );

  const clearCart = useCallback(async () => {
    await withMutation((cartId) => commerce.cart.clearCart(cartId));
  }, [commerce, withMutation]);

  const linkToCustomer = useCallback(async () => {
    if (!cart) return;
    const merged = await commerce.cart.linkCustomer(cart.id);
    writeStorage(CART_ID_KEY, merged.id);
    setCart(merged);
  }, [cart, commerce]);

  const itemCount = (cart?.lineItems ?? []).filter((i) => !i.savedForLater).reduce((sum, i) => sum + i.quantity, 0);

  const value: CartContextValue = {
    cart,
    isLoading,
    isMutating,
    itemCount,
    isDrawerOpen,
    openDrawer: () => setIsDrawerOpen(true),
    closeDrawer: () => setIsDrawerOpen(false),
    addItem,
    updateQuantity,
    removeItem,
    saveForLater,
    moveToCart,
    applyCode,
    applyDiscountCode,
    removeDiscountCode,
    applyGiftCard,
    removeGiftCard,
    clearCart,
    linkToCustomer,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
