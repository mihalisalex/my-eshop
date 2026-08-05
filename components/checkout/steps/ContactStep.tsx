"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { contactSchema, type ContactFormValues } from "@/lib/validations/checkout";
import { useCheckout } from "@/components/providers/CheckoutProvider";

export function ContactStep() {
  const t = useTranslations("Checkout");
  const { email, setEmail } = useCheckout();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { email },
  });

  const onSubmit = async (values: ContactFormValues) => {
    await setEmail(values.email);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div>
        <h2 className="font-heading text-xl">{t("contactTitle")}</h2>
        <p className="mt-1 text-sm text-luxe-gray-dark">{t("contactSubtitle")}</p>
      </div>

      <div>
        <label htmlFor="checkout-email" className="mb-1.5 block text-eyebrow">
          {t("emailAddress")}
        </label>
        <input
          id="checkout-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "checkout-email-error" : undefined}
          className="h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive"
          {...register("email")}
        />
        {errors.email ? (
          <p id="checkout-email-error" className="mt-1.5 text-xs text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-12 w-full items-center justify-center gap-2 bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {t("continueToShipping")}
        <ArrowRight className="size-4" strokeWidth={1.5} />
      </button>
    </form>
  );
}
