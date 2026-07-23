import type { Metadata } from "next";
import type { BreadcrumbItem, FaqItem, Product, SiteSeoDefaults } from "@/types";

interface PageMetadataInput {
  seo: SiteSeoDefaults;
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}

/** Builds a Next.js Metadata object from site-wide SEO defaults plus per-page overrides. */
export function buildMetadata({
  seo,
  title,
  description,
  path = "/",
  image,
  noIndex = false,
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
      locale: "en_US",
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
    potentialAction: {
      "@type": "SearchAction",
      target: `${seo.siteUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
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
