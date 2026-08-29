import type { CallToAction, Image } from "./common";

/**
 * Every homepage block is a discriminated union member keyed by `type`.
 * The admin homepage editor and the renderer (`components/sections/SectionRenderer`)
 * both switch on `type`, so adding a new section later means: add a member here,
 * a case in the renderer, and an editor panel — nothing else changes.
 */

export type HomepageSectionType =
  | "hero"
  | "featuredCollections"
  | "bestSellers"
  | "editorialBanner"
  | "newArrivals"
  | "brandStory"
  | "socialGrid"
  | "newsletter";

interface SectionBase {
  id: string;
  type: HomepageSectionType;
  enabled: boolean;
  order: number;
}

export interface HeroSection extends SectionBase {
  type: "hero";
  data: {
    eyebrow?: string;
    headline: string;
    subheadline?: string;
    image: Image;
    primaryCta?: CallToAction;
    secondaryCta?: CallToAction;
  };
}

export interface FeaturedCollectionsSection extends SectionBase {
  type: "featuredCollections";
  data: {
    title: string;
    subtitle?: string;
    collectionIds: string[];
  };
}

export interface BestSellersSection extends SectionBase {
  type: "bestSellers";
  data: {
    title: string;
    subtitle?: string;
    productIds: string[];
    viewAllCta?: CallToAction;
  };
}

export interface EditorialBannerSection extends SectionBase {
  type: "editorialBanner";
  data: {
    eyebrow?: string;
    headline: string;
    body?: string;
    image: Image;
    cta?: CallToAction;
    imagePosition?: "left" | "right";
  };
}

/**
 * One carousel inside the new-arrivals section, scoped to a gender.
 *
 * Products are queried rather than pinned, which is the whole point: a hand-picked list
 * stops being "new" the day after it is written, and nobody remembers to rewrite it.
 */
export interface NewArrivalsRow {
  /** Matches `Product.gender`. Unisex products appear in every row. */
  gender: "women" | "men";
  /** Row heading, e.g. "Γυναικεία". */
  title: string;
  viewAllHref: string;
  viewAllLabel: string;
}

export interface NewArrivalsSection extends SectionBase {
  type: "newArrivals";
  data: {
    title: string;
    subtitle?: string;
    /**
     * A pinned list, and the original behaviour. Superseded by `rows` on the homepage but
     * still honoured, because landing pages share this section type and some of them do
     * want an exact, curated set of products.
     */
    productIds: string[];
    /** When present, replaces the pinned list with one queried carousel per gender. */
    rows?: NewArrivalsRow[];
    /** Products per row. */
    limit?: number;
  };
}

export interface BrandStorySection extends SectionBase {
  type: "brandStory";
  data: {
    eyebrow?: string;
    headline: string;
    body: string;
    cta?: CallToAction;
  };
}

export interface SocialGridSection extends SectionBase {
  type: "socialGrid";
  data: {
    title: string;
    handle?: string;
    images: Image[];
  };
}

export interface NewsletterSection extends SectionBase {
  type: "newsletter";
  data: {
    headline: string;
    subheadline?: string;
    ctaLabel: string;
  };
}

export type HomepageSection =
  | HeroSection
  | FeaturedCollectionsSection
  | BestSellersSection
  | EditorialBannerSection
  | NewArrivalsSection
  | BrandStorySection
  | SocialGridSection
  | NewsletterSection;

export interface HomepageConfig {
  sections: HomepageSection[];
}
