"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { deleteReview, setReviewStatus } from "@/services/reviews";
import { recordAdminAction } from "@/services/audit-log";

export interface ReviewActionState {
  error?: string;
}

/**
 * Approving or rejecting one review.
 *
 * The product's slug is read before the status changes, so the storefront page can be
 * rebuilt — an approved review that only appears after the next deploy is, to the shopper
 * who wrote it, indistinguishable from one that was silently thrown away.
 */
async function decide(id: string, status: "approved" | "rejected"): Promise<ReviewActionState> {
  await requireCapability("content:reviews");

  const review = await prisma.productReview.findUnique({
    where: { id },
    select: { product: { select: { slug: true } } },
  });
  if (!review) return { error: "That review no longer exists." };

  await setReviewStatus(id, status);
  revalidatePath(`/products/${review.product.slug}`);
  revalidatePath("/admin/reviews");
  return {};
}

export async function approveReview(id: string): Promise<ReviewActionState> {
  return decide(id, "approved");
}

export async function rejectReview(id: string): Promise<ReviewActionState> {
  return decide(id, "rejected");
}

/**
 * Removes a review outright — the one action available on every review regardless of
 * status, not only pending ones. Rejecting an already-approved review would also do the
 * job of taking it off the storefront, but this is for when an owner wants it actually
 * gone, not just hidden and kept on record.
 *
 * Same read-slug-before-write shape as `decide` above, for the same reason: the storefront
 * page has to be rebuilt so a deleted review does not linger in a cached render.
 */
export async function deleteReviewAction(id: string): Promise<ReviewActionState> {
  await requireCapability("content:reviews");

  /**
   * OBS-003. The author, rating and text are captured BEFORE the delete, because after it
   * there is nothing left to describe. An audit entry reading only "a review was deleted"
   * answers none of the questions actually asked of it — which review, by whom, saying what.
   */
  const review = await prisma.productReview.findUnique({
    where: { id },
    select: {
      rating: true,
      title: true,
      authorName: true,
      product: { select: { slug: true, sku: true } },
    },
  });
  if (!review) return { error: "That review no longer exists." };

  await deleteReview(id);

  await recordAdminAction({
    action: "review.deleted",
    targetType: "review",
    targetId: id,
    summary: `Deleted a ${review.rating}★ review by ${review.authorName} on ${review.product.sku}`,
    metadata: {
      rating: review.rating,
      title: review.title,
      authorName: review.authorName,
      productSku: review.product.sku,
    },
  });

  revalidatePath(`/products/${review.product.slug}`);
  revalidatePath("/admin/reviews");
  return {};
}
