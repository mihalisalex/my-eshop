import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { productInclude, toProduct } from "@/lib/commerce/postgres/mappers";
import { getCategorySubtreeIds } from "@/services/categories";
import type { SearchFacet, SearchOptions, SearchResult } from "@/lib/commerce/types";

/**
 * Storefront search, executed in Postgres.
 *
 * It used to run in the BROWSER: the listing page fetched every product in scope over
 * `/api/products` — 200 KB for /women, 323 KB unfiltered — and then filtered, sorted,
 * faceted and paginated that array in JavaScript. The 8-per-page UI was therefore
 * cosmetic; the shopper had already downloaded the whole catalog before the first card
 * appeared, and again on every filter change. A second request fetched 500 more products
 * purely to find the minimum and maximum price for the slider.
 *
 * Everything now happens in one round trip that returns one page of products, the facet
 * counts and the price bounds together.
 *
 * The heavy lifting is raw SQL rather than the query builder for one reason: every price
 * rule in this shop operates on the EFFECTIVE price — `COALESCE(salePrice, price)` — and
 * Prisma cannot express an expression like that in `where` or `orderBy`. Sorting by
 * `salePriceAmount` alone would put every full-price product in the wrong place. Every
 * value is still parameterised through `Prisma.sql`, so nothing is interpolated by hand.
 */

const EFFECTIVE_PRICE = Prisma.sql`COALESCE(p."salePriceAmount", p."priceAmount")`;

/** A size a shopper can actually buy: both signals agree, since imported data can disagree. */
const HAS_BUYABLE_SIZE = Prisma.sql`
  EXISTS (SELECT 1 FROM product_sizes s WHERE s."productId" = p.id AND s.quantity > 0 AND s."inStock" = true)
`;

interface ScopeInput {
  categoryIds?: string[];
  gender?: string;
  includeUnisex?: boolean;
  collectionId?: string;
  isNew?: boolean;
  isSale?: boolean;
  query?: string;
}

/**
 * The WHERE that defines "which slice of the catalog are we browsing" — the gender or
 * category page, a collection, new-in, sale, plus any text query. Facets are counted over
 * this, NOT over the refined set, so the counts describe what is available here rather
 * than what survives the shopper's own filters.
 */
function scopeWhere(scope: ScopeInput): Prisma.Sql {
  const clauses: Prisma.Sql[] = [Prisma.sql`p.status = 'active'`];

  if (scope.categoryIds) {
    // An unknown slug resolves to an empty list, which must match nothing rather than
    // everything — `IN ()` is invalid SQL, so it becomes an explicit false.
    clauses.push(
      scope.categoryIds.length > 0
        ? Prisma.sql`p."categoryId" IN (${Prisma.join(scope.categoryIds)})`
        : Prisma.sql`false`
    );
  }
  if (scope.gender) {
    // Unisex items are shoppable from both gendered sections — otherwise browsing /women
    // never surfaces them.
    clauses.push(
      scope.includeUnisex
        ? Prisma.sql`p.gender IN (${scope.gender}, 'unisex')`
        : Prisma.sql`p.gender = ${scope.gender}`
    );
  }
  if (scope.collectionId) {
    clauses.push(
      Prisma.sql`EXISTS (SELECT 1 FROM product_collections pc WHERE pc."productId" = p.id AND pc."collectionId" = ${scope.collectionId})`
    );
  }
  if (scope.isNew) clauses.push(Prisma.sql`p."isNew" = true`);
  if (scope.isSale) clauses.push(Prisma.sql`p."isSale" = true`);

  if (scope.query) {
    const like = `%${scope.query}%`;
    clauses.push(Prisma.sql`(
      p.name ILIKE ${like}
      OR p.description ILIKE ${like}
      OR p.sku ILIKE ${like}
      OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE ${like})
      OR EXISTS (SELECT 1 FROM product_colors c WHERE c."productId" = p.id AND c.name ILIKE ${like})
      OR EXISTS (SELECT 1 FROM product_sizes s WHERE s."productId" = p.id AND (s.name ILIKE ${like} OR s.sku ILIKE ${like}))
    )`);
  }

  return Prisma.join(clauses, " AND ");
}

/** The shopper's own facet selections, applied on top of the scope. */
function refinementWhere(options: SearchOptions): Prisma.Sql[] {
  const clauses: Prisma.Sql[] = [];

  if (options.genders?.length) {
    clauses.push(Prisma.sql`p.gender IN (${Prisma.join(options.genders)})`);
  }
  if (options.colors?.length) {
    clauses.push(
      Prisma.sql`EXISTS (SELECT 1 FROM product_colors c WHERE c."productId" = p.id AND c.name IN (${Prisma.join(options.colors)}))`
    );
  }
  if (options.sizes?.length) {
    clauses.push(
      Prisma.sql`EXISTS (SELECT 1 FROM product_sizes s WHERE s."productId" = p.id AND s.name IN (${Prisma.join(options.sizes)}))`
    );
  }
  if (options.tags?.length) {
    clauses.push(Prisma.sql`p.tags && ARRAY[${Prisma.join(options.tags)}]::text[]`);
  }
  if (options.availability === "in-stock") {
    clauses.push(Prisma.sql`p."availableForSale" = true AND ${HAS_BUYABLE_SIZE}`);
  }
  if (typeof options.minPrice === "number") {
    clauses.push(Prisma.sql`${EFFECTIVE_PRICE} >= ${options.minPrice}`);
  }
  if (typeof options.maxPrice === "number") {
    clauses.push(Prisma.sql`${EFFECTIVE_PRICE} <= ${options.maxPrice}`);
  }

  return clauses;
}

function orderBy(sort: SearchOptions["sort"]): Prisma.Sql {
  switch (sort) {
    case "price-asc":
      return Prisma.sql`${EFFECTIVE_PRICE} ASC, p.id ASC`;
    case "price-desc":
      return Prisma.sql`${EFFECTIVE_PRICE} DESC, p.id ASC`;
    case "newest":
      return Prisma.sql`p."createdAt" DESC, p.id ASC`;
    default:
      // `p.id` is the tiebreaker on every branch. Without a total order, two products
      // with the same price can swap between pages and one of them is never seen.
      return Prisma.sql`p."createdAt" ASC, p.id ASC`;
  }
}

/**
 * Facet counts and price bounds for the scoped set, in one pass each.
 *
 * Counted over the SCOPE rather than the refined results, so selecting "black" does not
 * collapse every other colour's count to zero and strand the shopper with no way back.
 */
async function buildFacetsAndBounds(scope: Prisma.Sql): Promise<{ facets: SearchFacet[]; bounds: [number, number] }> {
  type Row = { value: string; count: bigint };

  const [categories, genders, colors, sizes, tags, bounds] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT c.slug AS value, COUNT(*)::bigint AS count
      FROM products p JOIN categories c ON c.id = p."categoryId"
      WHERE ${scope} GROUP BY c.slug ORDER BY count DESC`,
    prisma.$queryRaw<Row[]>`
      SELECT p.gender AS value, COUNT(*)::bigint AS count
      FROM products p WHERE ${scope} GROUP BY p.gender ORDER BY count DESC`,
    prisma.$queryRaw<Row[]>`
      SELECT v.name AS value, COUNT(DISTINCT p.id)::bigint AS count
      FROM products p JOIN product_colors v ON v."productId" = p.id
      WHERE ${scope} GROUP BY v.name ORDER BY count DESC`,
    prisma.$queryRaw<Row[]>`
      SELECT v.name AS value, COUNT(DISTINCT p.id)::bigint AS count
      FROM products p JOIN product_sizes v ON v."productId" = p.id
      WHERE ${scope} GROUP BY v.name`,
    prisma.$queryRaw<Row[]>`
      SELECT t AS value, COUNT(*)::bigint AS count
      FROM products p, unnest(p.tags) t WHERE ${scope} GROUP BY t ORDER BY count DESC`,
    prisma.$queryRaw<{ min: number | null; max: number | null }[]>`
      SELECT MIN(${EFFECTIVE_PRICE})::float AS min, MAX(${EFFECTIVE_PRICE})::float AS max
      FROM products p WHERE ${scope}`,
  ]);

  const toValues = (rows: Row[]) => rows.map((row) => ({ value: row.value, count: Number(row.count) }));

  // Shoe sizes are numeric strings, so ordering them by count or insertion gives
  // "40, 41, 36, 37" — sorted numerically where every value is a number, alphabetically
  // otherwise so a future lettered scale still lands somewhere sensible.
  const sizeValues = toValues(sizes);
  const allNumeric = sizeValues.every((entry) => Number.isFinite(Number(entry.value)));
  sizeValues.sort((a, b) =>
    allNumeric ? Number(a.value) - Number(b.value) : a.value.localeCompare(b.value)
  );

  return {
    facets: [
      { key: "category", label: "Category", values: toValues(categories) },
      { key: "gender", label: "Gender", values: toValues(genders) },
      { key: "color", label: "Color", values: toValues(colors) },
      { key: "size", label: "Size", values: sizeValues },
      { key: "tag", label: "Tags", values: toValues(tags) },
    ],
    bounds: [bounds[0]?.min ?? 0, bounds[0]?.max ?? 0],
  };
}

export interface ServerSearchResult extends SearchResult {
  /** Min/max effective price across the scope — replaces the PLP's separate 500-product fetch. */
  priceBounds: [number, number];
}

export async function searchProducts(query: string, options: SearchOptions = {}): Promise<ServerSearchResult> {
  const trimmed = query.trim();
  const categoryIds = options.category ? await getCategorySubtreeIds(options.category) : undefined;

  const scope = scopeWhere({
    categoryIds,
    gender: options.gender,
    includeUnisex: Boolean(options.gender),
    collectionId: options.collectionId,
    isNew: options.isNew,
    isSale: options.isSale,
    query: trimmed || undefined,
  });

  const refinements = refinementWhere(options);
  const where = refinements.length > 0 ? Prisma.join([scope, ...refinements], " AND ") : scope;

  const pageSize = options.pageSize ?? options.limit ?? 24;
  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * pageSize;

  const [countRows, idRows, facetData] = await Promise.all([
    prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*)::bigint AS total FROM products p WHERE ${where}`,
    prisma.$queryRaw<{ id: string }[]>`
      SELECT p.id FROM products p WHERE ${where}
      ORDER BY ${orderBy(options.sort)}
      LIMIT ${pageSize} OFFSET ${offset}`,
    buildFacetsAndBounds(scope),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const ids = idRows.map((row) => row.id);

  // Hydrated through Prisma so the rows go through the same `toProduct` mapper as
  // everywhere else — the raw query decides WHICH products, never what one looks like.
  const rows = ids.length
    ? await prisma.product.findMany({ where: { id: { in: ids } }, include: productInclude })
    : [];
  const byId = new Map(rows.map((row) => [row.id, toProduct(row)]));
  const products = ids.map((id) => byId.get(id)!).filter(Boolean);

  return { query: trimmed, products, total, facets: facetData.facets, page, pageSize, priceBounds: facetData.bounds };
}

/** Name-only suggestions for the header overlay. */
export async function searchSuggestions(query: string, limit = 5): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const like = `%${trimmed}%`;
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    SELECT DISTINCT p.name FROM products p
    WHERE p.status = 'active' AND (p.name ILIKE ${like} OR p.sku ILIKE ${like})
    ORDER BY p.name LIMIT ${limit}`;
  return rows.map((row) => row.name);
}
