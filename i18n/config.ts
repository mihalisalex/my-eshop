export const SUPPORTED_LOCALES = ["el", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Greek, because that is what this shop actually is (QA-018).
 *
 * The audit filed the thin Greek coverage as a localisation gap, on the assumption of a
 * bilingual shop with English as its base. The data says otherwise: all 175 products store
 * GREEK names and descriptions in `name`/`description`, and the `nameEl`/`descriptionEl`
 * translation columns are empty on every one of them. Categories, collections, blog posts,
 * legal pages and SEO titles have no translation column at all. The only thing with two
 * variants is ~90 UI chrome strings.
 *
 * So the site was serving Greek content while declaring `<html lang="en">` — telling search
 * engines and screen readers the wrong language for nearly every word on the page. Greek is
 * the default; English remains a UI convenience for the chrome, which is the honest
 * description of what it is.
 *
 * DELIBERATELY still one URL set, with no locale prefix and no hreflang. hreflang describes
 * alternate URLs for the same content in different languages; with the content identical in
 * both modes those URLs would be ~95% duplicates of each other, which dilutes rankings
 * rather than helping them. Locale-prefixed routes become the right answer the day product
 * and category content is genuinely translated — see the note in i18n/request.ts.
 */
export const DEFAULT_LOCALE: Locale = "el";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isSupportedLocale(value: string | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}
