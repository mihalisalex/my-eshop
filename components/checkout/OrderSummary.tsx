"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCart } from "@/components/providers/CartProvider";
import { useCheckout } from "@/components/providers/CheckoutProvider";
import { CartTotalsSummary } from "@/components/cart/CartTotalsSummary";
import { applyGiftWrap, applyPaymentFee, applySelectedShippingRate } from "@/lib/commerce/checkout-totals";

export function OrderSummary() {
  const { cart } = useCart();
  const { checkout, selectedPaymentFee } = useCheckout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItems = cart?.lineItems.filter((i) => !i.savedForLater) ?? [];

  if (!cart) return null;

  // cart.totals always reflects the generic standard/free shipping estimate —
  // once a shopper has picked a specific rate (Delivery step), reflect its real
  // price here too, so what's shown matches what's actually charged at the end.
  // The payment surcharge is the same story one step later: the SERVER computed
  // this number (GET /api/payment-methods) and the server recomputes it again at
  // order time — this only displays it, so the summary can't quietly disagree
  // with the amount actually charged.
  const totals = applyPaymentFee(
    applyGiftWrap(applySelectedShippingRate(cart.totals, checkout?.shippingRate), Boolean(checkout?.giftWrap)),
    selectedPaymentFee?.amount ?? 0
  );

  return (
    <div className="border border-border bg-luxe-gray-light/40 lg:sticky lg:top-24">
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-sm font-medium lg:hidden"
      >
        <span>
          {mobileOpen ? "Hide" : "Show"} order summary · {formatMoney(totals.total)}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", mobileOpen && "rotate-180")} strokeWidth={1.5} />
      </button>

      <div className={cn("px-5 pb-5", mobileOpen ? "block" : "hidden lg:block", "lg:pt-5")}>
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {activeItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden bg-luxe-white">
                <Image src={item.image.src} alt={item.image.alt} fill sizes="56px" className="object-cover" />
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-luxe-black text-[10px] text-luxe-white">
                  {item.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.name}</p>
                <p className="text-xs text-luxe-gray-dark">
                  {item.color} · {item.size}
                </p>
              </div>
              <p className="shrink-0 text-sm">
                {formatMoney({ amount: item.unitPrice.amount * item.quantity, currencyCode: item.unitPrice.currencyCode })}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <CartTotalsSummary totals={totals} />
        </div>
      </div>
    </div>
  );
}
