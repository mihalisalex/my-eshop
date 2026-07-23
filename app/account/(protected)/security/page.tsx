"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/components/providers/AuthProvider";
import { securitySchema, type SecurityFormValues } from "@/lib/validations/auth";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

export default function AccountSecurityPage() {
  const { changePassword } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SecurityFormValues>({ resolver: zodResolver(securitySchema) });

  const onSubmit = async (values: SecurityFormValues) => {
    const ok = await changePassword(values);
    if (ok) reset();
  };

  return (
    <div>
      <h1 className="font-heading text-3xl">Security</h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 max-w-md space-y-4">
        <div>
          <label htmlFor="security-currentPassword" className="mb-1.5 block text-eyebrow">
            Current password
          </label>
          <input
            id="security-currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword)}
            className={inputClass}
            {...register("currentPassword")}
          />
          {errors.currentPassword ? <p className="mt-1.5 text-xs text-destructive">{errors.currentPassword.message}</p> : null}
        </div>

        <div>
          <label htmlFor="security-newPassword" className="mb-1.5 block text-eyebrow">
            New password
          </label>
          <input
            id="security-newPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.newPassword)}
            className={inputClass}
            {...register("newPassword")}
          />
          {errors.newPassword ? <p className="mt-1.5 text-xs text-destructive">{errors.newPassword.message}</p> : null}
        </div>

        <div>
          <label htmlFor="security-confirmNewPassword" className="mb-1.5 block text-eyebrow">
            Confirm new password
          </label>
          <input
            id="security-confirmNewPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmNewPassword)}
            className={inputClass}
            {...register("confirmNewPassword")}
          />
          {errors.confirmNewPassword ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.confirmNewPassword.message}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 bg-luxe-black px-8 text-sm font-medium tracking-[0.05em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Update Password
        </button>
      </form>
    </div>
  );
}
