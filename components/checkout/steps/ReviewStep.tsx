"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import { computeShippingChargeForRate } from "@/lib/shipping";
import { useCart } from "@/components/providers/CartProvider";
import { useCheckout } from "@/components/providers/CheckoutProvider";

function formatAddress(address: { firstName: string; lastName: string; company?: string; address1: string; address2?: string; city: string; region?: string; postalCode: string; countryCode: string; phone?: string } | null) {
  if (!address) return null;
  return (
    <address className="text-sm not-italic text-luxe-gray-dark">
      {address.firstName} {address.lastName}
      {address.company ? <>, {address.company}</> : null}
      <br />
      {address.address1}
      {address.address2 ? <>, {address.address2}</> : null}
      <br />
      {address.city}
      {address.region ? `, ${address.region}` : ""} {address.postalCode}
      <br />
      {address.countryCode}
      {address.phone ? <>, {address.phone}</> : null}
    </address>
  );
}

export function ReviewStep() {
  const t = useTranslations("Checkout");
  const {
    email,
    shippingAddress,
    billingAddress,
    sameBillingAsShipping,
    shippingRates,
    selectedRateId,
    giftWrap,
    giftMessage,
    paymentMethods,
    selectedPaymentMethodId,
    placeOrder,
    isPlacingOrder,
  } = useCheckout();
  const selectedPaymentMethod = paymentMethods.find((method) => method.id === selectedPaymentMethodId) ?? null;
  const { cart } = useCart();
  const router = useRouter();

  const selectedRate = shippingRates.find((rate) => rate.id === selectedRateId) ?? null;
  // The rate's listed price can differ from what's actually charged (Standard is free
  // over the shipping threshold) — show the real charge here, not the sticker price,
  // so this recap never contradicts the total in the order summary beside it.
  const taxableAmount = cart ? cart.totals.subtotal.amount - cart.totals.discountTotal.amount : 0;
  const shippingCharge = selectedRate ? computeShippingChargeForRate(selectedRate, taxableAmount, (cart?.totals.subtotal.amount ?? 0) > 0) : null;

  const onPlaceOrder = async () => {
    const result = await placeOrder();
    if (!result) return;

    // The one branch the storefront takes on payment behaviour, and it is
    // deliberately about the ACTION, not the vendor: "this method wants the
    // customer somewhere else" versus "it doesn't". Stripe, Piraeus, IRIS and a
    // provider that doesn't exist yet all travel this same path.
    if (result.customerAction?.type === "redirect" && result.customerAction.redirectUrl) {
      window.location.href = result.customerAction.redirectUrl;
      return;
    }
    router.push(`/checkout/confirmation?order=${encodeURIComponent(result.order.id)}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl">{t("reviewTitle")}</h2>
        <p className="mt-1 text-sm text-luxe-gray-dark">{t("reviewSubtitle")}</p>
      </div>

      <div className="divide-y divide-border border-y border-border">
        <div className="py-4">
          <p className="text-eyebrow mb-1.5">{t("contact")}</p>
          <p className="text-sm text-luxe-gray-dark">{email}</p>
        </div>
        <div className="py-4">
          <p className="text-eyebrow mb-1.5">{t("shippingAddress")}</p>
          {formatAddress(shippingAddress)}
        </div>
        <div className="py-4">
          <p className="text-eyebrow mb-1.5">{t("billingAddress")}</p>
          {sameBillingAsShipping ? (
            <p className="text-sm text-luxe-gray-dark">{t("sameAsShipping")}</p>
          ) : (
            formatAddress(billingAddress)
          )}
        </div>
        <div className="py-4">
          <p className="text-eyebrow mb-1.5">{t("deliveryMethod")}</p>
          {selectedRate ? (
            <p className="text-sm text-luxe-gray-dark">
              {selectedRate.label} · {shippingCharge === 0 ? "Free" : formatMoney({ amount: shippingCharge ?? selectedRate.price.amount, currencyCode: selectedRate.price.currencyCode })} ·{" "}
              {selectedRate.estimatedDelivery}
            </p>
          ) : null}
        </div>
        {selectedPaymentMethod ? (
          <div className="py-4">
            <p className="text-eyebrow mb-1.5">{t("paymentMethod")}</p>
            <p className="text-sm text-luxe-gray-dark">
              {selectedPaymentMethod.displayName}
              {selectedPaymentMethod.fee.amount > 0 ? ` · +${formatMoney(selectedPaymentMethod.fee)}` : ""}
            </p>
          </div>
        ) : null}
        {giftWrap ? (
          <div className="py-4">
            <p className="text-eyebrow mb-1.5">{t("giftWrapping")}</p>
            <p className="text-sm text-luxe-gray-dark">{giftMessage ? `"${giftMessage}"` : t("noMessageAdded")}</p>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onPlaceOrder}
        disabled={isPlacingOrder}
        className="flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPlacingOrder ? t("placingOrder") : t("placeOrder")}
      </button>
      <p className="text-center text-[11px] text-luxe-gray-dark">{t("demoDisclaimer")}</p>
    </div>
  );
}
