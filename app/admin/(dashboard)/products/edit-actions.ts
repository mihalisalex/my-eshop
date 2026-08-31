"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { capabilityDenied } from "@/lib/admin-session";
import { productStatusSchema } from "@/lib/validation/product";
import { productIdsMatching } from "@/services/products";
import type { BulkProductScope, ProductActionState } from "@/app/admin/(dashboard)/products/actions";

/**
 * Inline and bulk price / stock editing.
 *
 * The two things a shop owner changes most often are a price and a stock count, and both
 * used to require opening the full product form, changing one number among forty fields,
 * and saving the whole record back. At 175 products a seasonal reprice was a day's work,
 * and every save carried the whole row — which is exactly the write pattern that made
 * stock overwrites possible (see lib/products-import/write.ts). Everything here writes one
 * column and nothing else.
 *
 * Kept out of actions.ts so that file stays about a product's lifecycle — create, update,
 * duplicate, archive, delete — rather than growing a second, differently-shaped API.
 */

/** Resolves a bulk scope to concrete ids, server-side in both cases — never from the browser's word. */
async function idsForScope(scope: BulkProductScope): Promise<string[]> {
  return scope.kind === "ids" ? scope.ids : await productIdsMatching(scope.filter);
}

const inlineEditSchema = z
  .object({
    price: z.number().positive("Price must be greater than 0.").optional(),
    // `null` clears the sale price; absent leaves it alone. Those are different
    // instructions and the caller has to be able to express both.
    salePrice: z.number().positive("Sale price must be greater than 0.").nullable().optional(),
    status: productStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to change." });

export type InlineProductEdit = z.infer<typeof inlineEditSchema>;

/**
 * Writes one row's price, sale price or status without touching anything else.
 *
 * The current values are read back before validating, because "is the sale price below the
 * price" is a question about the row as it will END UP, not about whichever fields happen
 * to be in this request — editing only the price of a product that already has a sale price
 * can invert the pair just as easily as editing the sale price can.
 */
export async function updateProductInline(id: string, edit: InlineProductEdit): Promise<ProductActionState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };

  const parsed = inlineEditSchema.safeParse(edit);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const current = await prisma.product.findUnique({
    where: { id },
    select: { priceAmount: true, salePriceAmount: true, status: true },
  });
  if (!current) return { error: "That product no longer exists." };

  const nextPrice = parsed.data.price ?? Number(current.priceAmount);
  const nextSalePrice =
    parsed.data.salePrice !== undefined
      ? parsed.data.salePrice
      : current.salePriceAmount === null
        ? null
        : Number(current.salePriceAmount);

  if (nextSalePrice !== null && nextSalePrice >= nextPrice) {
    // A sale price at or above the list price is not a sale — and because the storefront
    // sells at `salePrice ?? price`, saving one would quietly RAISE what customers pay
    // while the card still advertises the item as reduced.
    return { error: "The sale price has to be lower than the price." };
  }

  await prisma.product.update({
    where: { id },
    data: {
      ...(parsed.data.price !== undefined ? { priceAmount: parsed.data.price } : {}),
      ...(parsed.data.salePrice !== undefined
        ? {
            salePriceAmount: parsed.data.salePrice,
            // `isSale` is the badge the storefront reads, so it follows the sale price
            // rather than being a second fact someone has to remember to update.
            isSale: parsed.data.salePrice !== null,
          }
        : {}),
      ...(parsed.data.status !== undefined
        ? {
            status: parsed.data.status,
            // Mirrors archiveProduct/restoreProduct, so the archive date means the same
            // thing however a product got there — and re-archiving keeps the original.
            ...(parsed.data.status === "archived"
              ? current.status === "archived"
                ? {}
                : { archivedAt: new Date() }
              : { archivedAt: null }),
          }
        : {}),
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
  return {};
}

export type BulkPriceMode = "set" | "adjust-amount" | "adjust-percent" | "clear";

export interface BulkPriceInput {
  target: "price" | "salePrice";
  mode: BulkPriceMode;
  /** Signed for the adjust modes: -10 means "10 lower", or "10% off". Ignored when clearing. */
  value: number;
}

export interface BulkPriceState {
  error?: string;
  updated?: number;
  /** Rows left with a sale price at or above their price. Reported, never silently fixed. */
  inverted?: number;
}

const bulkPriceSchema = z.object({
  target: z.enum(["price", "salePrice"]),
  mode: z.enum(["set", "adjust-amount", "adjust-percent", "clear"]),
  value: z.number().finite(),
});

/**
 * Repricing, as one SQL statement rather than a read-modify-write loop.
 *
 * The arithmetic runs in Postgres against the `Decimal(10,2)` columns, so it is exact — the
 * same rows adjusted by 10% in JavaScript would round through binary floating point once
 * per row. It is also atomic: a bulk reprice applies to the whole set or to none of it,
 * rather than leaving the catalogue half-repriced if it fails partway through.
 *
 * Every result is floored at 0.01. A price of zero is never what "reduce by 20%" was meant
 * to produce, and the storefront would sell at it.
 */
export async function bulkUpdatePrices(input: BulkPriceInput, scope: BulkProductScope): Promise<BulkPriceState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };

  const parsed = bulkPriceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { target, mode, value } = parsed.data;

  if (mode === "clear" && target === "price") {
    return { error: "A product has to have a price — clearing only applies to the sale price." };
  }
  if (mode === "set" && value <= 0) return { error: "Price must be greater than 0." };
  if (mode === "adjust-percent" && value <= -100) return { error: "That would take every price to zero or below." };
  if (mode !== "clear" && value === 0) return { error: "Enter an amount to change prices by." };

  const ids = await idsForScope(scope);
  if (ids.length === 0) return { error: "Select at least one product." };

  const column = target === "price" ? Prisma.sql`"priceAmount"` : Prisma.sql`"salePriceAmount"`;
  const idList = Prisma.join(ids);

  let updated: number;
  if (mode === "clear") {
    updated = await prisma.$executeRaw`
      UPDATE "products" SET "salePriceAmount" = NULL, "isSale" = false WHERE "id" IN (${idList})`;
  } else {
    const expression =
      mode === "set"
        ? Prisma.sql`${value}::numeric`
        : mode === "adjust-amount"
          ? Prisma.sql`${column} + ${value}::numeric`
          : Prisma.sql`${column} * (1 + ${value}::numeric / 100)`;

    /**
     * The adjust modes skip rows with no sale price. There is nothing to raise or lower on
     * a product that is not on sale, and treating NULL as zero would put every full-price
     * product onto a sale nobody asked for.
     */
    const nullGuard =
      target === "salePrice" && mode !== "set" ? Prisma.sql`AND "salePriceAmount" IS NOT NULL` : Prisma.empty;

    updated = await prisma.$executeRaw`
      UPDATE "products"
      SET ${column} = GREATEST(ROUND(${expression}, 2), 0.01)
      WHERE "id" IN (${idList}) ${nullGuard}`;

    if (target === "salePrice" && mode === "set") {
      await prisma.$executeRaw`UPDATE "products" SET "isSale" = true WHERE "id" IN (${idList})`;
    }
  }

  /**
   * Surfaced rather than corrected. Lowering a list price can strand an existing sale price
   * above it, and the honest response is to say how many rows need a human — quietly
   * rewriting a number the owner did not ask about is how a bulk tool stops being trusted.
   */
  const invertedRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "products"
    WHERE "id" IN (${idList}) AND "salePriceAmount" IS NOT NULL AND "salePriceAmount" >= "priceAmount"`;
  const inverted = Number(invertedRows[0]?.count ?? 0);

  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
  return { updated, ...(inverted > 0 ? { inverted } : {}) };
}

export interface BulkStockInput {
  mode: "set" | "adjust";
  /** Signed for `adjust`: -2 takes two off every size. */
  value: number;
}

export interface BulkStockState {
  error?: string;
  updated?: number;
}

const bulkStockSchema = z.object({
  mode: z.enum(["set", "adjust"]),
  value: z.number().int("Stock has to be a whole number.").finite(),
});

/**
 * Sets or adjusts stock across every size of the selected products.
 *
 * Product-level rather than per-size on purpose: this is the "the delivery arrived, put
 * five of everything out" action. Anything finer belongs on the Inventory screen, which
 * already works a size at a time.
 *
 * `inStock` is written from the resulting quantity rather than left alone, because the
 * storefront reads both signals and imported rows are known to disagree on them (see
 * services/inventory.ts). Having just been told what the stock is, the two should agree.
 *
 * Floored at zero, which the database also enforces — see the CHECK constraint on
 * product_sizes added alongside the checkout race fix.
 */
export async function bulkUpdateStock(input: BulkStockInput, scope: BulkProductScope): Promise<BulkStockState> {
  const denied = await capabilityDenied("catalog:edit");
  if (denied) return { error: denied };

  const parsed = bulkStockSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { mode, value } = parsed.data;
  if (mode === "set" && value < 0) return { error: "Stock can't be negative." };
  if (mode === "adjust" && value === 0) return { error: "Enter an amount to change stock by." };

  const ids = await idsForScope(scope);
  if (ids.length === 0) return { error: "Select at least one product." };

  const idList = Prisma.join(ids);
  const nextQuantity = mode === "set" ? Prisma.sql`${value}` : Prisma.sql`GREATEST("quantity" + ${value}, 0)`;

  const updated = await prisma.$executeRaw`
    UPDATE "product_sizes"
    SET "quantity" = ${nextQuantity}, "inStock" = (${nextQuantity} > 0)
    WHERE "productId" IN (${idList})`;

  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  return { updated };
}
