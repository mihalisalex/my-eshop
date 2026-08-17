import type { Metadata } from "next";
import type { BreadcrumbItem, FaqItem, Product, SiteSeoDefaults } from "@/types";

interface PageMetadataInput {
  seo: SiteSeoDefaults;
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
  /** Defaults "en" — most call sites don't yet thread the request locale through; pass it explicitly where available (see app/products/[slug]/page.tsx). */
  locale?: "en" | "el";
}

const OG_LOCALE: Record<"en" | "el", string> = { en: "en_US", el: "el_GR" };

/** Builds a Next.js Metadata object from site-wide SEO defaults plus per-page overrides. */
export function buildMetadata({
  seo,
  title,
  description,
  path = "/",
  image,
  noIndex = false,
  locale = "en",
}: PageMetadataInput): Metadata {
  const url = new URL(path, seo.siteUrl).toString();
  const resolvedTitle = title ?? seo.defaultTitle;
  const resolvedDescription = description ?? seo.defaultDescription;
  const resolvedImage = image ?? seo.defaultOgImage;

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      url,
      siteName: seo.organization.name,
      images: [{ url: resolvedImage, width: 1200, height: 630, alt: resolvedTitle }],
      locale: OG_LOCALE[locale],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
      images: [resolvedImage],
      creator: seo.twitterHandle,
    },
  };
}

export function organizationSchema(seo: SiteSeoDefaults) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: seo.organization.name,
    url: seo.siteUrl,
    logo: seo.organization.logo,
    sameAs: seo.organization.sameAs,
  };
}

export function websiteSchema(seo: SiteSeoDefaults) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: seo.organization.name,
    url: seo.siteUrl,
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

/** Ready for product detail pages once they exist — not yet rendered anywhere. */
export function productSchema(product: Product, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: product.images.map((image) => image.src),
    offers: {
      "@type": "Offer",
      url: new URL(`/products/${product.slug}`, siteUrl).toString(),
      priceCurrency: product.price.currencyCode,
      price: product.price.amount,
      availability: product.availableForSale
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    ...(product.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount ?? 0,
          },
        }
      : {}),
  };
}

/** Ready for an FAQ page once one exists — not yet rendered anywhere. */
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
