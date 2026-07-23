"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { SocialSignInButtons } from "@/components/account/SocialSignInButtons";
import { loginSchema, magicLinkSchema, type LoginFormValues, type MagicLinkFormValues } from "@/lib/validations/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

export function LoginForm() {
  const { signIn, requestPasswordReset } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [linkSent, setLinkSent] = useState(false);

  const passwordForm = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });
  const magicLinkForm = useForm<MagicLinkFormValues>({ resolver: zodResolver(magicLinkSchema) });

  const onPasswordSubmit = async (values: LoginFormValues) => {
    const ok = await signIn(values);
    if (ok) router.push("/account");
  };

  const onMagicLinkSubmit = async (values: MagicLinkFormValues) => {
    const ok = await requestPasswordReset(values.email);
    if (ok) setLinkSent(true);
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="font-heading text-3xl">Sign In</h1>
      <p className="mt-2 text-sm text-luxe-gray-dark">Welcome back to ALEXANDRIS.</p>

      <div className="mt-8">
        <SocialSignInButtons />
      </div>

      <div className="my-8 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-eyebrow">Or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {mode === "password" ? (
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-eyebrow">
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(passwordForm.formState.errors.email)}
              className={inputClass}
              {...passwordForm.register("email")}
            />
            {passwordForm.formState.errors.email ? (
              <p className="mt-1.5 text-xs text-destructive">{passwordForm.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-eyebrow">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(passwordForm.formState.errors.password)}
              className={inputClass}
              {...passwordForm.register("password")}
            />
            {passwordForm.formState.errors.password ? (
              <p className="mt-1.5 text-xs text-destructive">{passwordForm.formState.errors.password.message}</p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={passwordForm.formState.isSubmitting}
            className="flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Sign In
          </button>
          {isFeatureEnabled("magic-link-auth") ? (
            <button
              type="button"
              onClick={() => setMode("magic-link")}
              className="w-full text-center text-xs text-luxe-gray-dark underline underline-offset-4 hover:text-luxe-black"
            >
              Forgot your password?
            </button>
          ) : null}
        </form>
      ) : linkSent ? (
        <p className="flex items-center gap-2 text-sm">
          <Check className="size-4 shrink-0" strokeWidth={1.5} />
          If an account exists for that email, a password reset link is on its way.
        </p>
      ) : (
        <form onSubmit={magicLinkForm.handleSubmit(onMagicLinkSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="magic-link-email" className="mb-1.5 block text-eyebrow">
              Email address
            </label>
            <input
              id="magic-link-email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(magicLinkForm.formState.errors.email)}
              className={inputClass}
              {...magicLinkForm.register("email")}
            />
            {magicLinkForm.formState.errors.email ? (
              <p className="mt-1.5 text-xs text-destructive">{magicLinkForm.formState.errors.email.message}</p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={magicLinkForm.formState.isSubmitting}
            className="flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Email Me a Reset Link
          </button>
          <button
            type="button"
            onClick={() => setMode("password")}
            className="w-full text-center text-xs text-luxe-gray-dark underline underline-offset-4 hover:text-luxe-black"
          >
            Back to sign in
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-luxe-gray-dark">
        New to ALEXANDRIS?{" "}
        <Link href="/account/register" className="text-luxe-black underline underline-offset-4">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-luxe-gray-dark">
        <Link href="/cart" className="underline underline-offset-4 hover:text-luxe-black">
          Continue as guest
        </Link>
      </p>
    </div>
  );
}
