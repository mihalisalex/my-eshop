/**
 * Shared primitives used across the content layer. Keeping these generic
 * (rather than tied to any single backend) is what lets `services/` swap
 * a JSON file for WooCommerce/Shopify/Medusa without touching components.
 */

export interface Image {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  blurDataURL?: string;
}

export interface Money {
  amount: number;
  currencyCode: string;
}

export interface Link {
  label: string;
  href: string;
}

export interface CallToAction extends Link {
  variant?: "primary" | "secondary" | "ghost" | "link";
}

export interface SlugEntity {
  id: string;
  slug: string;
}

/** Generic wrapper mirroring a future paginated API response. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
