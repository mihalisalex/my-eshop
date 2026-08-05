import type { Money, Product, ProductBadge, SizeVariant } from "@/types";

/** Resolves which price is actually charged — an explicit `salePrice` always wins over the list `price`. */
export function getEffectivePrice(product: Product): Money {
  return product.salePrice ?? product.price;
}

export function isOnSale(product: Product): boolean {
  return Boolean(product.salePrice || product.isSale) && Boolean(product.compareAtPrice);
}

export interface ProductMargin {
  /** Effective selling price minus unit cost, in the product's currency. */
  profit: number;
  /** Profit as a percentage of the selling price (gross margin), not of cost (markup). */
  marginPercent: number;
}

/**
 * Margin against the price actually charged (`getEffectivePrice`, so a sale price wins),
 * which is the number that reflects reality — computing it off the list price would
 * overstate profit on everything discounted.
 *
 * Returns null when cost is unknown rather than defaulting to 0, so the UI can say "not
 * set" instead of confidently reporting 100% margin on every product that has no cost yet.
 * Deliberately derived on read and never stored: a persisted margin silently goes stale
 * the moment price or cost changes.
 */
export function getProductMargin(product: Product): ProductMargin | null {
  const cost = product.costPrice?.amount;
  if (cost == null) return null;

  const price = getEffectivePrice(product).amount;
  const profit = price - cost;
  // A free/zero-priced product has no meaningful margin percentage — avoid dividing by zero.
  const marginPercent = price === 0 ? 0 : (profit / price) * 100;
  return { profit, marginPercent };
}

function getTotalStock(product: Product): number {
  return product.sizes.reduce((sum, size) => sum + size.quantity, 0);
}

export function findSizeVariant(product: Product, sizeName: string): SizeVariant | undefined {
  return product.sizes.find((size) => size.name === sizeName);
}

/** A size is purchasable if it has stock, or the product allows continued selling (preorder/backorder). */
export function isSizePurchasable(product: Product, sizeName: string): boolean {
  const size = findSizeVariant(product, sizeName);
  if (!size) return false;
  if (size.quantity > 0) return true;
  return product.inventoryPolicy === "continue";
}

const LOW_STOCK_THRESHOLD = 5;

export function getProductBadges(product: Product): ProductBadge[] {
  const badges: ProductBadge[] = [];

  if (product.isPreorder) badges.push({ label: "Preorder", tone: "preorder" });
  else if (product.isBackorder) badges.push({ label: "Backorder", tone: "backorder" });
  if (isOnSale(product)) badges.push({ label: "Sale", tone: "sale" });
  else if (product.isNew) badges.push({ label: "New", tone: "new" });

  const totalStock = getTotalStock(product);
  if (product.availableForSale && totalStock > 0 && totalStock <= LOW_STOCK_THRESHOLD) {
    badges.push({ label: "Low Stock", tone: "low-stock" });
  }

  return badges;
}

/**
 * Deterministic "N people bought this recently" social-proof count, derived from the
 * SKU rather than `Math.random()` so server and client render the same number.
 * A real adapter would source this from actual order analytics.
 */
export function getRecentPurchaseCount(product: Product): number {
  const hash = product.sku.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 6 + (hash % 24);
}
