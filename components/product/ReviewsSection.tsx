import { getTranslations } from "next-intl/server";
import { Star, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { Review } from "@/types";
import type { ReviewSummary } from "@/services/reviews";

interface ReviewsSectionProps {
  summary: ReviewSummary;
  reviews: Review[];
}

function Stars({ rating, size = "size-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(size, i < Math.round(rating) ? "fill-luxe-black text-luxe-black" : "text-border")}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

export async function ReviewsSection({ summary, reviews }: ReviewsSectionProps) {
  // Server Component, so getTranslations rather than the useTranslations hook.
  const t = await getTranslations("Reviews");
  if (summary.count === 0) {
    return (
      <section id="reviews" className="border-t border-border py-10">
        <h2 className="font-heading text-2xl">{t("title")}</h2>
        <p className="mt-2 text-sm text-luxe-gray-dark">No reviews yet — be the first to share your fit and feel.</p>
      </section>
    );
  }

  return (
    <section id="reviews" className="border-t border-border py-10">
      <div className="flex items-center gap-4">
        <h2 className="font-heading text-2xl">{t("title")}</h2>
        <Stars rating={summary.average} />
        <p className="text-sm text-luxe-gray-dark">
          {summary.average} out of 5 ({summary.count} review{summary.count === 1 ? "" : "s"})
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {reviews.map((review) => (
          <div key={review.id} className="border border-border p-5">
            <div className="flex items-center justify-between">
              <Stars rating={review.rating} size="size-3.5" />
              <span className="text-xs text-luxe-gray-dark">{formatDate(review.createdAt)}</span>
            </div>
            <p className="mt-3 text-sm font-medium">{review.title}</p>
            <p className="mt-1 text-sm text-luxe-gray-dark">{review.body}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-luxe-gray-dark">
              {review.verifiedPurchase ? <BadgeCheck className="size-3.5" strokeWidth={1.5} /> : null}
              <span>{review.author}</span>
              {review.verifiedPurchase ? <span>· Verified Purchase</span> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
