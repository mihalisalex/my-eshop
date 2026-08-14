import "server-only";
import { prisma } from "@/lib/prisma";
import type { Product, ProductStatus } from "@/types";
import { productInclude, toProduct } from "@/lib/commerce/postgres/mappers";
import { getCategorySubtreeIds } from "@/services/categories";

/**
 * This module is the seam between components and the data source — now
 * backed by Postgres instead of data/products.json. Every exported function
 * signature/shape is unchanged from the JSON-backed version, so every
 * existing caller (admin pages, storefront Server Components, the mock
 * CommerceProvider) keeps working without changes.
 */

/**
 * The one place publication is enforced. Spread into every storefront-facing query so
 * drafts and archived products can never reach a customer.
 */
const PUBLISHED = { status: "active" } as const;

export interface ProductListFilter {
  category?: string;
  gender?: string;
  /** When true and `gender` is set, also include unisex products — mirrors the storefront's "unisex items show on both gendered sections" rule. */
  includeUnisex?: boolean;
  collectionId?: string;
  tag?: string;
  isNew?: boolean;
  isSale?: boolean;
  /**
   * ADMIN ONLY — includes drafts and archived products. Deliberately opt-in rather than
   * opt-out: the default has to be the safe one, so a call site that forgets to think
   * about publication hides too much (a visible, reportable bug) instead of leaking
   * unfinished or retired products onto the storefront (a silent, embarrassing one).
   */
  includeUnpublished?: boolean;
  /** ADMIN ONLY — narrows to one lifecycle state. Ignored unless includeUnpublished is set. */
  status?: ProductStatus;
}

/**
 * Filters are applied in the query itself, not fetched-then-filtered in JS —
 * category/gender pages used to pull every product in the store on every
 * request just to throw most of it away client-side. Omit `filter` (or any
 * field on it) to keep the old "everything" behavior.
 *
 * `category` matches the whole subtree, not just an exact slug: with a real hierarchy,
 * browsing "Sneakers" has to include everything filed under "Sneakers > Running", the way
 * every other commerce platform behaves. An exact match meant that nesting a category —
 * the entire point of the hierarchy — silently hid its products from the parent page,
 * which is the most likely place a customer looks for them.
 */
export async function getAllProducts(filter?: ProductListFilter): Promise<Product[]> {
  // An unknown slug resolves to [], which correctly matches nothing rather than everything.
  const categoryIds = filter?.category ? await getCategorySubtreeIds(filter.category) : undefined;

  const rows = await prisma.product.findMany({
    where: {
      ...(filter?.includeUnpublished ? (filter.status ? { status: filter.status } : {}) : PUBLISHED),
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...(filter?.gender
        ? { gender: filter.includeUnisex ? { in: [filter.gender, "unisex"] } : filter.gender }
        : {}),
      ...(filter?.collectionId ? { collections: { some: { collectionId: filter.collectionId } } } : {}),
      ...(filter?.tag ? { tags: { has: filter.tag } } : {}),
      ...(filter?.isNew ? { isNew: true } : {}),
      ...(filter?.isSale ? { isSale: true } : {}),
    },
    include: productInclude,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toProduct);
}

/**
 * Storefront lookup (PDP, /api/products?slug=) — published only, so a draft or archived
 * product 404s for customers. The admin reaches products by id, not slug, which is why
 * the publication split lands cleanly on these two functions.
 */
export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const row = await prisma.product.findFirst({ where: { slug, ...PUBLISHED }, include: productInclude });
  return row ? toProduct(row) : undefined;
}

/** ADMIN lookup — intentionally unfiltered, so drafts and archived products remain editable. */
export async function getProductById(id: string): Promise<Product | undefined> {
  const row = await prisma.product.findUnique({ where: { id }, include: productInclude });
  return row ? toProduct(row) : undefined;
}

/**
 * Resolves ids REGARDLESS of publication state, on purpose. This backs carts, wishlists,
 * recently-viewed and shared wishlists — records a customer already created. Filtering
 * here would make a line item they added yesterday vanish from their cart because someone
 * archived the product this morning, which looks like data loss and breaks checkout
 * rendering. Purchasability is enforced separately at checkout.
 *
 * For merchandising surfaces that pick products by id (homepage sections, campaigns,
 * lookbooks) use `getPublishedProductsByIds` instead — there, a retired product should
 * simply disappear.
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, include: productInclude });
  const byId = new Map(rows.map((row) => [row.id, toProduct(row)]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
}

/** Same as `getProductsByIds` but published-only — for curated storefront placements. */
export async function getPublishedProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { id: { in: ids }, ...PUBLISHED },
    include: productInclude,
  });
  const byId = new Map(rows.map((row) => [row.id, toProduct(row)]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
}

/** Explicit `relatedProductIds` win; falls back to same-category products otherwise. Storefront-only, so published-only throughout. */
export async function getRelatedProducts(productId: string, limit = 4): Promise<Product[]> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return [];

  if (product.relatedProductIds.length > 0) {
    const related = await getPublishedProductsByIds(product.relatedProductIds);
    if (related.length > 0) return related.slice(0, limit);
  }

  const rows = await prisma.product.findMany({
    where: { categoryId: product.categoryId, id: { not: productId }, ...PUBLISHED },
    include: productInclude,
    take: limit,
  });
  return rows.map(toProduct);
}
