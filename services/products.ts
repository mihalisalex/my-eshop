import "server-only";
import { prisma } from "@/lib/prisma";
import type { Product } from "@/types";
import { productInclude, toProduct } from "@/lib/commerce/postgres/mappers";

/**
 * This module is the seam between components and the data source — now
 * backed by Postgres instead of data/products.json. Every exported function
 * signature/shape is unchanged from the JSON-backed version, so every
 * existing caller (admin pages, storefront Server Components, the mock
 * CommerceProvider) keeps working without changes.
 */

export async function getAllProducts(): Promise<Product[]> {
  const rows = await prisma.product.findMany({ include: productInclude, orderBy: { createdAt: "asc" } });
  return rows.map(toProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const row = await prisma.product.findUnique({ where: { slug }, include: productInclude });
  return row ? toProduct(row) : undefined;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const row = await prisma.product.findUnique({ where: { id }, include: productInclude });
  return row ? toProduct(row) : undefined;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, include: productInclude });
  const byId = new Map(rows.map((row) => [row.id, toProduct(row)]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const rows = await prisma.product.findMany({ where: { category }, include: productInclude });
  return rows.map(toProduct);
}

export async function getSaleProducts(): Promise<Product[]> {
  const rows = await prisma.product.findMany({ where: { isSale: true }, include: productInclude });
  return rows.map(toProduct);
}

export async function getNewProducts(): Promise<Product[]> {
  const rows = await prisma.product.findMany({ where: { isNew: true }, include: productInclude });
  return rows.map(toProduct);
}

/** Explicit `relatedProductIds` win; falls back to same-category products otherwise. */
export async function getRelatedProducts(productId: string, limit = 4): Promise<Product[]> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return [];

  if (product.relatedProductIds.length > 0) {
    const related = await getProductsByIds(product.relatedProductIds);
    if (related.length > 0) return related.slice(0, limit);
  }

  const rows = await prisma.product.findMany({
    where: { category: product.category, id: { not: productId } },
    include: productInclude,
    take: limit,
  });
  return rows.map(toProduct);
}
