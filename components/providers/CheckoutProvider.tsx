"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getCommerceProvider } from "@/lib/commerce";
import type { Address, Checkout, CompleteCheckoutResult, ShippingRate } from "@/lib/commerce/types";
import type { Money } from "@/types";
import { useCart } from "@/components/providers/CartProvider";
import { useToast } from "@/components/providers/ToastProvider";

/**
 * Mirrors `AvailablePaymentMethod` in services/payments.ts — the JSON the backend
 * sends. Deliberately structural rather than a shared import: this is a Client
 * Component, and the service module is `server-only`.
 *
 * Note what's absent. There is no provider-specific field, no credential, and no
 * capability flag the client could act on beyond `clientCapability`. The checkout
 * genuinely cannot tell whether a method is Stripe, Piraeus, IRIS or cash.
 */
export interface CheckoutPaymentMethod {
  id: string;
  providerId: string;
  displayName: string;
  description: string;
  type: string;
  icon: string;
  fee: Money;
  feeLabel: string | null;
  requiresRedirect: boolean;
  requiresManualConfirmation: boolean;
  clientCapability?: string;
  sortOrder: number;
}

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
  paymentMethods: CheckoutPaymentMethod[];
  isLoadingPaymentMethods: boolean;
  paymentMethodsError: string | null;
  reloadPaymentMethods: () => Promise<void>;
  selectedPaymentMethodId: string | null;
  selectPaymentMethod: (methodId: string) => Promise<void>;
  /** Server-computed surcharge for the selected method. Never derived here. */
  selectedPaymentFee: Money | null;
  confirmPayment: () => void;
  placeOrder: () => Promise<CompleteCheckoutResult | null>;
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
  const [paymentMethods, setPaymentMethods] = useState<CheckoutPaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  // `checkout` alone can't guard this: CartProvider hands back a brand-new cart object
  // on every mutation, so a quantity change while the first createCheckout is still in
  // flight re-runs this effect with `checkout` still null and creates a second, orphaned
  // checkout row for the same cart. The ref closes that window; the catch stops a failed
  // create from silently leaving the checkout flow inert with no way to retry.
  const checkoutRequestedForCartRef = useRef<string | null>(null);

  useEffect(() => {
    if (!cart || checkout) return;
    if (checkoutRequestedForCartRef.current === cart.id) return;
    checkoutRequestedForCartRef.current = cart.id;

    commerce.checkout
      .createCheckout(cart.id)
      .then(setCheckout)
      .catch((error) => {
        console.error("Failed to create checkout", error);
        // Let a later render retry rather than wedging the flow permanently.
        checkoutRequestedForCartRef.current = null;
      });
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

  /**
   * The whole of §20/§21 on the client: ask the backend what's available and render
   * it. This component contains no rule about which method is valid — it can't, and
   * shouldn't be able to.
   */
  const reloadPaymentMethods = useCallback(async () => {
    if (!checkout) return;
    setIsLoadingPaymentMethods(true);
    setPaymentMethodsError(null);
    try {
      const response = await fetch(`/api/payment-methods?checkoutId=${encodeURIComponent(checkout.id)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);
      const data = (await response.json()) as { methods: CheckoutPaymentMethod[]; selectedMethodId: string | null };
      setPaymentMethods(data.methods);
      setSelectedPaymentMethodId((current) => {
        // Keep an existing choice only while it's still on offer — a method an
        // admin disabled mid-checkout must not stay selected.
        if (current && data.methods.some((m) => m.id === current)) return current;
        return data.selectedMethodId && data.methods.some((m) => m.id === data.selectedMethodId)
          ? data.selectedMethodId
          : null;
      });
    } catch (error) {
      console.error("Failed to load payment methods", error);
      setPaymentMethodsError("We couldn't load the available payment methods. Please try again.");
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  }, [checkout]);

  // Re-fetched whenever anything the backend uses to decide availability changes —
  // the total (gift wrap), the destination, or the delivery method. A COD limit or
  // a country restriction therefore takes effect the moment it becomes relevant.
  useEffect(() => {
    if (!checkout) return;
    /*
     * Genuine async data fetching keyed on server-derived state. The availability
     * rules live entirely on the backend — that is the whole point of §20 — so this
     * cannot be derived during render, and the loading flag it sets synchronously is
     * what the payment step renders its skeleton from. The rule can't distinguish
     * this from a derived-state mistake, so it's suppressed here specifically.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadPaymentMethods();
  }, [checkout, selectedRateId, giftWrap, shippingAddress, reloadPaymentMethods]);

  const selectPaymentMethod = useCallback(
    async (methodId: string) => {
      if (!checkout) return;
      setSelectedPaymentMethodId(methodId);
      const updated = await commerce.checkout.setPaymentMethod(checkout.id, methodId);
      setCheckout(updated);
    },
    [checkout, commerce]
  );

  const selectedPaymentFee = useMemo(() => {
    const method = paymentMethods.find((m) => m.id === selectedPaymentMethodId);
    return method ? method.fee : null;
  }, [paymentMethods, selectedPaymentMethodId]);

  const confirmPayment = useCallback(() => {
    advanceTo("review");
  }, [advanceTo]);

  const placeOrder = useCallback(async (): Promise<CompleteCheckoutResult | null> => {
    if (!checkout || !cart) return null;
    setIsPlacingOrder(true);
    try {
      const finalBilling = sameBillingAsShipping ? shippingAddress : billingAddress;
      if (finalBilling && finalBilling !== billingAddress) {
        await commerce.checkout.updateBillingAddress(checkout.id, finalBilling);
      }
      const result = await commerce.checkout.completeCheckout(checkout.id, cart);
      setOrderPlaced(true);

      // A redirect-based payment hasn't been made yet, so the cart is cleared but
      // the analytics purchase event is not fired here — that would count an
      // abandoned redirect as revenue. It fires on the confirmation page once the
      // payment is verified as settled.
      await clearCart();
      if (!result.customerAction || result.customerAction.type !== "redirect") {
        commerce.analytics.track({
          name: "purchase",
          properties: { orderId: result.order.id, total: result.order.totals.total.amount },
        });
      }
      return result;
    } catch (error) {
      const description =
        error instanceof Error && error.message
          ? error.message
          : "Please check your details and try again.";
      toast({ title: "Couldn't place your order", description, tone: "error" });
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
    paymentMethods,
    isLoadingPaymentMethods,
    paymentMethodsError,
    reloadPaymentMethods,
    selectedPaymentMethodId,
    selectPaymentMethod,
    selectedPaymentFee,
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
