"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { SocialSignInButtons } from "@/components/account/SocialSignInButtons";
import { loginSchema, magicLinkSchema, type LoginFormValues, type MagicLinkFormValues } from "@/lib/validation/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { OAuthProviderName } from "@/lib/oauth/types";

const inputClass =
  "h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black aria-invalid:border-destructive";

interface LoginFormProps {
  configuredOAuthProviders: Record<OAuthProviderName, boolean>;
  from?: string;
  oauthError?: boolean;
}

export function LoginForm({ configuredOAuthProviders, from, oauthError }: LoginFormProps) {
  const t = useTranslations("Auth");
  const { signIn, requestPasswordReset } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [linkSent, setLinkSent] = useState(false);

  const passwordForm = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });
  const magicLinkForm = useForm<MagicLinkFormValues>({ resolver: zodResolver(magicLinkSchema) });

  const onPasswordSubmit = async (values: LoginFormValues) => {
    const ok = await signIn(values);
    if (!ok) return;
    // Invalidate the client Router Cache before navigating. The session cookie has just
    // changed, but the cached RSC payload for the destination was fetched under the OLD
    // session — its layout already ran its session check and baked in the old answer. Without
    // this the navigation appears to do nothing until a manual reload. The admin never had
    // this bug because its login is a Server Action that redirects server-side, which does
    // not consult the cache at all.
    router.refresh();
    router.push(from ?? "/account");
  };

  const onMagicLinkSubmit = async (values: MagicLinkFormValues) => {
    const ok = await requestPasswordReset(values.email);
    if (ok) setLinkSent(true);
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="font-heading text-3xl">{t("signIn")}</h1>
      <p className="mt-2 text-sm text-luxe-gray-dark">{t("welcomeBack")}</p>

      {oauthError ? (
        <p className="mt-4 text-sm text-destructive">
          {t("oauthFailed")}
        </p>
      ) : null}

      <div className="mt-8">
        <SocialSignInButtons configured={configuredOAuthProviders} from={from} />
      </div>

      <div className="my-8 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-eyebrow">{t("or")}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {mode === "password" ? (
        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-eyebrow">
              {t("emailAddress")}
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(passwordForm.formState.errors.email)}
              aria-describedby={passwordForm.formState.errors.email ? "login-email-error" : undefined}
              className={inputClass}
              {...passwordForm.register("email")}
            />
            {passwordForm.formState.errors.email ? (
              <p id="login-email-error" className="mt-1.5 text-xs text-destructive">
                {passwordForm.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-eyebrow">
              {t("password")}
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(passwordForm.formState.errors.password)}
              aria-describedby={passwordForm.formState.errors.password ? "login-password-error" : undefined}
              className={inputClass}
              {...passwordForm.register("password")}
            />
            {passwordForm.formState.errors.password ? (
              <p id="login-password-error" className="mt-1.5 text-xs text-destructive">
                {passwordForm.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={passwordForm.formState.isSubmitting}
            className="flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {t("signIn")}
          </button>
          {isFeatureEnabled("magic-link-auth") ? (
            <button
              type="button"
              onClick={() => setMode("magic-link")}
              className="w-full text-center text-xs text-luxe-gray-dark underline underline-offset-4 hover:text-luxe-black"
            >
              {t("forgotPassword")}
            </button>
          ) : null}
        </form>
      ) : linkSent ? (
        <p className="flex items-center gap-2 text-sm">
          <Check className="size-4 shrink-0" strokeWidth={1.5} />
          {t("resetLinkSent")}
        </p>
      ) : (
        <form onSubmit={magicLinkForm.handleSubmit(onMagicLinkSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="magic-link-email" className="mb-1.5 block text-eyebrow">
              {t("emailAddress")}
            </label>
            <input
              id="magic-link-email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(magicLinkForm.formState.errors.email)}
              aria-describedby={magicLinkForm.formState.errors.email ? "magic-link-email-error" : undefined}
              className={inputClass}
              {...magicLinkForm.register("email")}
            />
            {magicLinkForm.formState.errors.email ? (
              <p id="magic-link-email-error" className="mt-1.5 text-xs text-destructive">
                {magicLinkForm.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={magicLinkForm.formState.isSubmitting}
            className="flex h-12 w-full items-center justify-center bg-luxe-black text-sm font-medium tracking-[0.08em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {t("emailResetLink")}
          </button>
          <button
            type="button"
            onClick={() => setMode("password")}
            className="w-full text-center text-xs text-luxe-gray-dark underline underline-offset-4 hover:text-luxe-black"
          >
            {t("backToSignIn")}
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-luxe-gray-dark">
        {t("noAccountYet")}{" "}
        <Link href="/account/register" className="text-luxe-black underline underline-offset-4">
          {t("createAccount")}
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-luxe-gray-dark">
        <Link href="/cart" className="underline underline-offset-4 hover:text-luxe-black">
          {t("continueAsGuest")}
        </Link>
      </p>
    </div>
  );
}
