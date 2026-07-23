"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/components/providers/AuthProvider";
import { SocialSignInButtons } from "@/components/account/SocialSignInButtons";
import { registerSchema, type RegisterFormValues } from "@/lib/validations/auth";
import type { OAuthProviderName } from "@/lib/oauth/types";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

interface RegisterFormProps {
  configuredOAuthProviders: Record<OAuthProviderName, boolean>;
}

export function RegisterForm({ configuredOAuthProviders }: RegisterFormProps) {
  const { signUp } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterFormValues) => {
    const ok = await signUp(values);
    if (ok) router.push("/account");
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="font-heading text-3xl">Create Account</h1>
      <p className="mt-2 text-sm text-luxe-gray-dark">Join ALEXANDRIS for faster checkout and order tracking.</p>

      <div className="mt-8">
        <SocialSignInButtons configured={configuredOAuthProviders} />
      </div>

      <div className="my-8 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-eyebrow">Or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="register-firstName" className="mb-1.5 block text-eyebrow">
              First name
            </label>
            <input
              id="register-firstName"
              autoComplete="given-name"
              aria-invalid={Boolean(errors.firstName)}
              className={inputClass}
              {...register("firstName")}
            />
            {errors.firstName ? <p className="mt-1.5 text-xs text-destructive">{errors.firstName.message}</p> : null}
          </div>
          <div>
            <label htmlFor="register-lastName" className="mb-1.5 block text-eyebrow">
              Last name
            </label>
            <input
              id="register-lastName"
              autoComplete="family-name"
              aria-invalid={Boolean(errors.lastName)}
              className={inputClass}
              {...register("lastName")}
            />
            {errors.lastName ? <p className="mt-1.5 text-xs text-destructive">{errors.lastName.message}</p> : null}
          </div>
        </div>

        <div>
          <label htmlFor="register-email" className="mb-1.5 block text-eyebrow">
            Email address
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            className={inputClass}
            {...register("email")}
          />
          {errors.email ? <p className="mt-1.5 text-xs text-destructive">{errors.email.message}</p> : null}
        </div>

        <div>
          <label htmlFor="register-password" className="mb-1.5 block text-eyebrow">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            className={inputClass}
            {...register("password")}
          />
          {errors.password ? <p className="mt-1.5 text-xs text-destructive">{errors.password.message}</p> : null}
        </div>

        <div>
          <label htmlFor="register-confirmPassword" className="mb-1.5 block text-eyebrow">
            Confirm password
          </label>
          <input
            id="register-confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            className={inputClass}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? <p className="mt-1.5 text-xs text-destructive">{errors.confirmPassword.message}</p> : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Create Account
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-luxe-gray-dark">
        Already have an account?{" "}
        <Link href="/account/login" className="text-luxe-black underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
