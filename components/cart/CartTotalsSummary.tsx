import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import type { CartTotals } from "@/lib/commerce/types";

interface CartTotalsSummaryProps {
  totals: CartTotals;
}

export function CartTotalsSummary({ totals }: CartTotalsSummaryProps) {
  const t = useTranslations("Cart");
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-luxe-gray-dark">{t("subtotal")}</span>
        <span>{formatMoney(totals.subtotal)}</span>
      </div>
      {totals.discountTotal.amount > 0 ? (
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">{t("discount")}</span>
          <span>-{formatMoney(totals.discountTotal)}</span>
        </div>
      ) : null}
      {totals.giftCardTotal.amount > 0 ? (
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">{t("giftCard")}</span>
          <span>-{formatMoney(totals.giftCardTotal)}</span>
        </div>
      ) : null}
      <div className="flex justify-between">
        <span className="text-luxe-gray-dark">{t("shipping")}</span>
        <span>{totals.shippingTotal.amount === 0 ? t("free") : formatMoney(totals.shippingTotal)}</span>
      </div>
      {totals.giftWrapTotal.amount > 0 ? (
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">{t("giftWrapping")}</span>
          <span>{formatMoney(totals.giftWrapTotal)}</span>
        </div>
      ) : null}
      {totals.paymentFeeTotal.amount > 0 ? (
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">{t("paymentFee")}</span>
          <span>{formatMoney(totals.paymentFeeTotal)}</span>
        </div>
      ) : null}
      <div className="flex justify-between">
        <span className="text-luxe-gray-dark">{t("estimatedTax")}</span>
        <span>{formatMoney(totals.taxTotal)}</span>
      </div>
      <div className="flex justify-between border-t border-border pt-2 text-base font-medium">
        <span>{t("total")}</span>
        <span>{formatMoney(totals.total)}</span>
      </div>
    </div>
  );
}
