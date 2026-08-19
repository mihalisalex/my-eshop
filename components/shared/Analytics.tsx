"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { hasConsent, onConsentChange } from "@/lib/consent";

/**
 * Google Analytics 4, loaded only after the visitor has actually consented (QA-029).
 *
 * The consent gate in lib/consent.ts existed but nothing called it, and no analytics script
 * existed at all — so the banner was asking permission for something that never happened.
 * This is the caller.
 *
 * Three rules this encodes, in order of how easy they are to get wrong:
 *
 *  1. **Nothing loads before consent.** The <Script> is not rendered at all until
 *     `hasConsent("analytics")` is true, so no request reaches Google and no cookie is set
 *     for a visitor who declined or has not answered. Loading the tag and then "disabling"
 *     it is the common shortcut and is not the same thing — the request itself is the
 *     tracking event.
 *  2. **Granting consent takes effect immediately.** It subscribes to the consent change
 *     event, so clicking "Accept All" starts measurement on that visit rather than the next
 *     one. Without it, the visit that produced the consent is the one visit never measured.
 *  3. **Withdrawing consent takes effect immediately too.** GA is told to stop via the
 *     documented `window['ga-disable-<ID>']` flag AND the component unmounts the script.
 *     A loaded gtag cannot be truly unloaded from a live page, so the flag is what makes
 *     the rest of the session honest until the next navigation.
 *
 * Renders nothing when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset, which is the default — the
 * same "unconfigured integration is invisible, not broken" convention as email, courier,
 * Blob storage and OAuth.
 */
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function Analytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    // localStorage is unreadable during SSR, so the real value only exists from here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsented(hasConsent("analytics"));
    return onConsentChange((choice) => setConsented(choice.analytics));
  }, []);

  useEffect(() => {
    if (!MEASUREMENT_ID) return;
    // Read on every change, including withdrawal after the script has already loaded.
    (window as unknown as Record<string, boolean>)[`ga-disable-${MEASUREMENT_ID}`] = !consented;
  }, [consented]);

  if (!MEASUREMENT_ID || !consented) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
          gtag('config', '${MEASUREMENT_ID}', { anonymize_ip: true, send_page_view: false });
        `}
      </Script>
      <PageViews measurementId={MEASUREMENT_ID} />
    </>
  );
}

/**
 * Explicit page_view events on route change.
 *
 * `send_page_view` is off in the config above because GA's automatic pageview fires once,
 * on the initial document load. This is a single-page app: every subsequent navigation is a
 * client-side transition GA never sees, so without this the whole site would report as one
 * page view per session.
 */
function PageViews({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (!gtag) return;
    const query = searchParams.toString();
    gtag("event", "page_view", {
      page_path: query ? `${pathname}?${query}` : pathname,
      send_to: measurementId,
    });
  }, [pathname, searchParams, measurementId]);

  return null;
}
