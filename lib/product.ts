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

/**
 * Scarcity is measured in SIZES REMAINING, not total units.
 *
 * This shop stocks roughly one pair per size, which is normal for an independent
 * footwear retailer and is the real inventory - not a data problem. But the badge used to
 * fire when total units across all sizes fell to 5 or fewer, which in a one-pair-per-size
 * shop just means "five sizes left", and it lit up on 147 of 164 active products. A badge
 * on 90% of a catalog tells a shopper nothing, and dressing ordinary stock as scarcity is
 * manufactured urgency of the same kind as the fabricated purchase counter removed in
 * 78b529f.
 *
 * Counting available sizes gives a signal that is both true and useful: 16 products are
 * genuinely down to their last size and 28 have two left, so the badge now appears on the
 * 27% where it means something - and says which, because "last size" and "a few sizes"
 * are different messages to someone deciding whether to buy now.
 */
const FEW_SIZES_THRESHOLD = 2;

function availableSizeCount(product: Product): number {
  return product.sizes.filter((size) => size.quantity > 0).length;
}

export function getProductBadges(product: Product): ProductBadge[] {
  const badges: ProductBadge[] = [];

  if (product.isPreorder) badges.push({ label: "Preorder", tone: "preorder" });
  else if (product.isBackorder) badges.push({ label: "Backorder", tone: "backorder" });
  if (isOnSale(product)) badges.push({ label: "Sale", tone: "sale" });
  else if (product.isNew) badges.push({ label: "New", tone: "new" });

  const sizesLeft = availableSizeCount(product);
  if (product.availableForSale && sizesLeft > 0 && sizesLeft <= FEW_SIZES_THRESHOLD) {
    badges.push({ label: sizesLeft === 1 ? "Last size" : "Few sizes left", tone: "low-stock" });
  }

  return badges;
}

/*
 * `getRecentPurchaseCount` was here: a hash of the SKU (`6 + hash % 24`) rendered on
 * every PDP as "N people bought this in the last 48 hours". It was REMOVED, not
 * relocated or disabled behind a flag, because it stated a fact about other customers'
 * behaviour that was never true — a product created with zero sales displayed "27
 * people bought this". Fabricated consumer statements of that kind are a banned
 * practice under Annex I of the EU Unfair Commercial Practices Directive as amended by
 * the Omnibus Directive, so this is a legal exposure rather than a UX choice.
 *
 * If real social proof is wanted later it has to be derived from `Order.lineItems`
 * within a genuine time window, and rendered only when the real count is non-zero.
 */
