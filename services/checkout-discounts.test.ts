import { describe, expect, it } from "vitest";
import { filterValidDiscounts } from "@/services/checkout";

const NOW = new Date("2026-09-01T12:00:00Z");
const applied = [{ code: "SUMMER10", type: "percentage" as const, value: 10 }];

/**
 * A cart is long-lived. `applyDiscountCode` checks `active` and `expiresAt` at the moment
 * the shopper types the code, and then the cart row keeps the rule indefinitely — so the
 * only thing standing between a lapsed promo code and a discounted order is this filter.
 */
describe("filterValidDiscounts", () => {
  it("keeps a code that is active and unexpired", () => {
    const live = [{ code: "SUMMER10", active: true, expiresAt: new Date("2026-12-01") }];
    expect(filterValidDiscounts(applied, live, NOW)).toHaveLength(1);
  });

  it("keeps a code with no expiry at all", () => {
    expect(filterValidDiscounts(applied, [{ code: "SUMMER10", active: true, expiresAt: null }], NOW)).toHaveLength(1);
  });

  it("drops a code that expired after the shopper applied it", () => {
    const live = [{ code: "SUMMER10", active: true, expiresAt: new Date("2026-08-01") }];
    expect(filterValidDiscounts(applied, live, NOW)).toEqual([]);
  });

  it("drops a code an admin deactivated after the shopper applied it", () => {
    const live = [{ code: "SUMMER10", active: false, expiresAt: null }];
    expect(filterValidDiscounts(applied, live, NOW)).toEqual([]);
  });

  it("drops a code whose discount row has been deleted entirely", () => {
    expect(filterValidDiscounts(applied, [], NOW)).toEqual([]);
  });

  it("treats expiry as end-inclusive, so a code does not lapse mid-checkout on its last second", () => {
    const live = [{ code: "SUMMER10", active: true, expiresAt: NOW }];
    expect(filterValidDiscounts(applied, live, NOW)).toHaveLength(1);
  });

  it("keeps the valid codes and drops the rest when several are applied", () => {
    const many = [
      { code: "GOOD", type: "fixed" as const, value: 5 },
      { code: "EXPIRED", type: "fixed" as const, value: 5 },
      { code: "OFF", type: "fixed" as const, value: 5 },
    ];
    const live = [
      { code: "GOOD", active: true, expiresAt: null },
      { code: "EXPIRED", active: true, expiresAt: new Date("2020-01-01") },
      { code: "OFF", active: false, expiresAt: null },
    ];
    expect(filterValidDiscounts(many, live, NOW).map((d) => d.code)).toEqual(["GOOD"]);
  });
});
