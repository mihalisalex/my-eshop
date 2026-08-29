"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/components/providers/CartProvider";

/**
 * ONE box for both a discount code and a gift card.
 *
 * It used to be two, stacked, each with its own label and Apply button — which asks the
 * shopper a question they cannot answer. Someone holding "WELCOME10" knows they have a code;
 * whether the shop stores it as a discount rule or as stored value is an implementation
 * detail of this application, and putting it in front of them means half of them try the
 * wrong box first and are told their perfectly good code is invalid.
 *
 * `applyCode` works out which it is, and raises exactly one toast either way. Applied codes
 * are then listed together below, because from here on the distinction is real — a discount
 * shows a percentage or a fixed reduction, a gift card shows how much of its balance this
 * order consumed — and that is worth seeing.
 */
export function CartPromoForm() {
  const t = useTranslations("Cart");
  const { cart, applyCode, removeDiscountCode, removeGiftCard, isMutating } = useCart();
  const [code, setCode] = useState("");

  if (!cart) return null;

  const applied = [
    ...cart.discounts.map((discount) => ({
      key: `discount:${discount.code}`,
      code: discount.code,
      detail:
        discount.type === "percentage"
          ? t("percentOff", { value: discount.value })
          : `-${formatMoney(discount.amount)}`,
      remove: () => removeDiscountCode(discount.code),
    })),
    ...cart.giftCards.map((giftCard) => ({
      key: `gift:${giftCard.code}`,
      code: giftCard.code,
      detail: `-${formatMoney(giftCard.amountApplied)}`,
      remove: () => removeGiftCard(giftCard.code),
    })),
  ];

  return (
    <div>
      <label htmlFor="cart-code" className="mb-1.5 block text-xs font-medium tracking-[0.05em] text-luxe-gray-dark uppercase">
        {t("codeOrGiftCard")}
      </label>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!code.trim()) return;
          await applyCode(code);
          setCode("");
        }}
        className="flex gap-2"
      >
        <input
          id="cart-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={t("codePlaceholder")}
          className="h-10 w-full border border-border px-3 text-sm outline-none focus:border-luxe-black"
        />
        <button
          type="submit"
          disabled={isMutating || !code.trim()}
          className="h-10 shrink-0 border border-luxe-black px-4 text-xs font-medium tracking-[0.05em] uppercase disabled:opacity-40"
        >
          {t("apply")}
        </button>
      </form>

      {applied.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {applied.map((entry) => (
            <li key={entry.key} className="flex items-center justify-between text-xs">
              <span>
                {entry.code} — {entry.detail}
              </span>
              <button
                type="button"
                onClick={entry.remove}
                disabled={isMutating}
                aria-label={t("removeCode", { code: entry.code })}
                className="text-luxe-gray-dark hover:text-luxe-black disabled:opacity-40"
              >
                <X className="size-3.5" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
