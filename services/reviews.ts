import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cartLineItemSchema } from "@/lib/validation/commerce";
import type { Review } from "@/types";
import type { ProductReview } from "@/lib/generated/prisma/client";

/**
 * Shopper reviews.
 *
 * This used to read `data/reviews.json` — a static file, permanently empty, with no way for
 * anyone to write to it. Every product said "no reviews yet" and always would.
 *
 * Two rules shape what is here:
 *
 *   1. Only APPROVED reviews are ever read by the storefront. Pending and rejected rows
 *      exist only for the admin queue, and no count, average or list includes them.
 *   2. Publication is decided once, at submission. A review from someone who actually
 *      bought the shoe goes live immediately; anything else waits for a human. Deciding it
 *      at read time instead would mean a refund could retroactively unpublish a review a
 *      visitor has already seen and linked to.
 */

/** The storefront's shape. Deliberately without the email, which never leaves this module. */
function toReview(row: ProductReview): Review {
  return {
    id: row.id,
    productId: row.productId,
    author: row.authorName,
    rating: row.rating,
    title: row.title,
    body: row.body,
    verifiedPurchase: row.verifiedPurchase,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getReviewsForProduct(productId: string): Promise<Review[]> {
  const rows = await prisma.productReview.findMany({
    where: { productId, status: "approved" },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toReview);
}

export interface ReviewSummary {
  average: number;
  count: number;
  /** How many of each star rating, 1-5, for the bar chart beside the average. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export const EMPTY_REVIEW_SUMMARY: ReviewSummary = {
  average: 0,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

/**
 * Aggregated in the database rather than by loading every row and reducing in JavaScript:
 * this runs on every product page render, and the count is unbounded.
 */
export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
  const groups = await prisma.productReview.groupBy({
    by: ["rating"],
    where: { productId, status: "approved" },
    _count: { rating: true },
  });

  if (groups.length === 0) return EMPTY_REVIEW_SUMMARY;

  const distribution = { ...EMPTY_REVIEW_SUMMARY.distribution };
  let total = 0;
  let count = 0;
  for (const group of groups) {
    const n = group._count.rating;
    distribution[group.rating as 1 | 2 | 3 | 4 | 5] = n;
    total += group.rating * n;
    count += n;
  }

  // One decimal place, which is what the page shows — not a float with fifteen of them.
  return { average: Math.round((total / count) * 10) / 10, count, distribution };
}

/**
 * Whether this email has actually received this product.
 *
 * Delivered, not merely paid: the review request email goes out five days after delivery
 * for the same reason, and someone who has not yet held the shoe cannot review how it fits.
 *
 * Matched on the order's email rather than a customer account, because checkout does not
 * require one — insisting on a login here would exclude most real buyers.
 */
async function hasDeliveredOrderFor(productId: string, email: string): Promise<boolean> {
  /**
   * `lineItems` is a Json column, so the product cannot be part of the WHERE clause — the
   * orders are narrowed by email and delivery in the database, then their contents are
   * parsed here. Same shape as runReviewRequestFollowup, and the same reason: every Json
   * boundary in this app is validated with Zod rather than trusted.
   *
   * Cheap because the filter is per-shopper: one person's delivered orders, not the table.
   */
  const orders = await prisma.order.findMany({
    where: {
      customerEmail: { equals: email, mode: "insensitive" },
      deliveredAt: { not: null },
    },
    select: { lineItems: true },
  });

  return orders.some((order) => {
    const parsed = z.array(cartLineItemSchema).safeParse(order.lineItems);
    // A malformed order must not award a verified badge — it fails closed.
    return parsed.success && parsed.data.some((item) => item.productId === productId);
  });
}

export interface CreateReviewInput {
  productId: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  authorEmail: string;
}

export interface CreateReviewResult {
  /** True when it is already on the page, false when it is waiting for an admin. */
  published: boolean;
  verifiedPurchase: boolean;
}

export async function createReview(input: CreateReviewInput): Promise<CreateReviewResult> {
  const verifiedPurchase = await hasDeliveredOrderFor(input.productId, input.authorEmail);

  await prisma.productReview.create({
    data: {
      productId: input.productId,
      rating: input.rating,
      title: input.title,
      body: input.body,
      authorName: input.authorName,
      authorEmail: input.authorEmail.toLowerCase(),
      verifiedPurchase,
      status: verifiedPurchase ? "approved" : "pending",
      approvedAt: verifiedPurchase ? new Date() : null,
    },
  });

  return { published: verifiedPurchase, verifiedPurchase };
}

/**
 * Whether this email has already reviewed this product.
 *
 * Not a database constraint, because a unique index would also block the legitimate case of
 * someone reviewing a second pair years later, and because a hard failure at the database
 * level would surface as a 500 rather than a sentence the shopper can act on.
 */
export async function hasReviewed(productId: string, email: string): Promise<boolean> {
  const existing = await prisma.productReview.findFirst({
    where: { productId, authorEmail: email.toLowerCase(), status: { not: "rejected" } },
    select: { id: true },
  });
  return existing !== null;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface PendingReview extends Review {
  authorEmail: string;
  productName: string;
  productSlug: string;
}

/** The moderation queue: everything awaiting a decision, oldest first. */
export async function getPendingReviews(): Promise<PendingReview[]> {
  const rows = await prisma.productReview.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { product: { select: { name: true, slug: true } } },
  });

  return rows.map((row) => ({
    ...toReview(row),
    authorEmail: row.authorEmail,
    productName: row.product.name,
    productSlug: row.product.slug,
  }));
}

export async function setReviewStatus(id: string, status: "approved" | "rejected"): Promise<void> {
  await prisma.productReview.update({
    where: { id },
    data: { status, approvedAt: status === "approved" ? new Date() : null },
  });
}
