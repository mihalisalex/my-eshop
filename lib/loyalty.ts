export interface LoyaltyTier {
  id: "member" | "silver" | "gold" | "platinum";
  label: string;
  /** Lifetime spend (EUR) required to reach this tier. */
  threshold: number;
  perks: string[];
}

/**
 * Real, computed from the customer's actual completed orders (see `getLoyaltyTier`)
 * — never stored, matching this app's existing "derive from source data, don't
 * persist a duplicate" convention for totals elsewhere (cart/order totals).
 * Thresholds/perks are illustrative business config, the same honesty level as the
 * flat 21% VAT rate documented in `lib/shipping.ts`.
 */
export const LOYALTY_TIERS: LoyaltyTier[] = [
  { id: "member", label: "Member", threshold: 0, perks: ["Free standard shipping over €150", "Access to new arrivals"] },
  { id: "silver", label: "Silver", threshold: 500, perks: ["Free standard shipping over €150", "Early access to sale", "Birthday gift"] },
  { id: "gold", label: "Gold", threshold: 1500, perks: ["Free standard shipping, always", "Early access to sale", "Birthday gift", "Priority customer support"] },
  { id: "platinum", label: "Platinum", threshold: 4000, perks: ["Free express shipping, always", "First access to new collections", "Birthday gift", "A dedicated stylist contact"] },
];

export function getLoyaltyTier(lifetimeSpend: number): LoyaltyTier {
  let current = LOYALTY_TIERS[0];
  for (const tier of LOYALTY_TIERS) {
    if (lifetimeSpend >= tier.threshold) current = tier;
  }
  return current;
}

export function getNextLoyaltyTier(lifetimeSpend: number): LoyaltyTier | null {
  const next = LOYALTY_TIERS.find((tier) => tier.threshold > lifetimeSpend);
  return next ?? null;
}
