import type { CategorySeoOverride, ProductSeoOverride } from "@/lib/validation/product";
import type { BreadcrumbItem, Category, Collection, FaqItem, Product, SiteSeoDefaults } from "@/types";
import { ROUTES } from "@/constants/routes";

/**
 * The one place a page's SEO is decided.
 *
 * Before this, every route assembled its own metadata inline with `||` chains —
 * `product.seo?.title || product.name` repeated at each call site. That is where the
 * empty-string bug documented in `normalizeSeoOverride` came from, and it is where the
 * next one would have come from: five copies of the same fallback logic, four of which get
 * updated when the rule changes.
 *
 * Everything here is a PURE function of data already loaded. No database, no `server-only`,
 * no request context — which is what makes the whole SEO surface unit-testable, and is why
 * `lib/seo/resolve.test.ts` can assert canonical construction and noindex rules without a
 * running server.
 *
 * The rule, everywhere: a manual override wins if it has content; otherwise the value is
 * generated from the entity. `||` rather than `??` is deliberate and load-bearing — an
 * override saved through a form with the field left blank is stored as `""`, not absent,
 * and `??` would hand that empty string straight to the `<title>`.
 */

/** Everything a page needs to describe itself to a crawler and a social card. */
export interface ResolvedSeo {
  title: string;
  description: string;
  /** Absolute, and self-referencing unless the entity overrides it. */
  canonical: string;
  noIndex: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  breadcrumbs: BreadcrumbItem[];
  /** Category editorial copy. Empty for entities that do not carry it. */
  introContent?: string;
  faqs: FaqItem[];
}

export interface SeoContext {
  seo: SiteSeoDefaults;
  /** Localised label for the breadcrumb root. Passed in so this module stays free of i18n. */
  homeLabel?: string;
}

/** Absolute URL for a site-relative path. The single place `siteUrl` is joined to anything. */
export function absoluteUrl(path: string, siteUrl: string): string {
  return new URL(path, siteUrl).toString();
}

/**
 * Trims a generated description to something a SERP will actually show, cutting at a word
 * boundary rather than mid-word.
 *
 * Not applied to a manual override: an admin who wrote 200 characters meant to, and
 * silently truncating their copy is worse than letting Google do the truncating.
 */
export function clampDescription(text: string, max = 160): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The fallback rule, exported so the admin's SERP preview shows exactly what will ship.
 *
 * A preview that reimplements this is a preview that eventually lies — which is worse than
 * no preview, because the whole point is deciding whether the real output is good enough.
 *
 * `||` rather than `??`: an override saved through a form with the field left blank is
 * stored as `""`, and an empty string is "no override", not "an empty title".
 */
export function seoValueOr(override: string | undefined, generated: string): string {
  return override?.trim() || generated;
}

const overrideOr = seoValueOr;

/**
 * The `<title>` as it will actually appear, with the site's template applied.
 *
 * Length limits are the reason this matters. The template is appended by the root layout,
 * so a page title that looks comfortably short in isolation can be well past the point
 * Google truncates once the shop name is on the end of it — and the admin editing the
 * field has no way to know that from the field alone.
 */
export function applyTitleTemplate(title: string, titleTemplate: string): string {
  return titleTemplate.includes("%s") ? titleTemplate.replace("%s", title) : title;
}

/** Where a SERP starts cutting a title. A guide, not a hard limit — Google measures pixels. */
export const TITLE_LENGTH_LIMIT = 60;
/** Same, for the description. */
export const DESCRIPTION_LENGTH_LIMIT = 160;

/**
 * A product's SEO.
 *
 * The generated title is the product name alone. It is NOT decorated with the brand or the
 * category, because the site's `titleTemplate` already appends the shop name — and the
 * template on this shop is long, so anything added here is spent before the SERP truncates.
 * The audit surfaces over-long titles rather than this quietly manufacturing them.
 */
export function resolveProductSeo(
  product: Product,
  context: SeoContext & { category?: Pick<Category, "name" | "slug"> }
): ResolvedSeo {
  const { seo, category, homeLabel = "Home" } = context;
  const override = product.seo as ProductSeoOverride | undefined;
  const path = ROUTES.product(product.slug);

  const title = overrideOr(override?.title, product.name);
  const description = override?.description?.trim() || clampDescription(product.description);

  return {
    title,
    description,
    canonical: override?.canonicalUrl?.trim() || absoluteUrl(path, seo.siteUrl),
    noIndex: override?.noIndex === true,
    ogTitle: overrideOr(override?.ogTitle, title),
    ogDescription: overrideOr(override?.ogDescription, description),
    ogImage: override?.ogImage?.trim() || product.images[0]?.src,
    breadcrumbs: [
      { name: homeLabel, href: ROUTES.home },
      ...(category ? [{ name: category.name, href: ROUTES.category(category.slug) }] : []),
      { name: product.name, href: path },
    ],
    faqs: [],
  };
}

/**
 * A category's SEO, including the editorial fields that make it a landing page rather than
 * a grid with a heading.
 *
 * A hidden category resolves as noindex regardless of its override. The storefront 404s it
 * anyway, so the two agree — but this is what stops a hidden category reaching the sitemap
 * if the route ever starts serving them.
 */
export function resolveCategorySeo(
  category: Category,
  context: SeoContext & { ancestors?: Pick<Category, "name" | "slug">[]; productCount?: number }
): ResolvedSeo {
  const { seo, ancestors = [], homeLabel = "Home" } = context;
  const override = category.seo as CategorySeoOverride | undefined;
  const path = ROUTES.category(category.slug);

  const title = overrideOr(override?.title, category.name);
  const description =
    override?.description?.trim() ||
    (category.description ? clampDescription(category.description) : clampDescription(seo.defaultDescription));

  return {
    title,
    description,
    canonical: override?.canonicalUrl?.trim() || absoluteUrl(path, seo.siteUrl),
    noIndex: override?.noIndex === true || !category.isVisible,
    ogTitle: overrideOr(override?.ogTitle, title),
    ogDescription: overrideOr(override?.ogDescription, description),
    ogImage: override?.ogImage?.trim() || category.bannerImage?.src || category.image?.src,
    breadcrumbs: [
      { name: homeLabel, href: ROUTES.home },
      // Ancestors make a nested category's place in the tree explicit to both a reader and
      // a crawler. A flat Home > Category crumb throws away the hierarchy the taxonomy has.
      ...ancestors.map((ancestor) => ({ name: ancestor.name, href: ROUTES.category(ancestor.slug) })),
      { name: category.name, href: path },
    ],
    introContent: override?.introContent?.trim() || undefined,
    faqs: override?.faqs ?? [],
  };
}

export function resolveCollectionSeo(collection: Collection, context: SeoContext): ResolvedSeo {
  const { seo, homeLabel = "Home" } = context;
  const override = collection.seo as CategorySeoOverride | undefined;
  const path = ROUTES.collection(collection.slug);

  const title = overrideOr(override?.title, collection.title);
  const description =
    override?.description?.trim() ||
    clampDescription(collection.description || collection.subtitle || seo.defaultDescription);

  return {
    title,
    description,
    canonical: override?.canonicalUrl?.trim() || absoluteUrl(path, seo.siteUrl),
    noIndex: override?.noIndex === true,
    ogTitle: overrideOr(override?.ogTitle, title),
    ogDescription: overrideOr(override?.ogDescription, description),
    ogImage: override?.ogImage?.trim() || collection.image?.src,
    breadcrumbs: [
      { name: homeLabel, href: ROUTES.home },
      { name: "Collections", href: ROUTES.collections },
      { name: collection.title, href: path },
    ],
    introContent: override?.introContent?.trim() || undefined,
    faqs: override?.faqs ?? [],
  };
}

/**
 * A fixed route — /women, /sale, /about. No entity behind it, so everything is supplied by
 * the caller; this exists so those pages produce the same shape as the entity pages and can
 * be fed through the same metadata builder and the same audit.
 */
export function resolveStaticSeo(
  input: { path: string; title: string; description: string; noIndex?: boolean; ogImage?: string; breadcrumbLabel?: string },
  context: SeoContext
): ResolvedSeo {
  const { seo, homeLabel = "Home" } = context;
  return {
    title: input.title,
    description: clampDescription(input.description),
    canonical: absoluteUrl(input.path, seo.siteUrl),
    noIndex: input.noIndex === true,
    ogTitle: input.title,
    ogDescription: clampDescription(input.description),
    ogImage: input.ogImage,
    breadcrumbs:
      input.path === ROUTES.home
        ? [{ name: homeLabel, href: ROUTES.home }]
        : [
            { name: homeLabel, href: ROUTES.home },
            { name: input.breadcrumbLabel ?? input.title, href: input.path },
          ],
    faqs: [],
  };
}
