"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";

interface DeleteRowButtonProps {
  id: string;
  onDelete: (id: string) => Promise<void>;
  confirmMessage?: string;
}

/** Generic delete-row action for admin list pages (Discounts, Gift Cards) that have no dedicated detail page to redirect from. */
export function DeleteRowButton({ id, onDelete, confirmMessage = "Delete this item? This can't be undone." }: DeleteRowButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(confirmMessage)) return;
        startTransition(async () => {
          await onDelete(id);
        });
      }}
      className="text-destructive underline underline-offset-4 disabled:opacity-50"
      aria-label="Delete"
    >
      <Trash2 className="size-4" strokeWidth={1.5} />
    </button>
  );
}
