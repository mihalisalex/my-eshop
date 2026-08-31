import "server-only";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import type { Product, ProductGender, ProductSeason, InventoryPolicy, ProductStatus } from "@/types/product";
import type { Category } from "@/types/category";
import type { Collection } from "@/types/collection";
import type { ShippingRate } from "@/lib/commerce/types";
import type { Discount, GiftCard } from "@/types/commerce";
import {
  productImagesSchema,
  productVideosSchema,
  productSeoOverrideSchema,
  categorySeoOverrideSchema,
  imageSchema,
} from "@/lib/validation/product";
import { storedAddressSchema } from "@/lib/validation/checkout";
import { shippingRateSchema, cartLineItemSchema, cartTotalsSchema } from "@/lib/validation/commerce";
import { resolveCartAmounts } from "@/lib/commerce/postgres/cart-totals";
import { returnItemSchema } from "@/lib/validation/commerce";
import type {
  Cart,
  CartLineItem,
  Checkout,
  CheckoutStatus,
  Customer,
  CustomerAddress,
  Order,
  Return,
  Wishlist,
} from "@/lib/commerce/types";

/** Prisma Decimal fields deserialize to a Decimal.js-like object, not a plain number. */
export function toNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

/**
 * Prisma 7's Json input types require an index signature that plain domain
 * interfaces (Address, ShippingRate, CartLineItem[], CartTotals) don't
 * structurally have — safe to assert since these are always plain
 * JSON-serializable objects (no functions/symbols/class instances).
 */
export function toJsonInput<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export const productInclude = {
  colors: { orderBy: { position: "asc" } },
  sizes: { orderBy: { position: "asc" } },
  collections: { orderBy: { position: "asc" } },
  category: true,
} satisfies Prisma.ProductInclude;

export type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    nameEl: row.nameEl ?? undefined,
    descriptionEl: row.descriptionEl ?? undefined,
    price: { amount: toNumber(row.priceAmount), currencyCode: row.currencyCode },
    compareAtPrice:
      row.compareAtPriceAmount != null
        ? { amount: toNumber(row.compareAtPriceAmount), currencyCode: row.currencyCode }
        : undefined,
    salePrice:
      row.salePriceAmount != null
        ? { amount: toNumber(row.salePriceAmount), currencyCode: row.currencyCode }
        : undefined,
    costPrice:
      row.costPriceAmount != null
        ? { amount: toNumber(row.costPriceAmount), currencyCode: row.currencyCode }
        : undefined,
    images: productImagesSchema.parse(row.images),
    videos: row.videos ? productVideosSchema.parse(row.videos) : undefined,
    colors: row.colors.map((color) => ({
      name: color.name,
      hex: color.hex,
      image: color.imageSrc ? { src: color.imageSrc, alt: color.imageAlt ?? color.name } : undefined,
    })),
    sizes: row.sizes.map((size) => ({
      name: size.name,
      inStock: size.inStock,
      quantity: size.quantity,
      sku: size.sku ?? undefined,
      barcode: size.barcode ?? undefined,
    })),
    // `category` stays a plain slug string here (not the joined Category object) so every
    // existing consumer keeps working unchanged — see the Product.category doc comment.
    category: row.category.slug,
    categoryId: row.categoryId,
    collectionIds: row.collections.map((link) => link.collectionId),
    tags: row.tags,
    gender: row.gender as ProductGender,
    season: (row.season as ProductSeason | null) ?? undefined,
    materials: row.materials,
    careInstructions: row.careInstructions,
    relatedProductIds: row.relatedProductIds,
    isNew: row.isNew,
    isSale: row.isSale,
    isPreorder: row.isPreorder,
    isBackorder: row.isBackorder,
    fulfillmentNote: row.fulfillmentNote ?? undefined,
    rating: row.rating ?? undefined,
    reviewCount: row.reviewCount ?? undefined,
    sku: row.sku,
    barcode: row.barcode ?? undefined,
    inventoryPolicy: row.inventoryPolicy as InventoryPolicy,
    shippingWeightGrams: row.shippingWeightGrams ?? undefined,
    availableForSale: row.availableForSale,
    status: row.status as ProductStatus,
    archivedAt: row.archivedAt?.toISOString(),
    brand: row.brand ?? undefined,
    vendor: row.vendor ?? undefined,
    seo: row.seo ? productSeoOverrideSchema.parse(row.seo) : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const categoryInclude = {
  _count: { select: { products: true } },
} satisfies Prisma.CategoryInclude;

export type CategoryRow = Prisma.CategoryGetPayload<{ include: typeof categoryInclude }>;

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameEl: row.nameEl ?? undefined,
    description: row.description ?? undefined,
    descriptionEl: row.descriptionEl ?? undefined,
    parentId: row.parentId ?? undefined,
    position: row.position,
    image: row.image ? imageSchema.parse(row.image) : undefined,
    bannerImage: row.bannerImage ? imageSchema.parse(row.bannerImage) : undefined,
    isFeatured: row.isFeatured,
    isVisible: row.isVisible,
    // The category schema, not the product one — categories additionally carry the
    // editorial intro and FAQs that make them landing pages rather than grids.
    seo: row.seo ? categorySeoOverrideSchema.parse(row.seo) : undefined,
    productCount: row._count.products,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const collectionInclude = {
  products: { orderBy: { position: "asc" } },
} satisfies Prisma.CollectionInclude;

export type CollectionRow = Prisma.CollectionGetPayload<{ include: typeof collectionInclude }>;

export function toCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    description: row.description ?? undefined,
    titleEl: row.titleEl ?? undefined,
    subtitleEl: row.subtitleEl ?? undefined,
    descriptionEl: row.descriptionEl ?? undefined,
    image: imageSchema.parse(row.image),
    productIds: row.products.map((link) => link.productId),
    cta:
      row.ctaLabel && row.ctaHref
        ? {
            label: row.ctaLabel,
            href: row.ctaHref,
            variant: (row.ctaVariant as "primary" | "secondary" | "ghost" | "link" | null) ?? undefined,
          }
        : undefined,
    seo: row.seo ? categorySeoOverrideSchema.parse(row.seo) : undefined,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export const cartInclude = {
  lineItems: { orderBy: { addedAt: "asc" } },
  discounts: { orderBy: { createdAt: "asc" } },
  giftCards: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.CartInclude;

export type CartRow = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

function toCartLineItem(row: CartRow["lineItems"][number], currencyCode: string): CartLineItem {
  return {
    id: row.id,
    productId: row.productId,
    slug: row.slug,
    name: row.name,
    image: { src: row.imageSrc, alt: row.imageAlt },
    color: row.color,
    size: row.size,
    unitPrice: { amount: toNumber(row.unitPriceAmount), currencyCode },
    quantity: row.quantity,
    maxQuantity: row.maxQuantity,
    savedForLater: row.savedForLater,
    addedAt: row.addedAt.toISOString(),
  };
}

/**
 * `shippingRate` is REQUIRED, and passing `undefined` is a deliberate statement that no rate
 * applies — not an oversight. Shipping used to be priced from constants inside
 * `resolveCartAmounts`, so a caller that knew nothing about rates still got a €6.95 estimate;
 * now that rates are configurable, that estimate has to come from the store's settings, and a
 * caller silently omitting it would price against nothing at all.
 */
export function toCart(row: CartRow, shippingRate: ShippingRate | undefined): Cart {
  const currencyCode = row.currencyCode;
  const allLineItems = row.lineItems.map((li) => toCartLineItem(li, currencyCode));
  const lineItems = allLineItems.filter((li) => !li.savedForLater);
  const savedItems = allLineItems.filter((li) => li.savedForLater);

  // Discount/gift-card amounts are ALWAYS recomputed fresh here from the stored
  // rule (type/value, balance snapshot) against the cart's current subtotal —
  // never read back from the (possibly stale) persisted amount/amountApplied
  // columns. See resolveCartAmounts's doc comment for why trusting the stored
  // value was a real, exploitable revenue bug.
  const { totals, discounts, giftCards } = resolveCartAmounts({
    lineItems: allLineItems.map((li) => ({
      unitPriceAmount: li.unitPrice.amount,
      quantity: li.quantity,
      savedForLater: li.savedForLater,
    })),
    discounts: row.discounts.map((d) => ({ code: d.code, type: d.type as "percentage" | "fixed", value: toNumber(d.value) })),
    giftCards: row.giftCards.map((g) => ({ code: g.code, balanceAmount: toNumber(g.balanceAmount) })),
    currencyCode,
    selectedShippingRate: shippingRate,
  });

  return {
    id: row.id,
    lineItems,
    savedItems,
    discounts,
    giftCards,
    currencyCode,
    totals,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

export const customerInclude = {
  addresses: { orderBy: { position: "asc" } },
} satisfies Prisma.CustomerInclude;

export type CustomerRow = Prisma.CustomerGetPayload<{ include: typeof customerInclude }>;

export function toCustomerAddress(row: CustomerRow["addresses"][number]): CustomerAddress {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    company: row.company ?? undefined,
    address1: row.address1,
    address2: row.address2 ?? undefined,
    city: row.city,
    region: row.region ?? undefined,
    postalCode: row.postalCode,
    countryCode: row.countryCode,
    phone: row.phone ?? undefined,
  };
}

export function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone ?? undefined,
    addresses: row.addresses.map(toCustomerAddress),
    defaultAddressId: row.defaultAddressId ?? undefined,
    acceptsMarketing: row.acceptsMarketing,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Wishlist
// ---------------------------------------------------------------------------

export const wishlistInclude = {
  items: { orderBy: { addedAt: "asc" } },
} satisfies Prisma.WishlistInclude;

export type WishlistRow = Prisma.WishlistGetPayload<{ include: typeof wishlistInclude }>;

export function toWishlist(row: WishlistRow): Wishlist {
  return {
    id: row.id,
    items: row.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      addedAt: item.addedAt.toISOString(),
    })),
    shareToken: row.shareToken ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Checkout & Order
// ---------------------------------------------------------------------------

export type CheckoutRow = Prisma.CheckoutGetPayload<object>;

export function toCheckout(row: CheckoutRow): Checkout {
  return {
    id: row.id,
    cartId: row.cartId,
    email: row.email ?? undefined,
    shippingAddress: row.shippingAddress ? storedAddressSchema.parse(row.shippingAddress) : undefined,
    billingAddress: row.billingAddress ? storedAddressSchema.parse(row.billingAddress) : undefined,
    shippingRate: row.shippingRate ? shippingRateSchema.parse(row.shippingRate) : undefined,
    giftWrap: row.giftWrap,
    giftMessage: row.giftMessage ?? undefined,
    paymentMethodId: row.paymentMethodId ?? undefined,
    status: row.status as CheckoutStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

export type OrderRow = Prisma.OrderGetPayload<object>;

export function toOrder(row: OrderRow): Order {
  const totals = cartTotalsSchema.parse(row.totals);
  return {
    id: row.id,
    checkoutId: row.checkoutId,
    customerEmail: row.customerEmail,
    lineItems: z.array(cartLineItemSchema).parse(row.lineItems),
    // Historical snapshots predate gift wrapping and payment fees — see cartTotalsSchema's comment.
    totals: {
      ...totals,
      giftWrapTotal: totals.giftWrapTotal ?? { amount: 0, currencyCode: totals.total.currencyCode },
      paymentFeeTotal: totals.paymentFeeTotal ?? { amount: 0, currencyCode: totals.total.currencyCode },
    },
    shippingAddress: storedAddressSchema.parse(row.shippingAddress),
    billingAddress: storedAddressSchema.parse(row.billingAddress),
    shippingRate: shippingRateSchema.parse(row.shippingRate),
    giftWrap: row.giftWrap,
    giftMessage: row.giftMessage ?? undefined,
    status: row.status as Order["status"],
    trackingNumber: row.trackingNumber ?? undefined,
    carrier: row.carrier ?? undefined,
    trackingUrl: row.trackingUrl ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toReturn(row: Prisma.ReturnGetPayload<object>): Return {
  return {
    id: row.id,
    orderId: row.orderId,
    customerEmail: row.customerEmail,
    items: z.array(returnItemSchema).parse(row.items),
    reason: row.reason,
    status: row.status as Return["status"],
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Discount & GiftCard
// ---------------------------------------------------------------------------

export function toDiscount(row: Prisma.DiscountGetPayload<object>): Discount {
  return {
    id: row.id,
    code: row.code,
    type: row.type as "percentage" | "fixed",
    value: toNumber(row.value),
    active: row.active,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : undefined,
  };
}

export function toGiftCard(row: Prisma.GiftCardGetPayload<object>): GiftCard {
  return {
    id: row.id,
    code: row.code,
    balance: { amount: toNumber(row.balanceAmount), currencyCode: row.currencyCode },
    active: row.active,
  };
}
