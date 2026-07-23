"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { Order } from "@/lib/commerce/types";

const STORAGE_KEY = "alexandris_last_order";

export default function CheckoutConfirmationPage() {
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      sessionStorage.removeItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from sessionStorage on mount
      setOrder(JSON.parse(raw) as Order);
    } else {
      setOrder(null);
    }
  }, []);

  if (order === undefined) {
    return <div className="container-luxe py-24 text-center text-sm text-luxe-gray-dark">Loading...</div>;
  }

  if (order === null) {
    return (
      <div className="container-luxe flex flex-col items-center gap-4 py-32 text-center">
        <h1 className="font-heading text-2xl">No recent order found</h1>
        <p className="text-sm text-luxe-gray-dark">This page is only available right after placing an order.</p>
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
    <div className="container-luxe max-w-2xl py-16 md:py-24">
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="size-12 text-luxe-black" strokeWidth={1} />
        <h1 className="mt-4 font-heading text-3xl">Thank you for your order</h1>
        <p className="mt-2 text-sm text-luxe-gray-dark">
          A confirmation has been sent to <span className="text-luxe-black">{order.customerEmail}</span>.
        </p>
        <p className="mt-1 text-sm text-luxe-gray-dark">Order number: {order.id}</p>
      </div>

      <div className="mt-10 divide-y divide-border border-y border-border">
        {order.lineItems.map((item) => (
          <div key={item.id} className="flex items-center gap-4 py-4">
            <div className="relative size-16 shrink-0 overflow-hidden bg-luxe-gray-light">
              <Image src={item.image.src} alt={item.image.alt} fill sizes="64px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{item.name}</p>
              <p className="text-xs text-luxe-gray-dark">
                {item.color} · {item.size} · Qty {item.quantity}
              </p>
            </div>
            <p className="shrink-0 text-sm">{formatMoney({ amount: item.unitPrice.amount * item.quantity, currencyCode: item.unitPrice.currencyCode })}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">Subtotal</span>
          <span>{formatMoney(order.totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">Shipping</span>
          <span>{formatMoney(order.totals.shippingTotal)}</span>
        </div>
        {order.totals.giftWrapTotal.amount > 0 ? (
          <div className="flex justify-between">
            <span className="text-luxe-gray-dark">Gift Wrapping</span>
            <span>{formatMoney(order.totals.giftWrapTotal)}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">Tax</span>
          <span>{formatMoney(order.totals.taxTotal)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5 text-base font-medium">
          <span>Total</span>
          <span>{formatMoney(order.totals.total)}</span>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <p className="text-eyebrow mb-1.5">Shipping to</p>
          <address className="text-sm not-italic text-luxe-gray-dark">
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            <br />
            {order.shippingAddress.address1}
            {order.shippingAddress.address2 ? <>, {order.shippingAddress.address2}</> : null}
            <br />
            {order.shippingAddress.city}
            {order.shippingAddress.region ? `, ${order.shippingAddress.region}` : ""} {order.shippingAddress.postalCode}
            <br />
            {order.shippingAddress.countryCode}
          </address>
        </div>
        <div>
          <p className="text-eyebrow mb-1.5">Delivery method</p>
          <p className="text-sm text-luxe-gray-dark">
            {order.shippingRate.label} · {order.shippingRate.estimatedDelivery}
          </p>
          {order.giftWrap ? (
            <p className="mt-3 text-sm text-luxe-gray-dark">
              Gift wrapped{order.giftMessage ? ` — "${order.giftMessage}"` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-12 border border-border p-6 text-center">
        <p className="text-eyebrow mb-1.5">What&apos;s next</p>
        <p className="text-sm text-luxe-gray-dark">
          We&apos;ll email you as soon as your order ships. You can track its status any time from your account.
        </p>
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          href="/"
          className="flex h-12 items-center justify-center bg-luxe-black px-8 text-xs font-medium tracking-[0.08em] text-luxe-white uppercase"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
