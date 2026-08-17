import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, resolvePage, toPaged, type Paged } from "@/lib/pagination";

/**
 * Inventory is read from `ProductSize` directly rather than by loading every product and
 * flattening its sizes in memory.
 *
 * The page used to call `getAllProducts({ includeUnpublished: true })` — every product,
 * with its images, colours, sizes and collections — purely to build a flat list of size
 * variants, then render all 1,050 of them in one table. That is a lot of markup and a lot
 * of JSON for a screen whose whole job is "which variants are running out", and it grows
 * with the catalog rather than with the screen.
 */

export const LOW_STOCK_THRESHOLD = 3;

export type StockFilter = "low" | "out" | "in";

export interface InventoryQuery {
  search?: string;
  stock?: StockFilter;
  page?: number;
  pageSize?: number;
}

export interface InventoryRow {
  key: string;
  productId: string;
  productName: string;
  sizeName: string;
  sku: string | null;
  quantity: number;
  inStock: boolean;
}

export interface InventorySummary {
  variants: number;
  products: number;
  low: number;
  out: number;
}

/** A variant counts as out of stock if either signal says so — the two can disagree in imported data. */
const OUT_OF_STOCK: Prisma.ProductSizeWhereInput = {
  OR: [{ quantity: { lte: 0 } }, { inStock: false }],
};
const IN_STOCK: Prisma.ProductSizeWhereInput = { quantity: { gt: 0 }, inStock: true };

const STOCK_WHERE: Record<StockFilter, Prisma.ProductSizeWhereInput> = {
  out: OUT_OF_STOCK,
  in: { ...IN_STOCK, quantity: { gt: LOW_STOCK_THRESHOLD } },
  low: { ...IN_STOCK, quantity: { gt: 0, lte: LOW_STOCK_THRESHOLD } },
};

function buildWhere(query: InventoryQuery): Prisma.ProductSizeWhereInput {
  const search = query.search?.trim();
  return {
    ...(query.stock ? STOCK_WHERE[query.stock] : {}),
    ...(search
      ? {
          OR: [
            { product: { name: { contains: search, mode: "insensitive" } } },
            { product: { sku: { contains: search, mode: "insensitive" } } },
            { sku: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listInventory(query: InventoryQuery = {}): Promise<Paged<InventoryRow>> {
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = buildWhere(query);

  const total = await prisma.productSize.count({ where });
  const { page, skip, take } = resolvePage(total, { page: query.page ?? 1, pageSize });

  const rows = await prisma.productSize.findMany({
    where,
    // Lowest stock first: the rows that need attention are the reason to open this page.
    orderBy: [{ quantity: "asc" }, { product: { name: "asc" } }, { position: "asc" }],
    skip,
    take,
    select: {
      id: true,
      name: true,
      quantity: true,
      inStock: true,
      sku: true,
      product: { select: { id: true, name: true, sku: true } },
    },
  });

  return toPaged(
    rows.map((row) => ({
      key: row.id,
      productId: row.product.id,
      productName: row.product.name,
      sizeName: row.name,
      sku: row.sku || row.product.sku,
      quantity: row.quantity,
      inStock: row.inStock,
    })),
    total,
    page,
    pageSize
  );
}

/** Totals for the header — deliberately over the WHOLE catalog, not the current page or filter. */
export async function getInventorySummary(): Promise<InventorySummary> {
  const [variants, products, low, out] = await Promise.all([
    prisma.productSize.count(),
    prisma.product.count(),
    prisma.productSize.count({ where: STOCK_WHERE.low }),
    prisma.productSize.count({ where: STOCK_WHERE.out }),
  ]);
  return { variants, products, low, out };
}
