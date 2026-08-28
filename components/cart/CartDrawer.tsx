"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CartLineItemRow } from "@/components/cart/CartLineItemRow";
import { CartTotalsSummary } from "@/components/cart/CartTotalsSummary";
import { useCart } from "@/components/providers/CartProvider";

export function CartDrawer() {
  const t = useTranslations("Cart");
  const { cart, isDrawerOpen, closeDrawer, itemCount } = useCart();
  const [showSaved, setShowSaved] = useState(false);

  const activeItems = cart?.lineItems.filter((i) => !i.savedForLater) ?? [];
  const savedItems = cart?.savedItems ?? [];

  return (
    <Sheet open={isDrawerOpen} onOpenChange={(open) => (open ? undefined : closeDrawer())}>
      <SheetContent side="right" showCloseButton className="flex w-full flex-col border-none bg-luxe-white p-0 sm:max-w-md">
        <SheetTitle className="sr-only">{t("shoppingBag")}</SheetTitle>
        <div className="flex h-16 shrink-0 items-center border-b border-border px-6">
          <span className="font-heading text-lg tracking-[0.1em] uppercase">{t("yourBag")} ({itemCount})</span>
        </div>

        {activeItems.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag className="size-10 text-luxe-gray-dark" strokeWidth={1} />
            <p className="text-sm text-luxe-gray-dark">{t("emptyBagSentence")}</p>
            <button
              type="button"
              onClick={closeDrawer}
              className="h-10 border border-luxe-black px-6 text-xs font-medium tracking-[0.05em] uppercase"
            >
              {t("continueShopping")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6">
              <div className="divide-y divide-border">
                {activeItems.map((item) => (
                  <CartLineItemRow key={item.id} item={item} compact />
                ))}
              </div>

              {savedItems.length > 0 ? (
                <div className="border-t border-border py-4">
                  <button
                    type="button"
                    onClick={() => setShowSaved((prev) => !prev)}
                    className="text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark"
                  >
                    Saved for Later ({savedItems.length})
                  </button>
                  {showSaved ? (
                    <div className="mt-2 divide-y divide-border">
                      {savedItems.map((item) => (
                        <CartLineItemRow key={item.id} item={item} compact />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {cart ? (
              <div className="shrink-0 border-t border-border px-6 py-5">
                <CartTotalsSummary totals={cart.totals} />
                <Link
                  href="/cart"
                  onClick={closeDrawer}
                  className="mt-4 flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90"
                >
                  View Bag & Checkout
                </Link>
                <p className="mt-2 text-center text-[11px] text-luxe-gray-dark">
                  Shipping, taxes, and discounts calculated in your bag.
                </p>
              </div>
            ) : null}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
