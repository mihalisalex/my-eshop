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
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Postgres needs an id to look up a cart — the mock's "whole cart object lives in
    // localStorage" shortcut is gone, so only the id itself is persisted client-side now.
    const storedCartId = readStorage<string | null>(CART_ID_KEY, null);
    commerce.cart.getOrCreateCart(storedCartId).then((initial) => {
      if (!cancelled) {
        writeStorage(CART_ID_KEY, initial.id);
        setCart(initial);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [commerce]);

  const reportError = useCallback(
    (error: unknown, fallback: string) => {
      const message = error instanceof CommerceError ? error.message : fallback;
      toast({ title: "Something went wrong", description: message, tone: "error" });
    },
    [toast]
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
        toast({ title: "Added to bag", tone: "success" });
        setIsDrawerOpen(true);
      } catch (error) {
        reportError(error, "Couldn't add that item to your bag.");
      }
    },
    [cart, commerce, withMutation, reportError, toast]
  );

  const updateQuantity = useCallback(
    async (lineItemId: string, quantity: number) => {
      try {
        await withMutation((cartId) => commerce.cart.updateLineItemQuantity(cartId, lineItemId, quantity));
      } catch (error) {
        reportError(error, "Couldn't update that quantity.");
      }
    },
    [commerce, withMutation, reportError]
  );

  const removeItem = useCallback(
    async (lineItemId: string) => {
      if (!cart) return;
      const removed = cart.lineItems.find((item) => item.id === lineItemId);
      if (!removed) return;

      // Optimistic: pull it out of view immediately, before the (instant, but
      // interface-generic) service call resolves.
      setCart((prev) => (prev ? { ...prev, lineItems: prev.lineItems.filter((i) => i.id !== lineItemId) } : prev));

      try {
        const updated = await commerce.cart.removeLineItem(cart.id, lineItemId);
        setCart(updated);
        commerce.analytics.track({ name: "remove_from_cart", properties: { productId: removed.productId } });
        toast({
          title: "Removed from bag",
          description: removed.name,
          action: {
            label: "Undo",
            onClick: () => {
              commerce.cart
                .addLineItem(updated.id, { productId: removed.productId, color: removed.color, size: removed.size, quantity: removed.quantity })
                .then(setCart);
            },
          },
        });
      } catch (error) {
        reportError(error, "Couldn't remove that item.");
      }
    },
    [cart, commerce, toast, reportError]
  );

  const saveForLater = useCallback(
    async (lineItemId: string) => {
      try {
        await withMutation((cartId) => commerce.cart.saveForLater(cartId, lineItemId));
        toast({ title: "Saved for later" });
      } catch (error) {
        reportError(error, "Couldn't save that item for later.");
      }
    },
    [commerce, withMutation, reportError, toast]
  );

  const moveToCart = useCallback(
    async (lineItemId: string) => {
      try {
        await withMutation((cartId) => commerce.cart.moveToCart(cartId, lineItemId));
        toast({ title: "Moved to bag" });
      } catch (error) {
        reportError(error, "Couldn't move that item to your bag.");
      }
    },
    [commerce, withMutation, reportError, toast]
  );

  const applyDiscountCode = useCallback(
    async (code: string) => {
      try {
        await withMutation((cartId) => commerce.cart.applyDiscountCode(cartId, code));
        toast({ title: "Promo code applied", tone: "success" });
      } catch (error) {
        reportError(error, "That code isn't valid.");
      }
    },
    [commerce, withMutation, reportError, toast]
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
        toast({ title: "Gift card applied", tone: "success" });
      } catch (error) {
        reportError(error, "That gift card code isn't valid.");
      }
    },
    [commerce, withMutation, reportError, toast]
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
