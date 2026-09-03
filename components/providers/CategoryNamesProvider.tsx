"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The localised category name behind every category slug, for the many client components
 * that only ever receive a `Product` — whose `category` field is deliberately kept as a
 * bare slug (see types/product.ts) rather than the full `Category` row.
 *
 * A product listing page already resolves its own category once and can pass the real name
 * down directly. This exists for the places that cannot: a card in a mixed grid (search
 * results, "You may also like", recently viewed, a shared wishlist) shows products from
 * many categories at once, and threading a per-product name through nine different call
 * sites — several of them client components with no server-side category fetch of their
 * own — was the "larger, separate change" flagged when this bug was first found on
 * QuickViewDialog's eyebrow.
 *
 * Populated once, in the root layout, from the same `getAllCategories` + `localizeCategory`
 * every other category name on the site already goes through — so a product's eyebrow here
 * and its breadcrumb on its own page cannot say two different things about what it is.
 */
const CategoryNamesContext = createContext<Record<string, string> | null>(null);

export function CategoryNamesProvider({
  names,
  children,
}: {
  /** slug -> localised name. */
  names: Record<string, string>;
  children: ReactNode;
}) {
  return <CategoryNamesContext.Provider value={names}>{children}</CategoryNamesContext.Provider>;
}

/**
 * Falls back to the slug itself — never blank, and never a thrown error — when the map
 * has nothing for it (the provider is missing, or the category was deleted after the
 * product was indexed). A card that reads "gynaikeia-loafers" for a moment is a smaller
 * failure than one that renders nothing or crashes the grid it sits in.
 */
export function useCategoryName(slug: string): string {
  const names = useContext(CategoryNamesContext);
  return names?.[slug] ?? slug;
}
