"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { approveReview, deleteReviewAction, rejectReview } from "@/app/admin/(dashboard)/reviews/actions";
import type { AdminReviewStatus } from "@/services/reviews";

/**
 * Approve / reject / delete, with the outcome shown rather than assumed.
 *
 * `useTransition` rather than a plain await so every button disables while any one of them
 * is in flight — a double-click on Approve is otherwise two writes and two page rebuilds.
 */
export function ReviewModerationRow({ id, status }: { id: string; status: AdminReviewStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(id);
      if (result?.error) setError(result.error);
    });
  }

  function handleDelete() {
    // Delete is the one irreversible action here — reject only hides a review, this
    // removes the row. Same confirm pattern as every other permanent delete in the admin.
    if (!window.confirm("Delete this review? This can't be undone.")) return;
    run(deleteReviewAction);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
      {status === "pending" ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(approveReview)}
            className="h-9 bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(rejectReview)}
            className="h-9 border border-border px-4 text-xs font-medium tracking-[0.05em] uppercase transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
          >
            Reject
          </button>
        </>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="ml-auto flex items-center gap-1.5 text-xs font-medium tracking-[0.05em] text-destructive uppercase disabled:opacity-50"
      >
        <Trash2 className="size-3.5" strokeWidth={1.5} />
        Delete
      </button>
      {/* Rejecting hides a PENDING review from the storefront while keeping the row, so the
          same address writing the same thing again is recognisable. Delete removes it
          outright and is available regardless of status. */}
      {error ? <span className="w-full text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
