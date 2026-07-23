"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/components/providers/AuthProvider";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/validations/auth";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

export function ResetPasswordForm() {
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
    if (ok) router.push("/account");
    else setFailed(true);
  };

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-sm">
        <h1 className="font-heading text-3xl">Invalid link</h1>
        <p className="mt-2 text-sm text-luxe-gray-dark">
          This password reset link is missing its token.{" "}
          <Link href="/account/login" className="underline underline-offset-4">
            Back to sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="font-heading text-3xl">Set a new password</h1>
      <p className="mt-2 text-sm text-luxe-gray-dark">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-4">
        <input type="hidden" {...register("token")} />
        <div>
          <label htmlFor="reset-password" className="mb-1.5 block text-eyebrow">
            New password
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
            Confirm new password
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
              Request a new one
            </Link>
            .
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Set New Password
        </button>
      </form>
    </div>
  );
}
