import reviewsData from "@/data/reviews.json";
import type { Review } from "@/types";

const reviews = reviewsData as Review[];

export async function getReviewsForProduct(productId: string): Promise<Review[]> {
  return reviews
    .filter((r) => r.productId === productId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export interface ReviewSummary {
  average: number;
  count: number;
}

export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
  const productReviews = await getReviewsForProduct(productId);
  if (productReviews.length === 0) return { average: 0, count: 0 };
  const average = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
  return { average: Math.round(average * 10) / 10, count: productReviews.length };
}
