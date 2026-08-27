"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCheckout } from "@/components/providers/CheckoutProvider";
import { GIFT_WRAP_FEE, GIFT_MESSAGE_MAX_LENGTH } from "@/lib/gift-wrap";

export function ShippingMethodStep() {
  const t = useTranslations("Checkout");
  const { shippingRates, selectedRateId, selectShippingRate, giftWrap, giftMessage, setGiftWrap } = useCheckout();
  const [selected, setSelected] = useState<string | null>(selectedRateId ?? shippingRates[0]?.id ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wrapChecked, setWrapChecked] = useState(giftWrap);
  const [message, setMessage] = useState(giftMessage);

  const onSubmit = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      if (wrapChecked !== giftWrap || (wrapChecked && message !== giftMessage)) {
        await setGiftWrap(wrapChecked, wrapChecked ? message : undefined);
      }
      await selectShippingRate(selected);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (shippingRates.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-heading text-xl">{t("deliveryTitle")}</h2>
          <p className="mt-1 text-sm text-luxe-gray-dark">{t("enterAddressForRates")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl">{t("deliveryTitle")}</h2>
        <p className="mt-1 text-sm text-luxe-gray-dark">{t("deliverySubtitle")}</p>
      </div>

      <div role="radiogroup" aria-label={t("shippingMethodLabel")} className="divide-y divide-border border-y border-border">
        {shippingRates.map((rate) => {
          const isSelected = selected === rate.id;
          return (
            <button
              key={rate.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(rate.id)}
              className="flex w-full items-center justify-between gap-4 px-1 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    isSelected ? "border-luxe-black" : "border-border"
                  )}
                >
                  {isSelected ? <span className="size-2 rounded-full bg-luxe-black" /> : null}
                </span>
                <span>
                  <span className="block text-sm font-medium">{rate.label}</span>
                  <span className="block text-xs text-luxe-gray-dark">{rate.description}</span>
                </span>
              </div>
              <span className="shrink-0 text-sm">{formatMoney(rate.price)}</span>
            </button>
          );
        })}
      </div>

      <div className="border border-border p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={wrapChecked}
            onChange={(e) => setWrapChecked(e.target.checked)}
            className="mt-0.5 size-4 accent-luxe-black"
          />
          <span>
            {t("addGiftWrapping")} <span className="text-luxe-gray-dark">(+{formatMoney({ amount: GIFT_WRAP_FEE, currencyCode: shippingRates[0]?.price.currencyCode ?? "EUR" })})</span>
          </span>
        </label>
        {wrapChecked ? (
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, GIFT_MESSAGE_MAX_LENGTH))}
            placeholder={t("giftMessagePlaceholder")}
            rows={2}
            maxLength={GIFT_MESSAGE_MAX_LENGTH}
            className="mt-3 w-full border border-border px-3 py-2 text-sm outline-none focus:border-luxe-black"
          />
        ) : null}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!selected || isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-2 bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {t("continueToPayment")}
        <ArrowRight className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
