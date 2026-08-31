import type { Image, Money, SlugEntity } from "./common";

export interface ColorVariant {
  name: string;
  hex: string;
  image?: Image;
}

export interface SizeVariant {
  name: string;
  inStock: boolean;
  /** Units on hand. Drives low-stock badges and cart quantity limits. */
  quantity: number;
  /** Per-variant SKU — falls back to the product-level `sku` when a catalog doesn't track this granularly. */
  sku?: string;
  barcode?: string;
}

export interface ProductVideo {
  src: string;
  poster: string;
  alt: string;
}

export type ProductGender = "women" | "men" | "unisex" | "kids";
export type ProductSeason = "spring-summer" | "autumn-winter" | "resort" | "all-season";

/** Inventory policy mirrors the Shopify/commerce-platform convention so an adapter swap doesn't change semantics. */
export type InventoryPolicy = "deny" | "continue";

/**
 * Publication lifecycle — distinct from `availableForSale`, which is purchasability.
 * Only "active" is ever customer-visible. "archived" is a soft delete: retired from the
 * storefront but still resolvable for orders/carts/wishlists that already reference it.
 */
export type ProductStatus = "draft" | "active" | "archived";

export const PRODUCT_STATUSES: ProductStatus[] = ["draft", "active", "archived"];

/**
 * Re-exported from the Zod schema rather than declared again here.
 *
 * This file used to carry its own hand-written `{ title?, description?, ogImage? }`
 * interface alongside `productSeoOverrideSchema` in lib/validation, so the shape existed
 * twice and stayed in sync only by someone remembering. Adding a field to one and not the
 * other type-checks perfectly and silently drops the field at the boundary that parses it.
 * The schema is the source of truth because it is the thing that actually validates the
 * Json column on every read and write.
 */
export type { CategorySeoOverride, ProductSeoOverride } from "@/lib/validation/product";

export type ProductBadgeTone = "new" | "sale" | "preorder" | "backorder" | "low-stock" | "bestseller";

/** Keys under the `ProductBadge` message namespace — see messages/*.json. */
export type ProductBadgeKey = "preorder" | "backorder" | "sale" | "new" | "lastSize" | "fewSizesLeft";

export interface ProductBadge {
  /**
   * A translation key, NOT a display string. `getProductBadges` is a pure function shared by
   * server and client with no access to the request locale, so returning "Last size" there
   * hard-coded English onto every product card — the most-seen text on the site, on a shop
   * whose default language is Greek. The component that renders it does the translating.
   */
  key: ProductBadgeKey;
  tone: ProductBadgeTone;
}

export interface Product extends SlugEntity {
  name: string;
  description: string;
  /** Greek translations — see lib/localize.ts, which picks these over name/description for el-locale storefront rendering. Undefined for anything not yet translated. */
  nameEl?: string;
  descriptionEl?: string;
  price: Money;
  compareAtPrice?: Money;
  /** Explicit promotional override. When set, this is the effective selling price instead of `price`. */
  salePrice?: Money;
  /** Unit cost to the business. Admin-only — never rendered on the storefront. Drives margin. */
  costPrice?: Money;
  /** images[0] is the primary card image, images[1] is the hover-swap image. Remaining entries feed the PDP gallery. */
  images: Image[];
  videos?: ProductVideo[];
  colors: ColorVariant[];
  sizes: SizeVariant[];
  /** The assigned category's slug — kept as a plain string here (not the full Category
   * object) so every existing consumer (PLP `?category=` scoping, search facets, the
   * breadcrumb, `lib/fit-recommendation.ts`) keeps working unchanged now that the
   * underlying source of truth is a real relational Category. Use `categoryId` for
   * anything that needs the real row (the admin product form's category picker, writes). */
  category: string;
  categoryId: string;
  collectionIds: string[];
  tags: string[];
  gender: ProductGender;
  season?: ProductSeason;
  materials: string[];
  careInstructions: string[];
  /** Explicit cross-sell/up-sell picks. Falls back to same-category products when omitted. */
  relatedProductIds?: string[];
  isNew?: boolean;
  isSale?: boolean;
  /** ISO timestamp. Needed for a real "Newest" sort — see lib/commerce/providers/mock/search.service.ts. */
  createdAt?: string;
  /** ISO timestamp of the last edit. Drives the sitemap's `<lastmod>`, which has to be a
   * real date to carry any signal at all — see app/sitemap.ts. */
  updatedAt?: string;
  isPreorder?: boolean;
  isBackorder?: boolean;
  /** Expected fulfillment date when isPreorder/isBackorder is set (e.g. "Ships Sept 12"). */
  fulfillmentNote?: string;
  rating?: number;
  reviewCount?: number;
  sku: string;
  barcode?: string;
  inventoryPolicy: InventoryPolicy;
  shippingWeightGrams?: number;
  /** Purchasability. Separate from `status` — see ProductStatus. */
  availableForSale: boolean;
  status: ProductStatus;
  /** Set when status moved to "archived"; cleared on restore. */
  archivedAt?: string;
  brand?: string;
  vendor?: string;
  seo?: import("@/lib/validation/product").ProductSeoOverride;
}
