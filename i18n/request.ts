import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/config";

/**
 * "Without i18n routing" mode (https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing)
 * — cookie-based locale, no /en//el/ URL prefix and no [locale] route segment, matching
 * the deliberate choice made for this pass: real server-rendered translation without
 * restructuring every existing route/sitemap/canonical-URL decision made earlier today.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
