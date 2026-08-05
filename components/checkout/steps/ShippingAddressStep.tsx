"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { addressSchema, type AddressFormValues } from "@/lib/validations/checkout";
import { COUNTRIES } from "@/constants/countries";
import { useCheckout } from "@/components/providers/CheckoutProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { AddressAutocompleteInput } from "@/components/checkout/AddressAutocompleteInput";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

export function ShippingAddressStep() {
  const { shippingAddress, setShippingAddress } = useCheckout();
  const { customer, isLoading: isAuthLoading } = useAuth();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: shippingAddress ?? {
      firstName: "",
      lastName: "",
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

  // Prefill from the signed-in customer's default address — guest checkout stays blank.
  // Skipped once the checkout session already has an address, or once the shopper has
  // started typing, so this never clobbers in-progress or already-confirmed input.
  useEffect(() => {
    if (shippingAddress || isAuthLoading || !customer || isDirty) return;
    const defaultAddress = customer.addresses.find((a) => a.id === customer.defaultAddressId) ?? customer.addresses[0];
    if (defaultAddress) reset(defaultAddress);
  }, [customer, isAuthLoading, shippingAddress, isDirty, reset]);

  const onSubmit = async (values: AddressFormValues) => {
    await setShippingAddress(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div>
        <h2 className="font-heading text-xl">Shipping Address</h2>
        <p className="mt-1 text-sm text-luxe-gray-dark">Where should we send your order?</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="mb-1.5 block text-eyebrow">
            First name
          </label>
          <input
            id="firstName"
            autoComplete="given-name"
            aria-invalid={Boolean(errors.firstName)}
            aria-describedby={errors.firstName ? "firstName-error" : undefined}
            className={inputClass}
            {...register("firstName")}
          />
          {errors.firstName ? (
            <p id="firstName-error" className="mt-1.5 text-xs text-destructive">
              {errors.firstName.message}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1.5 block text-eyebrow">
            Last name
          </label>
          <input
            id="lastName"
            autoComplete="family-name"
            aria-invalid={Boolean(errors.lastName)}
            aria-describedby={errors.lastName ? "lastName-error" : undefined}
            className={inputClass}
            {...register("lastName")}
          />
          {errors.lastName ? (
            <p id="lastName-error" className="mt-1.5 text-xs text-destructive">
              {errors.lastName.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="company" className="mb-1.5 block text-eyebrow">
          Company (optional)
        </label>
        <input id="company" autoComplete="organization" className={inputClass} {...register("company")} />
      </div>

      <Controller
        name="address1"
        control={control}
        render={({ field }) => (
          <AddressAutocompleteInput
            id="address1"
            label="Street address"
            value={field.value}
            onChange={field.onChange}
            error={errors.address1?.message}
            onSelect={(suggestion) => {
              setValue("address1", suggestion.address1, { shouldValidate: true });
              setValue("city", suggestion.city, { shouldValidate: true });
              setValue("region", suggestion.region, { shouldValidate: true });
              setValue("postalCode", suggestion.postalCode, { shouldValidate: true });
              setValue("countryCode", suggestion.countryCode, { shouldValidate: true });
            }}
          />
        )}
      />

      <div>
        <label htmlFor="address2" className="mb-1.5 block text-eyebrow">
          Apartment, suite, etc. (optional)
        </label>
        <input id="address2" autoComplete="address-line2" className={inputClass} {...register("address2")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className="mb-1.5 block text-eyebrow">
            City
          </label>
          <input
            id="city"
            autoComplete="address-level2"
            aria-invalid={Boolean(errors.city)}
            aria-describedby={errors.city ? "city-error" : undefined}
            className={inputClass}
            {...register("city")}
          />
          {errors.city ? (
            <p id="city-error" className="mt-1.5 text-xs text-destructive">
              {errors.city.message}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="region" className="mb-1.5 block text-eyebrow">
            State / Region (optional)
          </label>
          <input id="region" autoComplete="address-level1" className={inputClass} {...register("region")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="postalCode" className="mb-1.5 block text-eyebrow">
            Postal code
          </label>
          <input
            id="postalCode"
            autoComplete="postal-code"
            aria-invalid={Boolean(errors.postalCode)}
            aria-describedby={errors.postalCode ? "postalCode-error" : undefined}
            className={inputClass}
            {...register("postalCode")}
          />
          {errors.postalCode ? (
            <p id="postalCode-error" className="mt-1.5 text-xs text-destructive">
              {errors.postalCode.message}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="countryCode" className="mb-1.5 block text-eyebrow">
            Country
          </label>
          <select
            id="countryCode"
            autoComplete="country"
            aria-invalid={Boolean(errors.countryCode)}
            className={cn(inputClass, "appearance-none")}
            {...register("countryCode")}
          >
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="mb-1.5 block text-eyebrow">
          Phone (optional)
        </label>
        <input id="phone" type="tel" autoComplete="tel" className={inputClass} {...register("phone")} />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-2 bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Continue to Delivery
        <ArrowRight className="size-4" strokeWidth={1.5} />
      </button>
    </form>
  );
}
