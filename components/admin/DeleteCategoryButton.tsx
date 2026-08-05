"use client";

import { useState, useTransition } from "react";
import { deleteCategory } from "@/app/admin/(dashboard)/categories/actions";

/** Standalone confirm+delete control for the category detail page header — separate from
 * CategoryTree's own inline row delete button, which is laid out too differently to share
 * this markup, but both call the same `deleteCategory` action and surface the same
 * "still has children/products" validation error inline instead of a raw form submit. */
export function DeleteCategoryButton({ id, name }: { id: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="h-9 border border-destructive px-4 text-xs font-medium tracking-[0.05em] text-destructive uppercase disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Delete Category"}
      </button>
      {error ? <p className="mt-2 max-w-xs text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
