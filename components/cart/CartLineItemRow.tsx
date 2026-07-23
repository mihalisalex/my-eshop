"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/components/providers/CartProvider";
import type { CartLineItem } from "@/lib/commerce/types";

interface CartLineItemRowProps {
  item: CartLineItem;
  compact?: boolean;
}

export function CartLineItemRow({ item, compact = false }: CartLineItemRowProps) {
  const { updateQuantity, removeItem, saveForLater, moveToCart, isMutating } = useCart();

  return (
    <div className="flex gap-4 py-4">
      <Link href={`/products/${item.slug}`} className="relative size-20 shrink-0 overflow-hidden bg-luxe-gray-light sm:size-24">
        <Image src={item.image.src} alt={item.image.alt} fill sizes="96px" className="object-cover" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/products/${item.slug}`} className="block truncate text-sm font-medium">
              {item.name}
            </Link>
            <p className="mt-0.5 text-xs text-luxe-gray-dark">
              {item.color} · {item.size}
            </p>
          </div>
          <button type="button" aria-label="Remove" onClick={() => removeItem(item.id)} className="shrink-0 text-luxe-gray-dark hover:text-luxe-black">
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="mt-auto flex items-end justify-between pt-2">
          {item.savedForLater ? (
            <button
              type="button"
              disabled={isMutating}
              onClick={() => moveToCart(item.id)}
              className="text-xs font-medium tracking-[0.05em] uppercase underline underline-offset-4"
            >
              Move to Bag
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-border">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={isMutating || item.quantity <= 1}
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="flex size-7 items-center justify-center disabled:opacity-40"
                >
                  <Minus className="size-3" strokeWidth={1.5} />
                </button>
                <span className="w-6 text-center text-xs">{item.quantity}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={isMutating || item.quantity >= item.maxQuantity}
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="flex size-7 items-center justify-center disabled:opacity-40"
                >
                  <Plus className="size-3" strokeWidth={1.5} />
                </button>
              </div>
              {!compact ? (
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => saveForLater(item.id)}
                  className="text-xs text-luxe-gray-dark underline underline-offset-4 hover:text-luxe-black"
                >
                  Save for later
                </button>
              ) : null}
            </div>
          )}
          <p className="text-sm font-medium">{formatMoney({ amount: item.unitPrice.amount * item.quantity, currencyCode: item.unitPrice.currencyCode })}</p>
        </div>
      </div>
    </div>
  );
}
