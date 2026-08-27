"use client";

import { useTranslations } from "next-intl";
import type { OAuthProviderName } from "@/lib/oauth/types";

// The constant holds message KEYS, not labels. It is evaluated once at module load, where
// there is no request and therefore no locale — calling t() here would be a reference to a
// hook outside a component.
const SOCIAL_OPTIONS: { id: OAuthProviderName; labelKey: string }[] = [
  { id: "google", labelKey: "continueWithGoogle" },
  { id: "apple", labelKey: "continueWithApple" },
  { id: "facebook", labelKey: "continueWithFacebook" },
];

interface SocialSignInButtonsProps {
  configured: Record<OAuthProviderName, boolean>;
  /** Relative path to return to after a successful sign-in. */
  from?: string;
}

/** Real links to the OAuth start route — only rendered for providers with credentials configured server-side, so this never has to know or leak whether a provider is enabled beyond the boolean it's handed. */
export function SocialSignInButtons({ configured, from }: SocialSignInButtonsProps) {
  const t = useTranslations("Auth");
  const options = SOCIAL_OPTIONS.filter((option) => configured[option.id]);
  if (options.length === 0) return null;

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const href = `/api/auth/oauth/${option.id}/start${from ? `?from=${encodeURIComponent(from)}` : ""}`;
        return (
          <a
            key={option.id}
            href={href}
            className="flex h-12 w-full items-center justify-center border border-border text-sm font-medium transition-colors hover:border-luxe-black"
          >
            {t(option.labelKey)}
          </a>
        );
      })}
    </div>
  );
}
