"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { setReviewStatus } from "@/services/reviews";

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
