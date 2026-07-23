import type { ProductFormValues } from "@/lib/validation/product";

export interface ImportRowResult {
  rowNumber: number;
  /** Null when mapping/validation failed — see `errors`. */
  values: ProductFormValues | null;
  errors: string[];
  /** Non-blocking, e.g. "A product with this slug already exists — this row will update it." */
  warning?: string;
  /** Set when this row's slug matches an existing product (update instead of create). */
  existingId?: string;
}

/** Returned by the commit route — one entry per submitted row, success or failure. */
export interface CommitRowResult {
  rowNumber: number;
  ok: boolean;
  error?: string;
}
