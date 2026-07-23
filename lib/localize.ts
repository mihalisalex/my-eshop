import type { Product } from "@/types/product";
import type { Collection } from "@/types/collection";
import type { Locale } from "@/i18n/config";

/**
 * Swaps in the Greek `nameEl`/`descriptionEl` (etc.) fields when the current locale
 * is "el" and a translation exists, falling back to the canonical English field
 * otherwise — a product/collection not yet translated just renders in English rather
 * than showing blank. Applied at Server Component render time (PDP, homepage
 * sections) where `next-intl/server`'s `getLocale()` is available; the client-fetched
 * PLP (`/api/products`) is not localized this way — see PROGRESS.md.
 */
export function localizeProduct(product: Product, locale: Locale): Product {
  if (locale !== "el") return product;
  return {
    ...product,
    name: product.nameEl ?? product.name,
    description: product.descriptionEl ?? product.description,
  };
}

export function localizeProducts(products: Product[], locale: Locale): Product[] {
  return products.map((product) => localizeProduct(product, locale));
}

export function localizeCollection(collection: Collection, locale: Locale): Collection {
  if (locale !== "el") return collection;
  return {
    ...collection,
    title: collection.titleEl ?? collection.title,
    subtitle: collection.subtitleEl ?? collection.subtitle,
    description: collection.descriptionEl ?? collection.description,
  };
}

export function localizeCollections(collections: Collection[], locale: Locale): Collection[] {
  return collections.map((collection) => localizeCollection(collection, locale));
}
