import type { Metadata } from "next";
import type { BreadcrumbItem, FaqItem, Product, SiteSeoDefaults } from "@/types";
import { COMPANY } from "@/constants/company";

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
