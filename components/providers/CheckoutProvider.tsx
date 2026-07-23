"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getCommerceProvider } from "@/lib/commerce";
import type { Address, Checkout, Order, ShippingRate } from "@/lib/commerce/types";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";

export type CheckoutStep = "contact" | "shipping" | "delivery" | "payment" | "review";
const STEP_ORDER: CheckoutStep[] = ["contact", "shipping", "delivery", "payment", "review"];

interface CheckoutContextValue {
  step: CheckoutStep;
  furthestStep: CheckoutStep;
  goToStep: (step: CheckoutStep) => void;
  checkout: Checkout | null;
  isReady: boolean;
  email: string;
  setEmail: (email: string) => Promise<void>;
  shippingAddress: Address | null;
  setShippingAddress: (address: Address) => Promise<void>;
  billingAddress: Address | null;
  sameBillingAsShipping: boolean;
  setSameBillingAsShipping: (value: boolean) => void;
  setBillingAddress: (address: Address) => Promise<void>;
  shippingRates: ShippingRate[];
  selectedRateId: string | null;
  selectShippingRate: (rateId: string) => Promise<void>;
  giftWrap: boolean;
  giftMessage: string;
  setGiftWrap: (giftWrap: boolean, giftMessage?: string) => Promise<void>;
  confirmPayment: () => void;
  placeOrder: () => Promise<Order | null>;
  isPlacingOrder: boolean;
  orderPlaced: boolean;
}

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const commerce = useMemo(() => getCommerceProvider(), []);
  const { cart, clearCart } = useCart();
  const { toast } = useToast();

  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [step, setStep] = useState<CheckoutStep>("contact");
  const [furthestStep, setFurthestStep] = useState<CheckoutStep>("contact");
  const [email, setEmailState] = useState("");
  const [shippingAddress, setShippingAddressState] = useState<Address | null>(null);
  const [billingAddress, setBillingAddressState] = useState<Address | null>(null);
  const [sameBillingAsShipping, setSameBillingAsShipping] = useState(true);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [giftWrap, setGiftWrapState] = useState(false);
  const [giftMessage, setGiftMessageState] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    if (!cart || checkout) return;
    commerce.checkout.createCheckout(cart.id).then(setCheckout);
  }, [cart, checkout, commerce]);

  const advanceTo = useCallback((next: CheckoutStep) => {
    setStep(next);
    setFurthestStep((prev) => (STEP_ORDER.indexOf(next) > STEP_ORDER.indexOf(prev) ? next : prev));
  }, []);

  const goToStep = useCallback(
    (target: CheckoutStep) => {
      if (STEP_ORDER.indexOf(target) <= STEP_ORDER.indexOf(furthestStep)) setStep(target);
    },
    [furthestStep]
  );

  const setEmail = useCallback(
    async (value: string) => {
      if (!checkout) return;
      const updated = await commerce.checkout.updateEmail(checkout.id, value);
      setCheckout(updated);
      setEmailState(value);
      advanceTo("shipping");
    },
    [checkout, commerce, advanceTo]
  );

  const setShippingAddress = useCallback(
    async (address: Address) => {
      if (!checkout || !cart) return;
      const updated = await commerce.checkout.updateShippingAddress(checkout.id, address);
      setCheckout(updated);
      setShippingAddressState(address);
      if (sameBillingAsShipping) setBillingAddressState(address);
      const rates = await commerce.cart.estimateShipping(cart.id, address);
      setShippingRates(rates);
      advanceTo("delivery");
    },
    [checkout, cart, commerce, sameBillingAsShipping, advanceTo]
  );

  const setBillingAddress = useCallback(
    async (address: Address) => {
      if (!checkout) return;
      const updated = await commerce.checkout.updateBillingAddress(checkout.id, address);
      setCheckout(updated);
      setBillingAddressState(address);
    },
    [checkout, commerce]
  );

  const selectShippingRate = useCallback(
    async (rateId: string) => {
      if (!checkout) return;
      const updated = await commerce.checkout.setShippingRate(checkout.id, rateId);
      setCheckout(updated);
      setSelectedRateId(rateId);
      advanceTo("payment");
    },
    [checkout, commerce, advanceTo]
  );

  const setGiftWrap = useCallback(
    async (value: boolean, message?: string) => {
      if (!checkout) return;
      const updated = await commerce.checkout.setGiftWrap(checkout.id, { giftWrap: value, giftMessage: message });
      setCheckout(updated);
      setGiftWrapState(value);
      setGiftMessageState(value ? (message ?? "") : "");
    },
    [checkout, commerce]
  );

  const confirmPayment = useCallback(() => {
    advanceTo("review");
  }, [advanceTo]);

  const placeOrder = useCallback(async (): Promise<Order | null> => {
    if (!checkout || !cart) return null;
    setIsPlacingOrder(true);
    try {
      const finalBilling = sameBillingAsShipping ? shippingAddress : billingAddress;
      if (finalBilling && finalBilling !== billingAddress) {
        await commerce.checkout.updateBillingAddress(checkout.id, finalBilling);
      }
      const order = await commerce.checkout.completeCheckout(checkout.id, cart);
      setOrderPlaced(true);
      await clearCart();
      commerce.analytics.track({ name: "purchase", properties: { orderId: order.id, total: order.totals.total.amount } });
      return order;
    } catch {
      toast({ title: "Couldn't place your order", description: "Please check your details and try again.", tone: "error" });
      return null;
    } finally {
      setIsPlacingOrder(false);
    }
  }, [checkout, cart, sameBillingAsShipping, shippingAddress, billingAddress, commerce, clearCart, toast]);

  const value: CheckoutContextValue = {
    step,
    furthestStep,
    goToStep,
    checkout,
    isReady: Boolean(cart && checkout),
    email,
    setEmail,
    shippingAddress,
    setShippingAddress,
    billingAddress,
    sameBillingAsShipping,
    setSameBillingAsShipping,
    setBillingAddress,
    shippingRates,
    selectedRateId,
    selectShippingRate,
    giftWrap,
    giftMessage,
    setGiftWrap,
    confirmPayment,
    placeOrder,
    isPlacingOrder,
    orderPlaced,
  };

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckout(): CheckoutContextValue {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error("useCheckout must be used within a CheckoutProvider");
  return ctx;
}
