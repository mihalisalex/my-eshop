import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Putting units back on the shelf, shared by the two paths that can do it: an order moving
 * to cancelled/refunded (services/orders.ts) and a return being received (services/returns.ts).
 *
 * They are separate paths with separate once-only claims, and they overlap: a return covers a
 * SUBSET of an order's lines, so an order that is later refunded would credit lines a return
 * has already credited. Each path therefore subtracts what the other has done —
 * `quantitiesCreditedByReturns` is what makes that possible. Getting this wrong invents stock
 * that never existed, which is worse than the original bug: unsellable stock is visible the
 * moment a customer tries to buy, whereas phantom stock is only discovered when an order
 * cannot be fulfilled.
 */

export interface RestockLine {
  productId: string;
  size: string;
  quantity: number;
}

/** `${productId}:${size}` — the natural key for a stock-holding variant. */
export function variantKey(productId: string, size: string): string {
  return `${productId}:${size}`;
}

/**
 * Credits `quantity` back to each line's `ProductSize`.
 *
 * Only lines whose product denies overselling are restored. For an `inventoryPolicy:
 * "continue"` product the original decrement was `min(ordered, available)` rather than the
 * ordered quantity, so crediting the full amount back could invent stock that never existed;
 * that case is skipped deliberately rather than guessed at.
 *
 * One transaction, so a partial credit cannot survive a mid-way failure.
 */
export async function creditStockForLines(lines: RestockLine[]): Promise<void> {
  const positive = lines.filter((line) => line.quantity > 0);
  if (positive.length === 0) return;

  const productIds = [...new Set(positive.map((line) => line.productId))];
  const [products, sizes] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, inventoryPolicy: true } }),
    prisma.productSize.findMany({
      where: { OR: positive.map((line) => ({ productId: line.productId, name: line.size })) },
      select: { id: true, productId: true, name: true },
    }),
  ]);

  const policyById = new Map(products.map((product) => [product.id, product.inventoryPolicy]));
  const sizeIdByKey = new Map(sizes.map((size) => [variantKey(size.productId, size.name), size.id]));

  const increments = positive
    .filter((line) => policyById.get(line.productId) === "deny")
    .map((line) => ({ sizeId: sizeIdByKey.get(variantKey(line.productId, line.size)), quantity: line.quantity }))
    .filter((entry): entry is { sizeId: string; quantity: number } => Boolean(entry.sizeId));

  if (increments.length === 0) return;

  await prisma.$transaction(
    increments.map(({ sizeId, quantity }) =>
      prisma.productSize.update({ where: { id: sizeId }, data: { quantity: { increment: quantity } } }),
    ),
  );
}

/**
 * How many units per variant the returns on this order have ALREADY credited back.
 *
 * Read by the order-level restock so refunding an order after one of its items was returned
 * credits only the lines the return did not cover. Keyed by `variantKey`; a variant absent
 * from the map has had nothing credited.
 */
export async function quantitiesCreditedByReturns(orderId: string): Promise<Map<string, number>> {
  const rows = await prisma.return.findMany({
    where: { orderId, restockedAt: { not: null } },
    select: { items: true },
  });

  const credited = new Map<string, number>();
  for (const row of rows) {
    for (const item of readReturnLines(row.items)) {
      const key = variantKey(item.productId, item.size);
      credited.set(key, (credited.get(key) ?? 0) + item.quantity);
    }
  }
  return credited;
}

/**
 * Subtracts units already credited (by returns) from the order's lines, leaving only what
 * still needs putting back. Pure, so the arithmetic that decides whether stock is invented
 * or lost can be tested without a database.
 *
 * `credited` is consumed as it goes: two order lines for the same variant must not each
 * subtract the same returned units, or a two-line order would end up crediting nothing.
 * The map is copied rather than mutated in place, so callers can reuse theirs.
 */
export function subtractCreditedQuantities(
  lines: readonly RestockLine[],
  credited: ReadonlyMap<string, number>,
): RestockLine[] {
  const remaining = new Map(credited);

  return lines.map((line) => {
    const key = variantKey(line.productId, line.size);
    const alreadyCredited = remaining.get(key) ?? 0;
    const consumed = Math.min(alreadyCredited, line.quantity);
    remaining.set(key, alreadyCredited - consumed);
    // Never negative: a return recording more units than the order line held is bad data,
    // and must not turn into a stock DEDUCTION.
    return { productId: line.productId, size: line.size, quantity: line.quantity - consumed };
  });
}

/**
 * `Return.items` is a Json snapshot. It is read defensively rather than cast, because these
 * are rows already written — possibly by an older shape — and a malformed one must not throw
 * inside a stock calculation. A line that cannot be read contributes nothing, which errs
 * toward crediting less rather than inventing stock.
 */
export function readReturnLines(items: unknown): RestockLine[] {
  if (!Array.isArray(items)) return [];

  return items.flatMap((raw) => {
    if (raw === null || typeof raw !== "object") return [];
    const { productId, size, quantity } = raw as Record<string, unknown>;
    if (typeof productId !== "string" || typeof size !== "string") return [];
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) return [];
    return [{ productId, size, quantity }];
  });
}
