import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/config";

/**
 * "Without i18n routing" mode (https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing)
 * — cookie-based locale, no `/el/` URL prefix and no `[locale]` route segment.
 *
 * That is now a considered position rather than a shortcut (QA-018). One URL set is correct
 * while both locales render the SAME content: every product name, description, category,
 * collection, blog post and legal page exists only in Greek, and switching to English
 * changes ~90 chrome strings and nothing a search engine would index differently.
 *
 * A crawler arrives with no cookie and therefore gets Greek — the default — which is the
 * version that should be indexed.
 *
 * WHAT WOULD CHANGE THIS: real translated content. The day products, categories and legal
 * pages carry Greek and English versions, this should become locale-prefixed routing
 * (`app/[locale]/`, unprefixed default) with `hreflang` alternates and both locales in the
 * sitemap. Doing it before the content exists produces two near-duplicate URL sets, which
 * costs rankings instead of earning them.
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
