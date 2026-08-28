"use client";
import { useTranslations } from "next-intl";

import { useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import { addressSchema, type AddressFormValues } from "@/lib/validation/checkout";
import { COUNTRIES } from "@/constants/countries";
import { useCheckout, type CheckoutPaymentMethod } from "@/components/providers/CheckoutProvider";
import { PaymentMethodIcon } from "@/components/checkout/PaymentMethodIcon";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

/**
 * The one client-side capability gate, read through `useSyncExternalStore` — which
 * is precisely what it is: a value that lives in an external system (the browser),
 * differs between the server and client snapshots, and would be a hydration
 * mismatch if read during render.
 *
 * It can only ever REMOVE a method the server already approved. Nothing here can
 * make an unavailable method available.
 */
function readApplePaySupport(): boolean {
  const session = (window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
  try {
    return Boolean(session?.canMakePayments?.());
  } catch {
    // Safari throws from canMakePayments() on an insecure origin rather than
    // returning false — which is a "no", not an error worth surfacing.
    return false;
  }
}

/** Apple Pay availability cannot change within a page's lifetime, so there is nothing to subscribe to. */
function subscribeToNothing(): () => void {
  return () => {};
}

/**
 * The payment step, rebuilt around the abstraction.
 *
 * What this component previously was: a hardcoded card form (name / number /
 * expiry / CVC) with a "Demo checkout — no payment is charged" note and a
 * feature-flagged "Pay in 4" button that did nothing. What it is now: a renderer
 * for whatever `GET /api/payment-methods` returns.
 *
 * Two properties are worth stating explicitly, because they're the point of §21:
 *
 * - There is **no card form here and there never will be**. Card data is collected
 *   on the processor's own page (Stripe's hosted checkout today), so this
 *   application never sees a card number or a CVV and stays out of PCI scope.
 * - There is **no `if (stripe)` / `if (cod)` anywhere**. The component cannot tell
 *   which vendor is behind a method — it renders a name, a description, an icon key
 *   and a server-computed fee. Adding Viva Wallet or PayPal later changes nothing
 *   in this file.
 */
export function PaymentStep() {
  const t = useTranslations("Checkout");
  const {
    shippingAddress,
    sameBillingAsShipping,
    setSameBillingAsShipping,
    setBillingAddress,
    confirmPayment,
    paymentMethods,
    isLoadingPaymentMethods,
    paymentMethodsError,
    reloadPaymentMethods,
    selectedPaymentMethodId,
    selectPaymentMethod,
  } = useCheckout();

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supportsApplePay = useSyncExternalStore(subscribeToNothing, readApplePaySupport, () => false);

  const visibleMethods = paymentMethods.filter(
    (method) => method.clientCapability !== "apple-pay" || supportsApplePay
  );

  const billingForm = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      firstName: shippingAddress?.firstName ?? "",
      lastName: shippingAddress?.lastName ?? "",
      company: "",
      address1: "",
      address2: "",
      city: "",
      region: "",
      postalCode: "",
      countryCode: shippingAddress?.countryCode ?? "GR",
      phone: "",
    },
  });

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!selectedPaymentMethodId) {
      setError("Please choose a payment method.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (!sameBillingAsShipping) {
        const isBillingValid = await billingForm.trigger();
        if (!isBillingValid) return;
        await setBillingAddress(billingForm.getValues());
      }
      confirmPayment();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div>
        <h2 className="font-heading text-xl">{t("paymentTitle")}</h2>
        <p className="mt-1 text-sm text-luxe-gray-dark">
          Choose how you&apos;d like to pay. You&apos;ll confirm everything on the next step.
        </p>
      </div>

      {isLoadingPaymentMethods && paymentMethods.length === 0 ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] animate-pulse border border-border bg-luxe-gray-light/60" />
          ))}
        </div>
      ) : null}

      {paymentMethodsError ? (
        <div className="border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p>{paymentMethodsError}</p>
          <button
            type="button"
            onClick={() => void reloadPaymentMethods()}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-4"
          >
            <RefreshCw className="size-3.5" strokeWidth={1.5} />
            {t("tryAgain")}
          </button>
        </div>
      ) : null}

      {!isLoadingPaymentMethods && !paymentMethodsError && visibleMethods.length === 0 ? (
        <div className="border border-border bg-luxe-gray-light p-4 text-sm">
          <p className="font-medium">{t("noPaymentMethods")}</p>
          <p className="mt-1 text-luxe-gray-dark">
            This can happen if your order total or delivery country falls outside what the available methods accept.
            Please contact us and we&apos;ll help you complete your order.
          </p>
        </div>
      ) : null}

      {visibleMethods.length > 0 ? (
        <div role="radiogroup" aria-label={t("paymentMethodLabel")} className="space-y-3">
          {visibleMethods.map((method) => (
            <PaymentMethodOption
              key={method.id}
              method={method}
              isSelected={selectedPaymentMethodId === method.id}
              onSelect={() => {
                setError(null);
                void selectPaymentMethod(method.id);
              }}
            />
          ))}
        </div>
      ) : null}

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={sameBillingAsShipping}
          onChange={(event) => setSameBillingAsShipping(event.target.checked)}
          className="size-4 border-border accent-luxe-black"
        />
        {t("billingSameAsShipping")}
      </label>

      {!sameBillingAsShipping ? (
        <div className="space-y-4 border-t border-border pt-6">
          <p className="text-eyebrow">{t("billingAddress")}</p>
          <div className="grid grid-cols-2 gap-4">
            <Field form={billingForm} name="firstName" id="billingFirstName" label={t("firstName")} />
            <Field form={billingForm} name="lastName" id="billingLastName" label={t("lastName")} />
          </div>
          <Field form={billingForm} name="address1" id="billingAddress1" label={t("streetAddress")} />
          <div className="grid grid-cols-2 gap-4">
            <Field form={billingForm} name="city" id="billingCity" label={t("city")} />
            <Field form={billingForm} name="postalCode" id="billingPostalCode" label={t("postalCode")} />
          </div>
          <div>
            <label htmlFor="billingCountryCode" className="mb-1.5 block text-eyebrow">
              Country
            </label>
            <select id="billingCountryCode" className={cn(inputClass, "appearance-none")} {...billingForm.register("countryCode")}>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <p className="flex items-center gap-1.5 text-xs text-luxe-gray-dark">
        <ShieldCheck className="size-3.5 shrink-0" strokeWidth={1.5} />
        Card details are entered on your payment provider&apos;s secure page — they never reach this site.
      </p>

      <button
        type="submit"
        disabled={isSubmitting || !selectedPaymentMethodId}
        className="flex h-12 w-full items-center justify-center gap-2 bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {t("reviewOrder")}
        <ArrowRight className="size-4" strokeWidth={1.5} />
      </button>
    </form>
  );
}

function PaymentMethodOption({
  method,
  isSelected,
  onSelect,
}: {
  method: CheckoutPaymentMethod;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 border px-4 py-3.5 text-left transition-colors",
        isSelected ? "border-luxe-black" : "border-border hover:border-luxe-black/50"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          isSelected ? "border-luxe-black" : "border-border"
        )}
      >
        {isSelected ? <span className="size-2 rounded-full bg-luxe-black" /> : null}
      </span>
      <PaymentMethodIcon icon={method.icon} className="mt-0.5 text-luxe-gray-dark" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="text-sm font-medium">{method.displayName}</span>
          {method.fee.amount > 0 ? (
            <span className="text-sm whitespace-nowrap">+{formatMoney(method.fee)}</span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-luxe-gray-dark">{method.description}</span>
        {method.requiresRedirect ? (
          <span className="mt-1 block text-[11px] text-luxe-gray-dark">
            You&apos;ll be taken to a secure page to complete your payment.
          </span>
        ) : null}
        {method.requiresManualConfirmation && !method.requiresRedirect ? (
          <span className="mt-1 block text-[11px] text-luxe-gray-dark">
            We&apos;ll confirm your payment before dispatching your order.
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** Small local field wrapper — keeps the aria-describedby wiring identical across every input. */
function Field({
  form,
  name,
  id,
  label,
}: {
  form: ReturnType<typeof useForm<AddressFormValues>>;
  name: keyof AddressFormValues;
  id: string;
  label: string;
}) {
  const error = form.formState.errors[name];
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-eyebrow">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
        {...form.register(name)}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
