import type { Money, Product, ProductBadge, SizeVariant } from "@/types";

/** Resolves which price is actually charged — an explicit `salePrice` always wins over the list `price`. */
export function getEffectivePrice(product: Product): Money {
  return product.salePrice ?? product.price;
}

export function isOnSale(product: Product): boolean {
  return Boolean(product.salePrice || product.isSale) && Boolean(product.compareAtPrice);
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
