import type { CartLineItem, Order } from "@/lib/commerce/types";
import type { Product } from "@/types";

/**
 * Real, not fake ML — derives a suggested size from the signed-in customer's own
 * past purchases in the same product category, the most defensible signal
 * available without a real sizing dataset. `purchasedProductsById` must contain
 * every product referenced by `pastOrders`' line items (the caller batches one
 * `getByIds` call) — `CartLineItem` only snapshots name/color/size, not category,
 * so the category comparison needs the live product record. Returns null when
 * there's no same-category history, so callers can simply not render anything
 * rather than showing a hedge.
 */
export function suggestSize(
  pastOrders: Order[],
  purchasedProductsById: Map<string, Product>,
  currentProduct: Product
): string | null {
  const sameCategorySizes = pastOrders
    .flatMap((order): CartLineItem[] => order.lineItems)
    .filter((item) => item.productId !== currentProduct.id)
    .filter((item) => purchasedProductsById.get(item.productId)?.category === currentProduct.category)
    .map((item) => item.size);

  if (sameCategorySizes.length === 0) return null;

  const counts = new Map<string, number>();
  for (const size of sameCategorySizes) counts.set(size, (counts.get(size) ?? 0) + 1);

  let best: string | null = null;
  let bestCount = 0;
  for (const [size, count] of counts) {
    if (count > bestCount) {
      best = size;
      bestCount = count;
    }
  }
  return best;
}
