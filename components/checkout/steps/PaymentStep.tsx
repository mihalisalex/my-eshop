"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { cardSchema, addressSchema, type CardFormValues, type AddressFormValues } from "@/lib/validations/checkout";
import { COUNTRIES } from "@/constants/countries";
import { useCheckout } from "@/components/providers/CheckoutProvider";
import { ExpressCheckoutButtons } from "@/components/checkout/ExpressCheckoutButtons";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

type PaymentMethod = "full" | "klarna";

export function PaymentStep() {
  const { shippingAddress, sameBillingAsShipping, setSameBillingAsShipping, setBillingAddress, confirmPayment } = useCheckout();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("full");

  const cardForm = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: { cardName: "", cardNumber: "", expiry: "", cvc: "" },
  });

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
      countryCode: "US",
      phone: "",
    },
  });

  const onSubmit = cardForm.handleSubmit(async () => {
    if (!sameBillingAsShipping) {
      const isBillingValid = await billingForm.trigger();
      if (!isBillingValid) return;
      await setBillingAddress(billingForm.getValues());
    }
    confirmPayment();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div>
        <h2 className="font-heading text-xl">Payment</h2>
        <p className="mt-1 text-sm text-luxe-gray-dark">All transactions are secure and encrypted.</p>
      </div>

      {isFeatureEnabled("express-checkout") ? <ExpressCheckoutButtons /> : null}

      <div role="radiogroup" aria-label="Payment plan" className="grid grid-cols-2 gap-3">
        {(
          [
            { id: "full" as const, label: "Pay in full", hint: "Charged today" },
            ...(isFeatureEnabled("klarna-payment")
              ? [{ id: "klarna" as const, label: "Pay in 4", hint: "with Klarna, interest-free" }]
              : []),
          ]
        ).map((option) => {
          const isSelected = paymentMethod === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setPaymentMethod(option.id)}
              className={cn(
                "flex flex-col items-start gap-0.5 border px-4 py-3 text-left transition-colors",
                isSelected ? "border-luxe-black" : "border-border hover:border-luxe-black/50"
              )}
            >
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-luxe-gray-dark">{option.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="cardName" className="mb-1.5 block text-eyebrow">
            Name on card
          </label>
          <input
            id="cardName"
            autoComplete="cc-name"
            aria-invalid={Boolean(cardForm.formState.errors.cardName)}
            className={inputClass}
            {...cardForm.register("cardName")}
          />
          {cardForm.formState.errors.cardName ? (
            <p className="mt-1.5 text-xs text-destructive">{cardForm.formState.errors.cardName.message}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="cardNumber" className="mb-1.5 block text-eyebrow">
            Card number
          </label>
          <input
            id="cardNumber"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="1234 1234 1234 1234"
            aria-invalid={Boolean(cardForm.formState.errors.cardNumber)}
            className={inputClass}
            {...cardForm.register("cardNumber")}
          />
          {cardForm.formState.errors.cardNumber ? (
            <p className="mt-1.5 text-xs text-destructive">{cardForm.formState.errors.cardNumber.message}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="expiry" className="mb-1.5 block text-eyebrow">
              Expiry (MM/YY)
            </label>
            <input
              id="expiry"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              aria-invalid={Boolean(cardForm.formState.errors.expiry)}
              className={inputClass}
              {...cardForm.register("expiry")}
            />
            {cardForm.formState.errors.expiry ? (
              <p className="mt-1.5 text-xs text-destructive">{cardForm.formState.errors.expiry.message}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="cvc" className="mb-1.5 block text-eyebrow">
              CVC
            </label>
            <input
              id="cvc"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              aria-invalid={Boolean(cardForm.formState.errors.cvc)}
              className={inputClass}
              {...cardForm.register("cvc")}
            />
            {cardForm.formState.errors.cvc ? (
              <p className="mt-1.5 text-xs text-destructive">{cardForm.formState.errors.cvc.message}</p>
            ) : null}
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={sameBillingAsShipping}
          onChange={(event) => setSameBillingAsShipping(event.target.checked)}
          className="size-4 border-border accent-luxe-black"
        />
        Billing address same as shipping
      </label>

      {!sameBillingAsShipping ? (
        <div className="space-y-4 border-t border-border pt-6">
          <p className="text-eyebrow">Billing address</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="billingFirstName" className="mb-1.5 block text-eyebrow">
                First name
              </label>
              <input id="billingFirstName" className={inputClass} {...billingForm.register("firstName")} />
              {billingForm.formState.errors.firstName ? (
                <p className="mt-1.5 text-xs text-destructive">{billingForm.formState.errors.firstName.message}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="billingLastName" className="mb-1.5 block text-eyebrow">
                Last name
              </label>
              <input id="billingLastName" className={inputClass} {...billingForm.register("lastName")} />
              {billingForm.formState.errors.lastName ? (
                <p className="mt-1.5 text-xs text-destructive">{billingForm.formState.errors.lastName.message}</p>
              ) : null}
            </div>
          </div>
          <div>
            <label htmlFor="billingAddress1" className="mb-1.5 block text-eyebrow">
              Street address
            </label>
            <input id="billingAddress1" className={inputClass} {...billingForm.register("address1")} />
            {billingForm.formState.errors.address1 ? (
              <p className="mt-1.5 text-xs text-destructive">{billingForm.formState.errors.address1.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="billingCity" className="mb-1.5 block text-eyebrow">
                City
              </label>
              <input id="billingCity" className={inputClass} {...billingForm.register("city")} />
              {billingForm.formState.errors.city ? (
                <p className="mt-1.5 text-xs text-destructive">{billingForm.formState.errors.city.message}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="billingPostalCode" className="mb-1.5 block text-eyebrow">
                Postal code
              </label>
              <input id="billingPostalCode" className={inputClass} {...billingForm.register("postalCode")} />
              {billingForm.formState.errors.postalCode ? (
                <p className="mt-1.5 text-xs text-destructive">{billingForm.formState.errors.postalCode.message}</p>
              ) : null}
            </div>
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

      <p className="flex items-center gap-1.5 text-xs text-luxe-gray-dark">
        <ShieldCheck className="size-3.5 shrink-0" strokeWidth={1.5} />
        Demo checkout — no payment is charged.
      </p>

      <button
        type="submit"
        disabled={cardForm.formState.isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-2 bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Review Order
        <ArrowRight className="size-4" strokeWidth={1.5} />
      </button>
    </form>
  );
}
