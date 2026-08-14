"use client";

import { useState, useTransition } from "react";
import { archiveProduct, restoreProduct, deleteProduct } from "@/app/admin/(dashboard)/products/actions";
import type { ProductStatus } from "@/types";

/**
 * Archive is the primary retirement action and hard delete is the exception, deliberately
 * de-emphasised: deleting a product cascades to CartLineItem/WishlistItem, so it empties
 * customers' carts and wishlists and destroys the record of what past orders contained.
 * Archiving takes it off the storefront while leaving all of that intact.
 */
export function ProductLifecycleActions({ id, name, status }: { id: string; name: string; status: ProductStatus }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error?: string } | void>, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await fn();
      setError(result && "error" in result ? (result.error ?? null) : null);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {status === "archived" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => restoreProduct(id))}
            className="h-9 border border-luxe-black px-4 text-xs font-medium tracking-[0.05em] uppercase disabled:opacity-50"
          >
            {isPending ? "Restoring…" : "Restore to draft"}
          </button>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => archiveProduct(id),
                `Archive "${name}"? It will be removed from the storefront but stays in past orders, carts and wishlists.`
              )
            }
            className="h-9 border border-luxe-black px-4 text-xs font-medium tracking-[0.05em] uppercase disabled:opacity-50"
          >
            {isPending ? "Archiving…" : "Archive"}
          </button>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            run(
              () => deleteProduct(id),
              `Permanently delete "${name}"?\n\nThis also removes it from every customer cart and wishlist that contains it, and cannot be undone. Archive instead if you only want it off the storefront.`
            )
          }
          className="h-9 border border-destructive px-4 text-xs font-medium tracking-[0.05em] text-destructive uppercase disabled:opacity-50"
        >
          Delete
        </button>
      </div>
      {error ? <p className="max-w-xs text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
