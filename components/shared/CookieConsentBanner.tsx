"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsentChoice, setConsentChoice } from "@/lib/consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // localStorage-hydration-on-mount — the value genuinely doesn't exist until now (SSR has no localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(getConsentChoice() === null);
  }, []);

  if (!visible) return null;

  const decide = (accept: boolean) => {
    setConsentChoice({ analytics: accept, marketing: accept });
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie consent"
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
