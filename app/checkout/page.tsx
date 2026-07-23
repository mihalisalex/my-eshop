"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/providers/CartProvider";
import { useCheckout } from "@/components/providers/CheckoutProvider";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { ContactStep } from "@/components/checkout/steps/ContactStep";
import { ShippingAddressStep } from "@/components/checkout/steps/ShippingAddressStep";
import { ShippingMethodStep } from "@/components/checkout/steps/ShippingMethodStep";
import { PaymentStep } from "@/components/checkout/steps/PaymentStep";
import { ReviewStep } from "@/components/checkout/steps/ReviewStep";

const STEP_COMPONENTS = {
  contact: ContactStep,
  shipping: ShippingAddressStep,
  delivery: ShippingMethodStep,
  payment: PaymentStep,
  review: ReviewStep,
};

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, isLoading: isCartLoading } = useCart();
  const { step, isReady, orderPlaced } = useCheckout();

  useEffect(() => {
    if (isCartLoading || orderPlaced) return;
    if (!cart || cart.lineItems.filter((item) => !item.savedForLater).length === 0) {
      router.replace("/cart");
    }
  }, [isCartLoading, cart, orderPlaced, router]);

  if (isCartLoading || !isReady) {
    return <div className="container-luxe py-24 text-center text-sm text-luxe-gray-dark">Loading checkout...</div>;
  }

  const StepComponent = STEP_COMPONENTS[step];

  return (
    <div className="container-luxe py-10 md:py-14">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CheckoutSteps />
          <StepComponent />
        </div>
        <div className="lg:col-span-1">
          <OrderSummary />
        </div>
      </div>
    </div>
  );
}
