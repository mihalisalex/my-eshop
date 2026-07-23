import type { CallToAction, Image, SlugEntity } from "./common";
import type { HomepageSection } from "./homepage";

export interface AboutPageContent {
  title: string;
  heroImage: Image;
  intro: string;
  sections: { heading: string; body: string; image?: Image }[];
}

/** Shared shape for lightweight editorial/legal pages — heading+body sections, no hero image. */
export interface SimpleContentPage {
  title: string;
  intro?: string;
  updatedAt?: string;
  sections: { heading: string; body: string }[];
}

export interface LegalPage extends SlugEntity {
  title: string;
  updatedAt: string;
  sections: { heading: string; body: string }[];
}

export interface FaqPageContent {
  intro?: string;
  categories: {
    title: string;
    questions: { question: string; answer: string }[];
  }[];
}

export interface SizeGuideContent {
  intro: string;
  categories: {
    title: string;
    note?: string;
    headers: string[];
    rows: string[][];
  }[];
}

export interface Campaign extends SlugEntity {
  title: string;
  subtitle?: string;
  heroImage: Image;
  description: string;
  cta?: CallToAction;
  productIds?: string[];
  startsAt?: string;
  endsAt?: string;
}

export interface Lookbook extends SlugEntity {
  title: string;
  season: string;
  coverImage: Image;
  images: Image[];
  productIds?: string[];
}

/**
 * A landing page is literally "a HomepageConfig-shaped list of sections at an
 * arbitrary slug" — it's rendered by the exact same `SectionRenderer` the
 * homepage uses, so a new landing page never needs new section components.
 */
export interface LandingPage extends SlugEntity {
  title: string;
  sections: HomepageSection[];
}
