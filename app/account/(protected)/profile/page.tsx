"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { getCommerceProvider } from "@/lib/commerce";
import { profileSchema, type ProfileFormValues } from "@/lib/validation/auth";
import { useTranslations } from "next-intl";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

export default function AccountProfilePage() {
  const t = useTranslations("Account");
  const { customer, refreshCustomer } = useAuth();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: customer?.firstName ?? "",
      lastName: customer?.lastName ?? "",
      phone: customer?.phone ?? "",
    },
  });

  if (!customer) return null;

  const onSubmit = async (values: ProfileFormValues) => {
    const commerce = getCommerceProvider();
    await commerce.customer.updateProfile(customer.id, values);
    await refreshCustomer();
    toast({ title: t("profileUpdated"), tone: "success" });
  };

  return (
    <div>
      <h1 className="font-heading text-3xl">{t("profile")}</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 max-w-md space-y-4">
        <div>
          <label htmlFor="profile-email" className="mb-1.5 block text-eyebrow">
            {t("emailAddress")}
          </label>
          <input id="profile-email" value={customer.email} disabled className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-firstName" className="mb-1.5 block text-eyebrow">
              {t("firstName")}
            </label>
            <input id="profile-firstName" aria-invalid={Boolean(errors.firstName)} className={inputClass} {...register("firstName")} />
            {errors.firstName ? <p className="mt-1.5 text-xs text-destructive">{errors.firstName.message}</p> : null}
          </div>
          <div>
            <label htmlFor="profile-lastName" className="mb-1.5 block text-eyebrow">
              {t("lastName")}
            </label>
            <input id="profile-lastName" aria-invalid={Boolean(errors.lastName)} className={inputClass} {...register("lastName")} />
            {errors.lastName ? <p className="mt-1.5 text-xs text-destructive">{errors.lastName.message}</p> : null}
          </div>
        </div>

        <div>
          <label htmlFor="profile-phone" className="mb-1.5 block text-eyebrow">
            Phone (optional)
          </label>
          <input id="profile-phone" type="tel" className={inputClass} {...register("phone")} />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 bg-luxe-black px-8 text-sm font-medium tracking-[0.05em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t("saveChanges")}
        </button>
      </form>
    </div>
  );
}
