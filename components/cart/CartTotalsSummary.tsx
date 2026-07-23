import { formatMoney } from "@/lib/format";
import type { CartTotals } from "@/lib/commerce/types";

interface CartTotalsSummaryProps {
  totals: CartTotals;
}

export function CartTotalsSummary({ totals }: CartTotalsSummaryProps) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-luxe-gray-dark">Subtotal</span>
        <span>{formatMoney(totals.subtotal)}</span>
      </div>
      {totals.discountTotal.amount > 0 ? (
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">Discount</span>
          <span>-{formatMoney(totals.discountTotal)}</span>
        </div>
      ) : null}
      {totals.giftCardTotal.amount > 0 ? (
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">Gift Card</span>
          <span>-{formatMoney(totals.giftCardTotal)}</span>
        </div>
      ) : null}
      <div className="flex justify-between">
        <span className="text-luxe-gray-dark">Shipping</span>
        <span>{totals.shippingTotal.amount === 0 ? "Free" : formatMoney(totals.shippingTotal)}</span>
      </div>
      {totals.giftWrapTotal.amount > 0 ? (
        <div className="flex justify-between">
          <span className="text-luxe-gray-dark">Gift Wrapping</span>
          <span>{formatMoney(totals.giftWrapTotal)}</span>
        </div>
      ) : null}
      <div className="flex justify-between">
        <span className="text-luxe-gray-dark">Estimated Tax (VAT)</span>
        <span>{formatMoney(totals.taxTotal)}</span>
      </div>
      <div className="flex justify-between border-t border-border pt-2 text-base font-medium">
        <span>Total</span>
        <span>{formatMoney(totals.total)}</span>
      </div>
    </div>
  );
}
