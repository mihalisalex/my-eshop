"use client";

import { X } from "lucide-react";
import { deleteProduct } from "@/app/admin/(dashboard)/products/actions";

interface DeleteProductButtonProps {
  productId: string;
  productName: string;
}

/** A quick delete affordance for the products list — same deleteProduct action as the product detail page's "Delete Product" button, just reachable without opening the product first. Gated by a native confirm() since there's no undo. */
export function DeleteProductButton({ productId, productName }: DeleteProductButtonProps) {
  const boundDelete = deleteProduct.bind(null, productId);

  return (
    <form
      action={boundDelete}
      onSubmit={(event) => {
        if (!confirm(`Delete "${productName}"? This can't be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        aria-label={`Delete ${productName}`}
        className="flex size-7 items-center justify-center text-luxe-gray-dark transition-colors hover:text-destructive"
      >
        <X className="size-4" strokeWidth={1.5} />
      </button>
    </form>
  );
}
