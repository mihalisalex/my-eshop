"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/components/providers/CartProvider";

export function CartPromoForm() {
  const { cart, applyDiscountCode, removeDiscountCode, applyGiftCard, removeGiftCard, isMutating } = useCart();
  const [promoInput, setPromoInput] = useState("");
  const [giftCardInput, setGiftCardInput] = useState("");

  if (!cart) return null;

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium tracking-[0.05em] text-luxe-gray-dark uppercase">
          Promo Code
        </label>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!promoInput.trim()) return;
            await applyDiscountCode(promoInput);
            setPromoInput("");
          }}
          className="flex gap-2"
        >
          <input
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value)}
            placeholder="e.g. WELCOME10"
            className="h-10 w-full border border-border px-3 text-sm outline-none focus:border-luxe-black"
          />
          <button
            type="submit"
            disabled={isMutating || !promoInput.trim()}
            className="h-10 shrink-0 border border-luxe-black px-4 text-xs font-medium tracking-[0.05em] uppercase disabled:opacity-40"
          >
            Apply
          </button>
        </form>
        {cart.discounts.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {cart.discounts.map((d) => (
              <li key={d.code} className="flex items-center justify-between text-xs">
                <span>
                  {d.code} — {d.type === "percentage" ? `${d.value}% off` : `-${formatMoney(d.amount)}`}
                </span>
                <button type="button" onClick={() => removeDiscountCode(d.code)} aria-label={`Remove ${d.code}`}>
                  <X className="size-3.5" strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium tracking-[0.05em] text-luxe-gray-dark uppercase">
          Gift Card
        </label>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!giftCardInput.trim()) return;
            await applyGiftCard(giftCardInput);
            setGiftCardInput("");
          }}
          className="flex gap-2"
        >
          <input
            value={giftCardInput}
            onChange={(e) => setGiftCardInput(e.target.value)}
            placeholder="e.g. GIFT25"
            className="h-10 w-full border border-border px-3 text-sm outline-none focus:border-luxe-black"
          />
          <button
            type="submit"
            disabled={isMutating || !giftCardInput.trim()}
            className="h-10 shrink-0 border border-luxe-black px-4 text-xs font-medium tracking-[0.05em] uppercase disabled:opacity-40"
          >
            Apply
          </button>
        </form>
        {cart.giftCards.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {cart.giftCards.map((g) => (
              <li key={g.code} className="flex items-center justify-between text-xs">
                <span>
                  {g.code} — -{formatMoney(g.amountApplied)}
                </span>
                <button type="button" onClick={() => removeGiftCard(g.code)} aria-label={`Remove ${g.code}`}>
                  <X className="size-3.5" strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
