import { describe, expect, it } from "vitest";
import { computePaymentFee, describePaymentFee } from "./fees";

describe("computePaymentFee", () => {
  it("returns zero when no fee is configured", () => {
    expect(computePaymentFee({ feeType: "none", feeValue: 2 }, 100)).toBe(0);
  });

  it("applies a fixed fee regardless of order size", () => {
    expect(computePaymentFee({ feeType: "fixed", feeValue: 2 }, 100)).toBe(2);
    expect(computePaymentFee({ feeType: "fixed", feeValue: 2 }, 1000)).toBe(2);
  });

  it("applies a percentage fee against the order total and rounds to cents", () => {
    expect(computePaymentFee({ feeType: "percentage", feeValue: 2 }, 100)).toBe(2);
    expect(computePaymentFee({ feeType: "percentage", feeValue: 2.5 }, 39.99)).toBe(1);
    expect(computePaymentFee({ feeType: "percentage", feeValue: 1.5 }, 33.33)).toBe(0.5);
  });

  it("never produces a negative fee, whatever the configuration says", () => {
    // A negative fee would be a discount smuggled in through the payments config.
    expect(computePaymentFee({ feeType: "fixed", feeValue: -5 }, 100)).toBe(0);
    expect(computePaymentFee({ feeType: "percentage", feeValue: -10 }, 100)).toBe(0);
  });

  it("charges nothing against a zero or negative base", () => {
    expect(computePaymentFee({ feeType: "fixed", feeValue: 2 }, 0)).toBe(0);
    expect(computePaymentFee({ feeType: "percentage", feeValue: 2 }, 0)).toBe(0);
  });

  it("tolerates a non-numeric configured value rather than producing NaN", () => {
    // A NaN fee would propagate into the order total and produce an uncharged order.
    expect(computePaymentFee({ feeType: "fixed", feeValue: Number.NaN }, 100)).toBe(0);
  });
});

describe("describePaymentFee", () => {
  it("describes fixed and percentage fees, and omits an absent one", () => {
    expect(describePaymentFee({ feeType: "fixed", feeValue: 2 }, "EUR")).toBe("+€2.00");
    expect(describePaymentFee({ feeType: "percentage", feeValue: 2 }, "EUR")).toBe("+2%");
    expect(describePaymentFee({ feeType: "none", feeValue: 0 }, "EUR")).toBeNull();
    expect(describePaymentFee({ feeType: "fixed", feeValue: 0 }, "EUR")).toBeNull();
  });
});
