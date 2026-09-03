import type { Metadata } from "next";
import type { BreadcrumbItem, FaqItem, Product, SiteSeoDefaults } from "@/types";
import { COMPANY } from "@/constants/company";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

interface PageMetadataInput {
  seo: SiteSeoDefaults;
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
  /** Absolute URL that wins over the one derived from `path` — see ResolvedSeo.canonical. */
  canonical?: string;
  /** Social-card overrides. Fall back to `title`/`description` when absent. */
  ogTitle?: string;
  ogDescription?: string;
  /**
   * Defaults to the site's own default locale (Greek), NOT "en". It defaulted to English
   * while every product name on the page was Greek, so pages that didn't thread the request
   * locale through advertised `og:locale=en_US` for Greek content. Pass it explicitly where
   * the request locale is available (see app/products/[slug]/page.tsx).
   */
  locale?: Locale;
}

const OG_LOCALE: Record<Locale, string> = { en: "en_US", el: "el_GR" };

/** Builds a Next.js Metadata object from site-wide SEO defaults plus per-page overrides. */
export function buildMetadata({
  seo,
  title,
  description,
  path = "/",
  image,
  noIndex = false,
  canonical,
  ogTitle,
  ogDescription,
  locale = DEFAULT_LOCALE,
}: PageMetadataInput): Metadata {
  const url = canonical ?? new URL(path, seo.siteUrl).toString();
  const resolvedTitle = title ?? seo.defaultTitle;
  const resolvedDescription = description ?? seo.defaultDescription;
  const resolvedImage = image ?? seo.defaultOgImage;
  const resolvedOgTitle = ogTitle ?? resolvedTitle;
  const resolvedOgDescription = ogDescription ?? resolvedDescription;

  /**
   * Omitted entirely when there is no image to name, so Next's file-based convention takes
   * over — `app/opengraph-image.tsx` renders a branded 1200x630 card from the live site name
   * and tagline (QA-028).
   *
   * This is why the stock photo was so persistent: that card already existed, but declaring
   * `openGraph.images` here ALWAYS beats the file convention, so every share previewed an
   * Unsplash photograph of someone else's shoes instead. Setting a default image is what
   * disables the generated one, which is the opposite of how it reads.
   */
  const imageMetadata = resolvedImage
    ? {
        openGraph: { images: [{ url: resolvedImage, width: 1200, height: 630, alt: resolvedTitle }] },
        twitter: { images: [resolvedImage] },
      }
    : { openGraph: {}, twitter: {} };

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: resolvedOgTitle,
      description: resolvedOgDescription,
      url,
      siteName: seo.organization.name,
      locale: OG_LOCALE[locale],
      type: "website",
      ...imageMetadata.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedOgTitle,
      description: resolvedOgDescription,
      creator: seo.twitterHandle,
      ...imageMetadata.twitter,
    },
  };
}

/**
 * Now carries the real registered address, VAT number and contact points from
 * constants/company.ts. For a single-location Greek shop that is what lets search
 * engines associate the site with an actual business rather than a name and a logo.
 */
export function organizationSchema(seo: SiteSeoDefaults) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: seo.organization.name,
    legalName: COMPANY.legalName,
    url: seo.siteUrl,
    logo: seo.organization.logo,
    // Omitted rather than emitted empty. `sameAs` is a claim that these profiles ARE this
    // business, so an empty array is the honest state until real ones exist — and shipping
    // `sameAs: []` invites someone to "fix" it by putting the seeded handles back.
    ...(seo.organization.sameAs.length > 0 ? { sameAs: seo.organization.sameAs } : {}),
    vatID: COMPANY.vatNumber,
    email: COMPANY.email,
    telephone: COMPANY.phoneE164,
    address: {
      "@type": "PostalAddress",
      streetAddress: COMPANY.address.street,
      postalCode: COMPANY.address.postalCode,
      addressLocality: COMPANY.address.city,
      addressRegion: COMPANY.address.region,
      addressCountry: COMPANY.address.countryCode,
    },
  };
}

export function websiteSchema(seo: SiteSeoDefaults) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: seo.organization.name,
    url: seo.siteUrl,
    // The site's content language. A single value, not an array, because there is one URL
    // set serving Greek content — claiming two languages here while every product name is
    // Greek would be the same misstatement `<html lang="en">` was making.
    inLanguage: DEFAULT_LOCALE,
    // No `potentialAction`/SearchAction here. It used to advertise
    // `${siteUrl}/search?q={search_term_string}` to search engines, and there is no
    // /search route — search exists only as a header overlay with no URL of its own, so
    // the declared endpoint 404s. Telling Google a sitelinks-searchbox target that does
    // not resolve is worse than declaring nothing. Restore this the day a real /search
    // page exists (which would also make results linkable, shareable and bookmarkable —
    // see the audit's QA-042).
  };
}

export function breadcrumbSchema(items: BreadcrumbItem[], siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.href, siteUrl).toString(),
    })),
  };
}

/**
 * Rendered on every product detail page (app/products/[slug]/page.tsx).
 *
 * `aggregateRating` is emitted ONLY from a passed-in review summary, and only when that
 * summary has reviews in it.
 *
 * It used to come from `Product.rating` — a denormalised column no review system wrote,
 * while reviews were read from an empty JSON file. The markup could therefore assert a
 * rating that appeared nowhere on the page, which is exactly the "structured data must
 * match visible content" rule Google enforces with manual actions.
 *
 * The condition for its return was a real review system whose ratings a visitor can see
 * and count. That now exists, so the rating comes from the same getReviewSummary the
 * visible stars are rendered from — one query, one number, agreeing by construction. Never
 * from that seeded column, which is still there and still means nothing.
 */
export function productSchema(product: Product, siteUrl: string, reviews?: { average: number; count: number }) {
  const price = product.salePrice ?? product.price;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    ...(product.barcode ? { gtin: product.barcode } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    image: product.images.map((image) => image.src),
    offers: {
      "@type": "Offer",
      url: new URL(`/products/${product.slug}`, siteUrl).toString(),
      priceCurrency: price.currencyCode,
      // The price a shopper actually pays, so the markup agrees with the page. Emitting
      // the list price while the page shows a sale price is a mismatch Merchant Center
      // rejects, and it is the number the struck-through one is struck through FOR.
      price: price.amount,
      itemCondition: "https://schema.org/NewCondition",
      availability: product.availableForSale
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    ...(reviews && reviews.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviews.average,
            reviewCount: reviews.count,
          },
        }
      : {}),
  };
}

/**
 * The products a listing page shows, in the order it shows them.
 *
 * Google uses `ItemList` on a category page to understand it as a collection of specific
 * products rather than as a page of prose that happens to mention them, and it is a
 * prerequisite for the carousel treatments that category pages can earn. It is only
 * honest — and only valid — now that those products are actually in the page's HTML; while
 * the grid was client-rendered this markup would have described items no crawler could see.
 *
 * Deliberately URL-only per item rather than a nested Product for each. A summary of 8
 * products would repeat price and availability that the product pages state authoritatively,
 * giving two places for them to disagree.
 */
export function productListSchema(
  products: { slug: string; name: string }[],
  siteUrl: string,
  listName: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.name,
      url: new URL(`/products/${product.slug}`, siteUrl).toString(),
    })),
  };
}

/**
 * FAQ markup for a category or collection.
 *
 * Emitted ONLY when the same questions are rendered on the page — the admin field feeds
 * both, from one source, so they cannot drift. Structured data describing answers a visitor
 * cannot read is the violation `aggregateRating` was removed for.
 */
export function faqSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
