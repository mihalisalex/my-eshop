/**
 * Editable shipping configuration, stored in the `SiteContent` "shipping" row and edited at
 * /admin/settings/shipping. Previously these were constants in `lib/shipping.ts`, so changing
 * free shipping from €150 to €100 meant a code edit and a deploy.
 */
export interface ShippingRateSetting {
  /**
   * Stable identifier. It is persisted on every checkout and order row, so renaming one
   * orphans the rate on historical orders — the admin form does not let you edit it.
   */
  id: string;
  label: string;
  description: string;
  estimatedDelivery: string;
  /** VAT-inclusive, like every other customer-facing amount in this shop. */
  amount: number;
  /** A disabled rate disappears from checkout but stays readable on orders that used it. */
  enabled: boolean;
  /**
   * Whether the free-shipping threshold applies to this rate.
   *
   * Standard is the rate the sitewide "free over €150" promise is about; Express is a paid
   * upgrade and costs its listed price at any basket size. That distinction used to be a
   * hardcoded `rate.id === "standard"` comparison, which meant a third rate could never be
   * free without a code change.
   */
  freeShippingEligible: boolean;
}

export interface ShippingSettings {
  /**
   * Order value (after discounts, before shipping) at or above which eligible rates cost
   * nothing. `null` disables free shipping entirely rather than setting an unreachable
   * number, so the intent is readable in the data.
   */
  freeShippingThreshold: number | null;
  rates: ShippingRateSetting[];
}
