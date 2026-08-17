import { describe, expect, it } from "vitest";
import { derivePaymentIdempotencyKey } from "./idempotency";

describe("derivePaymentIdempotencyKey", () => {
  it("is stable for the same order and method, so a retry finds the existing payment", () => {
    // The double-click / refresh / dropped-connection case: identical inputs must
    // produce the identical key, which then collides with the stored payment.
    const a = derivePaymentIdempotencyKey("order_123", "cash-on-delivery");
    const b = derivePaymentIdempotencyKey("order_123", "cash-on-delivery");
    expect(a).toBe(b);
  });

  it("differs per order", () => {
    expect(derivePaymentIdempotencyKey("order_1", "stripe-card")).not.toBe(
      derivePaymentIdempotencyKey("order_2", "stripe-card")
    );
  });

  it("differs per method — switching after a decline genuinely is a new attempt", () => {
    expect(derivePaymentIdempotencyKey("order_1", "stripe-card")).not.toBe(
      derivePaymentIdempotencyKey("order_1", "cash-on-delivery")
    );
  });

  it("differs per attempt, so a deliberate retry of the same method starts fresh", () => {
    expect(derivePaymentIdempotencyKey("order_1", "stripe-card", 0)).not.toBe(
      derivePaymentIdempotencyKey("order_1", "stripe-card", 1)
    );
  });

  it("is fixed-length and reveals nothing about the order id", () => {
    const key = derivePaymentIdempotencyKey("order_abc123", "stripe-card");
    expect(key).toMatch(/^pay_[0-9a-f]{32}$/);
    expect(key).not.toContain("order_abc123");
  });
});
