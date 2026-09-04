import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
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

/**
 * Finds this owner's wishlist, creating one the first time.
 *
 * The find-then-create was a race, and one that fired in ordinary use rather than under
 * load (BUG-001): two requests for the same owner arriving together both find nothing, both
 * INSERT, and the loser hits the unique constraint on `customerId`/`anonymousId` and returns
 * a 500. WishlistProvider loads on mount, so a double-invoked effect or two quick
 * navigations is enough — it was observed as a real "Something went wrong" in the browser,
 * with a P2002 in the server log between two successful requests for the same id.
 *
 * Recovered rather than prevented, because losing this race is harmless: the row the winner
 * created is exactly the row this request wanted. Same shape as completeCheckout's duplicate
 * -order recovery — let the unique constraint be the authority, then read back the winner.
 */
async function getOrCreateWishlistRow(identity: WishlistIdentity): Promise<WishlistRow> {
  const existing = await findWishlistRow(identity);
  if (existing) return existing;

  const data = identity.customerId
    ? { customerId: identity.customerId }
    : identity.anonymousId
      ? { anonymousId: identity.anonymousId }
      : null;
  if (!data) throw new Error("Wishlist identity required (customerId or anonymousId).");

  try {
    return await prisma.wishlist.create({ data, include: wishlistInclude });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await findWishlistRow(identity);
      if (winner) return winner;
    }
    throw error;
  }
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
  const toAdd = guestRow.items
    .filter((item) => !existingProductIds.has(item.productId))
    .map((item) => ({ wishlistId: customerRow.id, productId: item.productId }));

  // One INSERT for the whole merge rather than one per item, and in a transaction with
  // the guest-row delete so a failure partway can't leave items copied AND the guest
  // wishlist still present (a sign-in that duplicates the list on retry).
  await prisma.$transaction([
    ...(toAdd.length ? [prisma.wishlistItem.createMany({ data: toAdd, skipDuplicates: true })] : []),
    prisma.wishlist.delete({ where: { id: guestRow.id } }),
  ]);
  return getWishlistByOwner({ customerId });
}
