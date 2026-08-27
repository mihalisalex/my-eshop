"use client";
import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsentChoice, setConsentChoice } from "@/lib/consent";

/**
 * Rendered server-side rather than only after mount, because this banner is fixed to the
 * bottom of the viewport and its paragraph is wide enough to be the page's Largest
 * Contentful Paint element. Waiting for `useEffect` meant it painted only after hydration,
 * which measured as ~3.7s of pure LCP render delay on the homepage — the banner, not the
 * content, was setting the store's Core Web Vitals.
 *
 * Consent lives in localStorage, which the server cannot read, so the "already decided"
 * case is handled before first paint by the inline script in app/layout.tsx: it stamps
 * data-consent="set" on <html> and CSS hides this element, with no flash and no JS wait.
 * `visible` therefore starts true so the server and first client render agree.
 */
export function CookieConsentBanner() {
  const tA11y = useTranslations("A11y");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // localStorage-hydration-on-mount — the value genuinely doesn't exist until now (SSR has no localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(getConsentChoice() === null);
  }, []);

  if (!visible) return null;

  const decide = (accept: boolean) => {
    setConsentChoice({ analytics: accept, marketing: accept });
    // Drop the pre-paint CSS hook too, so the banner cannot reappear on a client-side
    // navigation before the effect above re-runs.
    document.documentElement.dataset.consent = "set";
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label={tA11y("cookieConsent")}
      data-cookie-consent
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-luxe-white p-4 sm:p-5"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-luxe-gray-dark">
          We use essential cookies to keep your cart and account working, and optional cookies to understand site usage.
          See our{" "}
          <Link href="/legal/cookie-policy" className="underline hover:text-luxe-black">
            Cookie Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide(false)}
            className="h-10 border border-border px-4 text-xs font-medium tracking-[0.05em] uppercase hover:border-luxe-black"
          >
            Decline Non-Essential
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className="h-10 bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
