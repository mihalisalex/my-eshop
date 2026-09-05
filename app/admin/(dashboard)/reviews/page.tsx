import Link from "next/link";
import { Star } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ListFilterBar } from "@/components/admin/ListFilterBar";
import { Pagination } from "@/components/admin/Pagination";
import { ReviewModerationRow } from "@/components/admin/ReviewModerationRow";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";
import { formatDate } from "@/lib/format";
import { DEFAULT_PAGE_SIZE, parsePage } from "@/lib/pagination";
import { listReviewsForAdmin, REVIEW_STATUS_FILTERS, type AdminReviewStatus } from "@/services/reviews";
import { cn } from "@/lib/utils";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

interface AdminReviewsPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

const STATUS_OPTIONS = REVIEW_STATUS_FILTERS.map((status) => ({
  value: status,
  label: status.charAt(0).toUpperCase() + status.slice(1),
}));

const STATUS_BADGE: Record<AdminReviewStatus, string> = {
  pending: "bg-luxe-gray-light text-luxe-black",
  approved: "bg-luxe-black text-luxe-white",
  rejected: "bg-transparent text-luxe-gray-dark border border-border",
};

/**
 * Every review, not only the ones awaiting a decision.
 *
 * Used to be the moderation queue alone — a verified purchaser's review publishes itself
 * and never passed through here, so there was no way to see, let alone remove, one an
 * owner disliked once it was already live. The "All" default plus a status filter is what
 * fixes that: everything is reachable, and Pending stays one click away for the days that
 * are really just triage.
 */
export default async function AdminReviewsPage({ searchParams }: AdminReviewsPageProps) {
  await requireCapabilityOrRedirect("content:reviews");
  const params = await searchParams;

  const status = REVIEW_STATUS_FILTERS.includes(params.status as AdminReviewStatus)
    ? (params.status as AdminReviewStatus)
    : undefined;

  const { rows, total, page, pageCount, pageSize } = await listReviewsForAdmin({
    status,
    page: parsePage(params.page),
    pageSize: DEFAULT_PAGE_SIZE,
  });

  return (
    <div>
      <AdminPageHeader
        title="Reviews"
        description={
          status
            ? `${total} ${status} review${total === 1 ? "" : "s"}.`
            : `${total} review${total === 1 ? "" : "s"} in total.`
        }
      />

      <ListFilterBar
        action="/admin/reviews"
        selects={[{ name: "status", label: "All statuses", value: status ?? "", options: STATUS_OPTIONS }]}
      />

      {rows.length === 0 ? (
        <p className="border border-dashed border-border p-8 text-center text-sm text-luxe-gray-dark">
          {status ? `No ${status} reviews.` : "No reviews yet."}
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((review) => (
            <div key={review.id} className="border border-border bg-luxe-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/products/${review.productSlug}`}
                      className="text-sm font-medium underline underline-offset-4"
                    >
                      {review.productName}
                    </Link>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-[10px] font-medium tracking-[0.05em] uppercase",
                        STATUS_BADGE[review.status]
                      )}
                    >
                      {review.status}
                    </span>
                  </div>
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

              <ReviewModerationRow id={review.id} status={review.status} />
            </div>
          ))}
        </div>
      )}

      <Pagination
        basePath="/admin/reviews"
        params={{ status }}
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        label="reviews"
      />
    </div>
  );
}
