"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/components/providers/AuthProvider";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/validation/auth";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const { resetPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [failed, setFailed] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token: token ?? "" } });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    const ok = await resetPassword(values.token, values.password);
    if (!ok) {
      setFailed(true);
      return;
    }
    // Invalidate the client Router Cache before navigating. The session cookie has just
    // changed, but the cached RSC payload for the destination was fetched under the OLD
    // session — its layout already ran its session check and baked in the old answer. Without
    // this the navigation appears to do nothing until a manual reload. The admin never had
    // this bug because its login is a Server Action that redirects server-side, which does
    // not consult the cache at all.
    router.refresh();
    router.push("/account");
  };

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-heading text-3xl">{t("invalidLink")}</h1>
        <p className="mt-2 text-sm text-luxe-gray-dark">
          This password reset link is missing its token.{" "}
          <Link href="/account/login" className="underline underline-offset-4">
            {t("backToSignIn")}
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="font-heading text-3xl">{t("setNewPasswordTitle")}</h1>
      <p className="mt-2 text-sm text-luxe-gray-dark">{t("chooseNewPassword")}</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-4">
        <input type="hidden" {...register("token")} />
        <div>
          <label htmlFor="reset-password" className="mb-1.5 block text-eyebrow">
            {t("newPassword")}
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            className={inputClass}
            {...register("password")}
          />
          {errors.password ? <p className="mt-1.5 text-xs text-destructive">{errors.password.message}</p> : null}
        </div>
        <div>
          <label htmlFor="reset-confirm-password" className="mb-1.5 block text-eyebrow">
            {t("confirmNewPassword")}
          </label>
          <input
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            className={inputClass}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? <p className="mt-1.5 text-xs text-destructive">{errors.confirmPassword.message}</p> : null}
        </div>
        {failed ? (
          <p className="text-xs text-destructive">
            That link may have expired.{" "}
            <Link href="/account/login" className="underline underline-offset-4">
              {t("requestNewOne")}
            </Link>
            .
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {t("setNewPasswordCta")}
        </button>
      </form>
    </div>
  );
}
