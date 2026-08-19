import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Product, ProductStatus } from "@/types";
import { productInclude, toProduct } from "@/lib/commerce/postgres/mappers";
import { getCategorySubtreeIds } from "@/services/categories";
import { resolvePage, toPaged, type Paged } from "@/lib/pagination";

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

// ---------------------------------------------------------------------------
// Admin product list (QA-046)
// ---------------------------------------------------------------------------

/**
 * The admin products table used to receive every product and filter, sort and page in the
 * browser. Fine at 175 and quietly not fine later — and unlike the storefront it has no
 * publication filter to shrink the set, so it is the largest list the app sends anywhere.
 *
 * Raw SQL for the same reason services/search.ts uses it: two of the five sorts are on
 * expressions Prisma cannot put in `orderBy` — the EFFECTIVE price
 * `COALESCE(salePrice, price)`, and margin, which is derived from it. Sorting on
 * `salePriceAmount` alone puts every full-price product in the wrong place. Every value is
 * still parameterised through `Prisma.sql`.
 */
export const PRODUCT_SORT_KEYS = ["newest", "name", "price-asc", "price-desc", "margin"] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

const ADMIN_EFFECTIVE_PRICE = Prisma.sql`COALESCE(p."salePriceAmount", p."priceAmount")`;

export interface AdminProductFilter {
  search?: string;
  status?: ProductStatus;
  /** Category slug. Matches the whole subtree, like the storefront. */
  category?: string;
}

export interface AdminProductListOptions extends AdminProductFilter {
  sort?: ProductSortKey;
  page: number;
  pageSize: number;
}

async function adminProductWhere(filter: AdminProductFilter): Promise<Prisma.Sql> {
  // No publication clause at all — this is the one surface that must see every lifecycle state.
  const clauses: Prisma.Sql[] = [Prisma.sql`true`];

  if (filter.status) clauses.push(Prisma.sql`p.status = ${filter.status}`);

  if (filter.category) {
    const categoryIds = await getCategorySubtreeIds(filter.category);
    // An unknown slug matches nothing rather than everything — the same rule as the storefront.
    clauses.push(
      categoryIds.length > 0 ? Prisma.sql`p."categoryId" IN (${Prisma.join(categoryIds)})` : Prisma.sql`false`,
    );
  }

  if (filter.search) {
    // SKU and brand as well as name: merchandisers look products up by SKU constantly, and
    // dropping that when this moved server-side would have been a silent regression.
    const needle = `%${filter.search}%`;
    clauses.push(Prisma.sql`(p.name ILIKE ${needle} OR p.sku ILIKE ${needle} OR p.brand ILIKE ${needle})`);
  }

  return Prisma.join(clauses, " AND ");
}

function adminProductOrderBy(sort: ProductSortKey): Prisma.Sql {
  // Every sort ends in `p.id` as a tiebreaker. Without a total order, equal-valued rows can
  // swap between pages and one is never seen — the same bug the storefront listing had.
  switch (sort) {
    case "name":
      return Prisma.sql`p.name ASC, p.id ASC`;
    case "price-asc":
      return Prisma.sql`${ADMIN_EFFECTIVE_PRICE} ASC, p.id ASC`;
    case "price-desc":
      return Prisma.sql`${ADMIN_EFFECTIVE_PRICE} DESC, p.id ASC`;
    case "margin":
      // Products with no cost sort last rather than pretending to be 0% margin. NULLS LAST
      // is what makes that true in both directions; the client version relied on -Infinity.
      return Prisma.sql`
        CASE
          WHEN p."costPriceAmount" IS NULL THEN NULL
          WHEN ${ADMIN_EFFECTIVE_PRICE} = 0 THEN NULL
          ELSE (${ADMIN_EFFECTIVE_PRICE} - p."costPriceAmount") / ${ADMIN_EFFECTIVE_PRICE}
        END DESC NULLS LAST, p.id ASC
      `;
    default:
      return Prisma.sql`p."createdAt" DESC, p.id ASC`;
  }
}

/** One page of products for the admin table, plus the total the filter matches. */
export async function listProductsForAdmin(options: AdminProductListOptions): Promise<Paged<Product>> {
  const where = await adminProductWhere(options);
  const orderBy = adminProductOrderBy(options.sort ?? "newest");

  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`SELECT COUNT(*)::bigint AS count FROM products p WHERE ${where}`,
  );
  const total = Number(count);
  const { page, skip, take } = resolvePage(total, { page: options.page, pageSize: options.pageSize });

  const idRows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT p.id FROM products p WHERE ${where} ORDER BY ${orderBy} LIMIT ${take} OFFSET ${skip}`,
  );
  const ids = idRows.map((row) => row.id);
  if (ids.length === 0) return toPaged<Product>([], total, page, options.pageSize);

  // Ids first, then the full graph through the shared include — the relations (images,
  // colours, sizes, collections) are what make this row expensive, and joining them in raw
  // SQL would mean re-implementing the mapper.
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, include: productInclude });
  const byId = new Map(rows.map((row) => [row.id, toProduct(row)]));
  return toPaged<Product>(
    // Re-ordered to the SQL's order: `IN` does not preserve it.
    ids.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product)),
    total,
    page,
    options.pageSize,
  );
}

/**
 * Every product id a filter matches, ignoring paging.
 *
 * This is what makes "select all N matching" honest across pages. The alternative — shipping
 * every id to the browser with the page — is the same unbounded payload this finding is
 * about, just smaller. Instead the browser says "everything matching this filter" and the
 * server re-derives the set at the moment the action runs, so it also cannot act on a stale
 * selection from before someone else edited the catalog.
 */
export async function productIdsMatching(filter: AdminProductFilter): Promise<string[]> {
  const where = await adminProductWhere(filter);
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT p.id FROM products p WHERE ${where}`,
  );
  return rows.map((row) => row.id);
}
