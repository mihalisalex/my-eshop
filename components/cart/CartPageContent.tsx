"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { CartLineItemRow } from "@/components/cart/CartLineItemRow";
import { CartPromoForm } from "@/components/cart/CartPromoForm";
import { CartTotalsSummary } from "@/components/cart/CartTotalsSummary";
import { CartRecommendations } from "@/components/cart/CartRecommendations";
import { useCart } from "@/components/providers/CartProvider";

export function CartPageContent() {
  const { cart, isLoading, itemCount } = useCart();
  const [showSaved, setShowSaved] = useState(true);

  const activeItems = cart?.lineItems.filter((i) => !i.savedForLater) ?? [];
  const savedItems = cart?.savedItems ?? [];

  if (isLoading) {
    return <div className="container-luxe py-24 text-center text-sm text-luxe-gray-dark">Loading your bag...</div>;
  }

  if (activeItems.length === 0 && savedItems.length === 0) {
    return (
      <div className="container-luxe flex flex-col items-center gap-4 py-32 text-center">
        <ShoppingBag className="size-12 text-luxe-gray-dark" strokeWidth={1} />
        <h1 className="font-heading text-2xl">Your bag is empty</h1>
        <p className="text-sm text-luxe-gray-dark">Looks like you haven&apos;t added anything yet.</p>
        <Link
          href="/"
          className="mt-2 flex h-12 items-center justify-center bg-luxe-black px-8 text-xs font-medium tracking-[0.08em] text-luxe-white uppercase"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container-luxe py-12 md:py-16">
      <h1 className="font-heading text-3xl">Your Bag ({itemCount})</h1>

      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {activeItems.length > 0 ? (
            <div className="divide-y divide-border border-y border-border">
              {activeItems.map((item) => (
                <CartLineItemRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="border-y border-border py-8 text-center text-sm text-luxe-gray-dark">
              No items in your bag — check your saved items below.
            </p>
          )}

          {savedItems.length > 0 ? (
            <div className="mt-10">
              <button
                type="button"
                onClick={() => setShowSaved((prev) => !prev)}
                className="text-sm font-medium tracking-[0.05em] uppercase"
              >
                Saved for Later ({savedItems.length})
              </button>
              {showSaved ? (
                <div className="mt-2 divide-y divide-border border-y border-border">
                  {savedItems.map((item) => (
                    <CartLineItemRow key={item.id} item={item} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <CartRecommendations />
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6 border border-border p-6">
            {cart ? <CartTotalsSummary totals={cart.totals} /> : null}
            <CartPromoForm />
            <div>
              <Link
                href="/checkout"
                className="flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90"
              >
                Continue to Checkout
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
