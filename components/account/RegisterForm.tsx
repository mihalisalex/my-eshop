"use client";
import { useTranslations } from "next-intl";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/components/providers/AuthProvider";
import { SocialSignInButtons } from "@/components/account/SocialSignInButtons";
import { registerSchema, type RegisterFormValues } from "@/lib/validation/auth";
import type { OAuthProviderName } from "@/lib/oauth/types";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

interface RegisterFormProps {
  configuredOAuthProviders: Record<OAuthProviderName, boolean>;
}

export function RegisterForm({ configuredOAuthProviders }: RegisterFormProps) {
  const t = useTranslations("Auth");
  const { signUp } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterFormValues) => {
    const ok = await signUp(values);
    if (!ok) return;
    // Invalidate the client Router Cache before navigating. The session cookie has just
    // changed, but the cached RSC payload for the destination was fetched under the OLD
    // session — its layout already ran its session check and baked in the old answer. Without
    // this the navigation appears to do nothing until a manual reload. The admin never had
    // this bug because its login is a Server Action that redirects server-side, which does
    // not consult the cache at all.
    router.refresh();
    router.push("/account");
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="font-heading text-3xl">{t("createAccountTitle")}</h1>
      <p className="mt-2 text-sm text-luxe-gray-dark">{t("joinBlurb")}</p>

      <div className="mt-8">
        <SocialSignInButtons configured={configuredOAuthProviders} />
      </div>

      <div className="my-8 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-eyebrow">{t("or")}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="register-firstName" className="mb-1.5 block text-eyebrow">
              {t("firstName")}
            </label>
            <input
              id="register-firstName"
              autoComplete="given-name"
              aria-invalid={Boolean(errors.firstName)}
              aria-describedby={errors.firstName ? "register-firstName-error" : undefined}
              className={inputClass}
              {...register("firstName")}
            />
            {errors.firstName ? (
              <p id="register-firstName-error" className="mt-1.5 text-xs text-destructive">
                {errors.firstName.message}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="register-lastName" className="mb-1.5 block text-eyebrow">
              {t("lastName")}
            </label>
            <input
              id="register-lastName"
              autoComplete="family-name"
              aria-invalid={Boolean(errors.lastName)}
              aria-describedby={errors.lastName ? "register-lastName-error" : undefined}
              className={inputClass}
              {...register("lastName")}
            />
            {errors.lastName ? (
              <p id="register-lastName-error" className="mt-1.5 text-xs text-destructive">
                {errors.lastName.message}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label htmlFor="register-email" className="mb-1.5 block text-eyebrow">
            {t("emailAddress")}
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "register-email-error" : undefined}
            className={inputClass}
            {...register("email")}
          />
          {errors.email ? (
            <p id="register-email-error" className="mt-1.5 text-xs text-destructive">
              {errors.email.message}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="register-password" className="mb-1.5 block text-eyebrow">
            {t("password")}
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "register-password-error" : undefined}
            className={inputClass}
            {...register("password")}
          />
          {errors.password ? (
            <p id="register-password-error" className="mt-1.5 text-xs text-destructive">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="register-confirmPassword" className="mb-1.5 block text-eyebrow">
            {t("confirmPassword")}
          </label>
          <input
            id="register-confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? "register-confirmPassword-error" : undefined}
            className={inputClass}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p id="register-confirmPassword-error" className="mt-1.5 text-xs text-destructive">
              {errors.confirmPassword.message}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t("createAccountTitle")}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-luxe-gray-dark">
        {t("alreadyHaveAccount")}{" "}
        <Link href="/account/login" className="text-luxe-black underline underline-offset-4">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
