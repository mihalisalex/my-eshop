import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { wishlistInclude, toWishlist, type WishlistRow } from "@/lib/commerce/postgres/mappers";
import type { Wishlist } from "@/lib/commerce/types";

export interface WishlistIdentity {
  customerId?: string;
  anonymousId?: string;
}

async function findWishlistRow(identity: WishlistIdentity): Promise<WishlistRow | null> {
  if (identity.customerId) {
    return prisma.wishlist.findUnique({ where: { customerId: identity.customerId }, include: wishlistInclude });
  }
  if (identity.anonymousId) {
    return prisma.wishlist.findUnique({ where: { anonymousId: identity.anonymousId }, include: wishlistInclude });
  }
  return null;
}

async function getOrCreateWishlistRow(identity: WishlistIdentity): Promise<WishlistRow> {
  const existing = await findWishlistRow(identity);
  if (existing) return existing;
  if (identity.customerId) {
    return prisma.wishlist.create({ data: { customerId: identity.customerId }, include: wishlistInclude });
  }
  if (identity.anonymousId) {
    return prisma.wishlist.create({ data: { anonymousId: identity.anonymousId }, include: wishlistInclude });
  }
  throw new Error("Wishlist identity required (customerId or anonymousId).");
}

export async function getWishlistByOwner(identity: WishlistIdentity): Promise<Wishlist> {
  return toWishlist(await getOrCreateWishlistRow(identity));
}

export async function addWishlistItem(identity: WishlistIdentity, productId: string): Promise<Wishlist> {
  const row = await getOrCreateWishlistRow(identity);
  const exists = row.items.some((item) => item.productId === productId);
  if (!exists) {
    await prisma.wishlistItem.create({ data: { wishlistId: row.id, productId } });
  }
  return getWishlistByOwner(identity);
}

export async function removeWishlistItem(identity: WishlistIdentity, productId: string): Promise<Wishlist> {
  const row = await getOrCreateWishlistRow(identity);
  await prisma.wishlistItem.deleteMany({ where: { wishlistId: row.id, productId } });
  return getWishlistByOwner(identity);
}

/** Idempotent — a wishlist's share link never changes once first generated, so an already-shared link keeps working. */
export async function getOrCreateShareToken(identity: WishlistIdentity): Promise<string> {
  const row = await getOrCreateWishlistRow(identity);
  if (row.shareToken) return row.shareToken;
  const token = crypto.randomBytes(9).toString("base64url");
  await prisma.wishlist.update({ where: { id: row.id }, data: { shareToken: token } });
  return token;
}

/** Public, read-only lookup — no identity check, the token itself is the capability. */
export async function getWishlistByShareToken(token: string): Promise<Wishlist | null> {
  const row = await prisma.wishlist.findUnique({ where: { shareToken: token }, include: wishlistInclude });
  return row ? toWishlist(row) : null;
}

/** Merges the anonymous guest wishlist into the customer's wishlist (idempotent productId union), deletes the guest row. */
export async function linkWishlistToCustomer(anonymousId: string, customerId: string): Promise<Wishlist> {
  const guestRow = await findWishlistRow({ anonymousId });
  const customerRow = await getOrCreateWishlistRow({ customerId });
  if (!guestRow || guestRow.id === customerRow.id) return toWishlist(customerRow);

  const existingProductIds = new Set(customerRow.items.map((item) => item.productId));
  for (const item of guestRow.items) {
    if (!existingProductIds.has(item.productId)) {
      await prisma.wishlistItem.create({ data: { wishlistId: customerRow.id, productId: item.productId } });
    }
  }
  await prisma.wishlist.delete({ where: { id: guestRow.id } });
  return getWishlistByOwner({ customerId });
}
