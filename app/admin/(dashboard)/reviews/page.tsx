import Link from "next/link";
import { Star } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ReviewModerationRow } from "@/components/admin/ReviewModerationRow";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";
import { formatDate } from "@/lib/format";
import { getPendingReviews } from "@/services/reviews";
import { cn } from "@/lib/utils";

/**
 * The moderation queue.
 *
 * Only reviews awaiting a decision appear here. A review from someone with a delivered
 * order for that product was published the moment it was written and never enters this
 * list — see services/reviews.ts.
 */
export default async function AdminReviewsPage() {
  await requireCapabilityOrRedirect("content:reviews");
  const pending = await getPendingReviews();

  return (
    <div>
      <AdminPageHeader
        title="Reviews"
        description={
          pending.length === 0
            ? "Nothing waiting. Reviews from verified purchasers publish themselves; anything else appears here first."
            : `${pending.length} review${pending.length === 1 ? "" : "s"} waiting for a decision.`
        }
      />

      {pending.length === 0 ? (
        <p className="border border-dashed border-border p-8 text-center text-sm text-luxe-gray-dark">
          The queue is empty.
        </p>
      ) : (
        <div className="space-y-4">
          {pending.map((review) => (
            <div key={review.id} className="border border-border bg-luxe-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/products/${review.productSlug}`}
                    className="text-sm font-medium underline underline-offset-4"
                  >
                    {review.productName}
                  </Link>
                  <p className="mt-1 text-xs text-luxe-gray-dark">
                    {review.author} · {review.authorEmail} · {formatDate(review.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn("size-4", i < review.rating ? "fill-luxe-black text-luxe-black" : "text-border")}
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
              </div>

              <p className="mt-3 text-sm font-medium">{review.title}</p>
              <p className="mt-1 text-sm whitespace-pre-line text-luxe-gray-dark">{review.body}</p>

              <ReviewModerationRow id={review.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
