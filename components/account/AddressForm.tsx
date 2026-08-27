"use client";
import { useTranslations } from "next-intl";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addressSchema, type AddressFormValues } from "@/lib/validation/checkout";
import { COUNTRIES, DEFAULT_COUNTRY_CODE } from "@/constants/countries";
import { AddressAutocompleteInput } from "@/components/checkout/AddressAutocompleteInput";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

interface AddressFormProps {
  defaultValues?: AddressFormValues;
  onSubmit: (values: AddressFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function AddressForm({ defaultValues, onSubmit, onCancel, submitLabel = "Save Address" }: AddressFormProps) {
  const tAddr = useTranslations("Address");
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: defaultValues ?? {
      firstName: "",
      lastName: "",
      company: "",
      address1: "",
      address2: "",
      city: "",
      region: "",
      postalCode: "",
      countryCode: DEFAULT_COUNTRY_CODE,
      phone: "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 border border-border p-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="af-firstName" className="mb-1.5 block text-eyebrow">
            {tAddr("firstName")}
          </label>
          <input
            id="af-firstName"
            aria-invalid={Boolean(errors.firstName)}
            aria-describedby={errors.firstName ? "af-firstName-error" : undefined}
            className={inputClass}
            {...register("firstName")}
          />
          {errors.firstName ? (
            <p id="af-firstName-error" className="mt-1.5 text-xs text-destructive">
              {errors.firstName.message}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="af-lastName" className="mb-1.5 block text-eyebrow">
            {tAddr("lastName")}
          </label>
          <input
            id="af-lastName"
            aria-invalid={Boolean(errors.lastName)}
            aria-describedby={errors.lastName ? "af-lastName-error" : undefined}
            className={inputClass}
            {...register("lastName")}
          />
          {errors.lastName ? (
            <p id="af-lastName-error" className="mt-1.5 text-xs text-destructive">
              {errors.lastName.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="af-company" className="mb-1.5 block text-eyebrow">
          {tAddr("company")}
        </label>
        <input id="af-company" className={inputClass} {...register("company")} />
      </div>

      <Controller
        name="address1"
        control={control}
        render={({ field }) => (
          <AddressAutocompleteInput
            id="af-address1"
            label={tAddr("streetAddress")}
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
        <label htmlFor="af-address2" className="mb-1.5 block text-eyebrow">
          {tAddr("apartment")}
        </label>
        <input id="af-address2" className={inputClass} {...register("address2")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="af-city" className="mb-1.5 block text-eyebrow">
            {tAddr("city")}
          </label>
          <input
            id="af-city"
            aria-invalid={Boolean(errors.city)}
            aria-describedby={errors.city ? "af-city-error" : undefined}
            className={inputClass}
            {...register("city")}
          />
          {errors.city ? (
            <p id="af-city-error" className="mt-1.5 text-xs text-destructive">
              {errors.city.message}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="af-region" className="mb-1.5 block text-eyebrow">
            {tAddr("region")}
          </label>
          <input id="af-region" className={inputClass} {...register("region")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="af-postalCode" className="mb-1.5 block text-eyebrow">
            {tAddr("postalCode")}
          </label>
          <input
            id="af-postalCode"
            aria-invalid={Boolean(errors.postalCode)}
            aria-describedby={errors.postalCode ? "af-postalCode-error" : undefined}
            className={inputClass}
            {...register("postalCode")}
          />
          {errors.postalCode ? (
            <p id="af-postalCode-error" className="mt-1.5 text-xs text-destructive">
              {errors.postalCode.message}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="af-countryCode" className="mb-1.5 block text-eyebrow">
            {tAddr("country")}
          </label>
          <select id="af-countryCode" className={cn(inputClass, "appearance-none")} {...register("countryCode")}>
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="af-phone" className="mb-1.5 block text-eyebrow">
          {tAddr("phone")}
        </label>
        <input
          id="af-phone"
          type="tel"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "af-phone-error" : undefined}
          className={inputClass}
          {...register("phone")}
        />
        {errors.phone ? (
          <p id="af-phone-error" className="mt-1.5 text-xs text-destructive">
            {errors.phone.message}
          </p>
        ) : null}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-11 flex-1 items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.05em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 border border-border text-sm font-medium tracking-[0.05em] uppercase transition-colors hover:border-luxe-black"
        >
          {tAddr("cancel")}
        </button>
      </div>
    </form>
  );
}
