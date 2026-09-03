"use client";

import { useState, useTransition } from "react";
import { approveReview, rejectReview } from "@/app/admin/(dashboard)/reviews/actions";

/**
 * Approve / reject, with the outcome shown rather than assumed.
 *
 * `useTransition` rather than a plain await so both buttons disable while either is in
 * flight — a double-click on Approve is otherwise two writes and two page rebuilds.
 */
export function ReviewModerationRow({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (id: string) => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
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
      {/* Rejecting hides it from the storefront; the row is kept so the same address
          writing the same thing again is recognisable. */}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
