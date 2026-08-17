import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { cartInclude, toCart, toNumber, type CartRow } from "@/lib/commerce/postgres/mappers";
import { round2 } from "@/lib/commerce/postgres/cart-totals";
import { findSizeVariant, isSizePurchasable } from "@/lib/product";
import { getProductById, getRelatedProducts } from "@/services/products";
import { getDiscountByCode } from "@/services/discounts";
import { getGiftCardByCode } from "@/services/gift-cards";
import { getShippingRates } from "@/lib/shipping";
import { CommerceError, type AddLineItemInput, type Address, type Cart, type ShippingRate } from "@/lib/commerce/types";
import type { Product } from "@/types";

/**
 * Postgres-backed CartService implementation (services/*.ts convention — same
 * exported-function shape as services/products.ts, called directly from
 * Route Handlers under app/api/cart, never from the browser). Business logic
 * (VAT, shipping threshold, stock-aware maxQuantity, discount/gift-card
 * validation) is preserved exactly from the mock's cart.service.ts — see
 * lib/commerce/postgres/cart-totals.ts for the totals formula itself.
 */

async function loadCartRow(cartId: string): Promise<CartRow | null> {
  return prisma.cart.findUnique({ where: { id: cartId }, include: cartInclude });
}

async function requireCartRow(cartId: string): Promise<CartRow> {
  const row = await loadCartRow(cartId);
  if (!row) throw new CommerceError("CART_NOT_FOUND", `Cart ${cartId} not found.`);
  return row;
}

async function reloadCart(cartId: string): Promise<Cart> {
  const row = await requireCartRow(cartId);
  return toCart(row);
}

export async function getOrCreateCart(cartId?: string | null): Promise<Cart> {
  if (cartId) {
    const row = await loadCartRow(cartId);
    if (row) return toCart(row);
  }
  const created = await prisma.cart.create({ data: {}, include: cartInclude });
  return toCart(created);
}

export async function getCart(cartId: string): Promise<Cart | null> {
  const row = await loadCartRow(cartId);
  return row ? toCart(row) : null;
}

function resolveMaxQuantity(product: Product, sizeName: string): number {
  const sizeVariant = findSizeVariant(product, sizeName);
  if (!sizeVariant) return 0;
  if (sizeVariant.quantity > 0) return sizeVariant.quantity;
  return product.inventoryPolicy === "continue" ? 99 : 0;
}

/**
 * Size was always validated against the product; colour never was, and it is stored on
 * the line item, snapshotted into `Order.lineItems` at purchase, and shown to the admin
 * when they pick and pack. So an unvalidated colour is both a data-integrity problem and
 * the dedupe key's weak point: `findFirst` below matches on colour, so re-adding the same
 * product with a different colour string created a SEPARATE line item and sidestepped the
 * per-line stock cap entirely. Sending a mojibaked colour was enough to do it.
 *
 * A product with no colours legitimately has none to send — the purchase panel submits
 * `product.colors[0]?.name ?? ""` — so blank is accepted only in that case, and always
 * normalised to "" rather than passed through.
 */
function resolveColorName(product: Product, requested: string): string {
  const trimmed = requested.trim();
  if (product.colors.length === 0) {
    if (trimmed) {
      throw new CommerceError("INVALID_VARIANT", `${product.name} isn't available in a colour.`);
    }
    return "";
  }
  const match = product.colors.find((color) => color.name === trimmed);
  if (!match) {
    throw new CommerceError("INVALID_VARIANT", `${product.name} isn't available in that colour.`);
  }
  return match.name;
}

export async function addLineItem(cartId: string, input: AddLineItemInput): Promise<Cart> {
  await requireCartRow(cartId);
  const product = await getProductById(input.productId);
  if (!product) throw new CommerceError("OUT_OF_STOCK", "Product no longer available.");
  if (!isSizePurchasable(product, input.size)) {
    throw new CommerceError("OUT_OF_STOCK", `${product.name} (${input.size}) is out of stock.`);
  }

  const maxQuantity = resolveMaxQuantity(product, input.size);
  const color = resolveColorName(product, input.color);
  const colorMatch = product.colors.find((c) => c.name === color);
  const image = colorMatch?.image ?? { src: product.images[0].src, alt: product.images[0].alt };
  const unitPrice = product.salePrice ?? product.price;

  const existing = await prisma.cartLineItem.findFirst({
    where: { cartId, productId: input.productId, color, size: input.size, savedForLater: false },
  });

  // Clamped on BOTH branches. Only the update path used to clamp, so the very first add
  // of a line stored whatever quantity was asked for: a crafted request for 9999 against
  // a size with one unit in stock produced a line item with quantity 9999, maxQuantity 1,
  // and a cart total of EUR 713,900. completeCheckout re-validates stock inside the order
  // transaction so it was never an oversell, but it left the shopper with a nonsense cart
  // that could then never check out.
  const clamp = (quantity: number) => (maxQuantity > 0 ? Math.min(quantity, maxQuantity) : quantity);

  if (existing) {
    await prisma.cartLineItem.update({
      where: { id: existing.id },
      data: { quantity: clamp(existing.quantity + input.quantity), maxQuantity },
    });
  } else {
    await prisma.cartLineItem.create({
      data: {
        cartId,
        productId: input.productId,
        slug: product.slug,
        name: product.name,
        imageSrc: image.src,
        imageAlt: image.alt,
        color,
        size: input.size,
        unitPriceAmount: unitPrice.amount,
        quantity: clamp(input.quantity),
        maxQuantity,
      },
    });
  }

  return reloadCart(cartId);
}

async function requireOwnLineItem(cartId: string, lineItemId: string) {
  const item = await prisma.cartLineItem.findUnique({ where: { id: lineItemId } });
  if (!item || item.cartId !== cartId) {
    throw new CommerceError("LINE_ITEM_NOT_FOUND", "That item is no longer in your cart.");
  }
  return item;
}

export async function updateLineItemQuantity(cartId: string, lineItemId: string, quantity: number): Promise<Cart> {
  await requireCartRow(cartId);
  const item = await requireOwnLineItem(cartId, lineItemId);
  const nextQuantity = item.maxQuantity > 0 ? Math.min(Math.max(quantity, 1), item.maxQuantity) : Math.max(quantity, 1);
  await prisma.cartLineItem.update({ where: { id: lineItemId }, data: { quantity: nextQuantity } });
  return reloadCart(cartId);
}

export async function removeLineItem(cartId: string, lineItemId: string): Promise<Cart> {
  await requireCartRow(cartId);
  await prisma.cartLineItem.deleteMany({ where: { id: lineItemId, cartId } });
  return reloadCart(cartId);
}

export async function saveForLater(cartId: string, lineItemId: string): Promise<Cart> {
  await requireCartRow(cartId);
  await requireOwnLineItem(cartId, lineItemId);
  await prisma.cartLineItem.update({ where: { id: lineItemId }, data: { savedForLater: true } });
  return reloadCart(cartId);
}

export async function moveToCart(cartId: string, lineItemId: string): Promise<Cart> {
  await requireCartRow(cartId);
  await requireOwnLineItem(cartId, lineItemId);
  await prisma.cartLineItem.update({ where: { id: lineItemId }, data: { savedForLater: false } });
  return reloadCart(cartId);
}

export async function applyDiscountCode(cartId: string, code: string): Promise<Cart> {
  const row = await requireCartRow(cartId);
  const normalized = code.trim().toUpperCase();

  if (row.discounts.some((d) => d.code === normalized)) {
    throw new CommerceError("DISCOUNT_ALREADY_APPLIED", "That code is already applied.");
  }

  const discount = await getDiscountByCode(normalized);
  const isExpired = discount?.expiresAt ? new Date(discount.expiresAt).getTime() < Date.now() : false;
  if (!discount || !discount.active || isExpired) {
    throw new CommerceError("INVALID_DISCOUNT_CODE", "That code isn't valid or has expired.");
  }

  const subtotalAmount = row.lineItems
    .filter((li) => !li.savedForLater)
    .reduce((sum, li) => sum + toNumber(li.unitPriceAmount) * li.quantity, 0);
  const amount = discount.type === "percentage" ? (subtotalAmount * discount.value) / 100 : Math.min(discount.value, subtotalAmount);

  await prisma.cartDiscount.create({
    data: { cartId, code: discount.code, type: discount.type, value: discount.value, amount: round2(amount) },
  });
  return reloadCart(cartId);
}

export async function removeDiscountCode(cartId: string, code: string): Promise<Cart> {
  await requireCartRow(cartId);
  await prisma.cartDiscount.deleteMany({ where: { cartId, code } });
  return reloadCart(cartId);
}

export async function applyGiftCard(cartId: string, code: string): Promise<Cart> {
  const row = await requireCartRow(cartId);
  const normalized = code.trim().toUpperCase();

  const giftCard = await getGiftCardByCode(normalized);
  if (!giftCard || !giftCard.active) {
    throw new CommerceError("INVALID_GIFT_CARD", "That gift card code isn't valid.");
  }
  if (row.giftCards.some((g) => g.code === normalized)) {
    throw new CommerceError("INVALID_GIFT_CARD", "That gift card is already applied.");
  }

  const cart = toCart(row);
  const existingApplied = row.giftCards.reduce((sum, g) => sum + toNumber(g.amountApplied), 0);
  // Fixed from the mock's `|| match.balance.amount` quirk: a fully-covered cart now
  // correctly gets amountApplied = 0 for a newly-applied card instead of double-applying.
  const remainingDue = Math.max(cart.totals.total.amount - existingApplied, 0);
  const amountApplied = Math.min(giftCard.balance.amount, remainingDue);

  await prisma.cartGiftCard.create({
    data: {
      cartId,
      code: giftCard.code,
      balanceAmount: giftCard.balance.amount,
      amountApplied: round2(amountApplied),
    },
  });
  return reloadCart(cartId);
}

export async function removeGiftCard(cartId: string, code: string): Promise<Cart> {
  await requireCartRow(cartId);
  await prisma.cartGiftCard.deleteMany({ where: { cartId, code } });
  return reloadCart(cartId);
}

export async function estimateShipping(cartId: string, _address?: Partial<Address>): Promise<ShippingRate[]> {
  await requireCartRow(cartId);
  return getShippingRates();
}

/** Union line items from the guest cart into the customer's existing cart, deduped by variant, capped at maxQuantity; deletes the guest cart row. */
export async function mergeCarts(guestCartId: string, customerCartId: string): Promise<Cart> {
  if (guestCartId === customerCartId) return reloadCart(customerCartId);

  const guestRow = await loadCartRow(guestCartId);
  if (!guestRow) return reloadCart(customerCartId);
  await requireCartRow(customerCartId);

  // The customer's existing items are read once and matched in memory. Previously this
  // issued a findFirst per guest item and then a second write per item, all sequential —
  // ~2N round-trips on the sign-in path for an N-item guest cart.
  const customerItems = await prisma.cartLineItem.findMany({ where: { cartId: customerCartId } });
  const variantKey = (item: { productId: string; color: string; size: string; savedForLater: boolean }) =>
    `${item.productId}|${item.color}|${item.size}|${item.savedForLater}`;
  const existingByVariant = new Map(customerItems.map((item) => [variantKey(item), item]));

  const quantityUpdates: { id: string; quantity: number }[] = [];
  const newItems: Prisma.CartLineItemCreateManyInput[] = [];

  for (const guestItem of guestRow.lineItems) {
    const existing = existingByVariant.get(variantKey(guestItem));
    if (existing) {
      const combined = existing.quantity + guestItem.quantity;
      const cap = existing.maxQuantity || combined;
      quantityUpdates.push({ id: existing.id, quantity: Math.min(combined, cap) });
    } else {
      newItems.push({
        cartId: customerCartId,
        productId: guestItem.productId,
        slug: guestItem.slug,
        name: guestItem.name,
        imageSrc: guestItem.imageSrc,
        imageAlt: guestItem.imageAlt,
        color: guestItem.color,
        size: guestItem.size,
        unitPriceAmount: guestItem.unitPriceAmount,
        quantity: guestItem.quantity,
        maxQuantity: guestItem.maxQuantity,
        savedForLater: guestItem.savedForLater,
      });
    }
  }

  // Transactional so a mid-merge failure can't drop the guest cart with only some of its
  // items transferred — the customer would silently lose the remainder.
  await prisma.$transaction([
    ...quantityUpdates.map(({ id, quantity }) => prisma.cartLineItem.update({ where: { id }, data: { quantity } })),
    ...(newItems.length ? [prisma.cartLineItem.createMany({ data: newItems })] : []),
    prisma.cart.delete({ where: { id: guestCartId } }),
  ]);

  return reloadCart(customerCartId);
}

/** Associates a cart with a just-signed-in customer — adopts it if they have no cart yet, else merges into their existing one. */
export async function linkCustomerCart(cartId: string, customerId: string): Promise<Cart> {
  const cartRow = await requireCartRow(cartId);
  if (cartRow.customerId === customerId) return toCart(cartRow);

  const existingCustomerCart = await prisma.cart.findFirst({
    where: { customerId, id: { not: cartId } },
    orderBy: { updatedAt: "desc" },
  });

  if (!existingCustomerCart) {
    if (cartRow.customerId && cartRow.customerId !== customerId) {
      // Cart belongs to a different customer — don't hijack it, start the caller fresh instead.
      const created = await prisma.cart.create({ data: { customerId }, include: cartInclude });
      return toCart(created);
    }
    const updated = await prisma.cart.update({ where: { id: cartId }, data: { customerId }, include: cartInclude });
    return toCart(updated);
  }

  return mergeCarts(cartId, existingCustomerCart.id);
}

export async function getRecommendations(cartId: string, limit = 4): Promise<Product[]> {
  const row = await requireCartRow(cartId);
  const firstItem = row.lineItems.find((li) => !li.savedForLater);
  if (!firstItem) return [];
  return getRelatedProducts(firstItem.productId, limit);
}

export async function clearCart(cartId: string): Promise<Cart> {
  await requireCartRow(cartId);
  await prisma.$transaction([
    prisma.cartLineItem.deleteMany({ where: { cartId } }),
    prisma.cartDiscount.deleteMany({ where: { cartId } }),
    prisma.cartGiftCard.deleteMany({ where: { cartId } }),
  ]);
  return reloadCart(cartId);
}
