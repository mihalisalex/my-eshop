import type { Money } from "./common";

/**
 * Catalog-level Discount/GiftCard shapes — real Prisma-backed models now
 * (Real Backend Phase 2), shared by the admin CRUD pages and by
 * `lib/commerce/providers/*`'s cart validation. Distinct from
 * `lib/commerce/types.ts`'s `AppliedDiscount`/`AppliedGiftCard`, which are the
 * cart-scoped snapshot of a code *as applied to one cart*, not the catalog record.
 */

export interface Discount {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  active: boolean;
  expiresAt?: string;
}

export interface GiftCard {
  id: string;
  code: string;
  balance: Money;
  active: boolean;
}
