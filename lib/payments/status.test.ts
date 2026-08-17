import { describe, expect, it } from "vitest";
import {
  PAYMENT_EVENT_LABEL,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  allowedTransitionsFrom,
  assertTransition,
  canTransition,
  eventTypeForStatus,
  isOutstanding,
  isSettled,
  isTerminalPaymentStatus,
} from "./status";
import type { PaymentStatus } from "./types";

const ALL_STATUSES: PaymentStatus[] = [
  "pending",
  "awaiting_customer_action",
  "awaiting_bank_transfer",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
  "expired",
];

describe("payment state machine", () => {
  it("allows the ordinary happy paths", () => {
    expect(canTransition("pending", "processing")).toBe(true);
    expect(canTransition("pending", "awaiting_customer_action")).toBe(true);
    expect(canTransition("awaiting_customer_action", "paid")).toBe(true);
    expect(canTransition("processing", "paid")).toBe(true);
    expect(canTransition("paid", "refunded")).toBe(true);
    expect(canTransition("paid", "partially_refunded")).toBe(true);
    expect(canTransition("partially_refunded", "refunded")).toBe(true);
  });

  it("refuses to un-settle money", () => {
    // The single most important rule here: nothing takes a payment back out of a
    // settled state except a refund.
    expect(canTransition("paid", "pending")).toBe(false);
    expect(canTransition("paid", "failed")).toBe(false);
    expect(canTransition("paid", "cancelled")).toBe(false);
    expect(canTransition("refunded", "paid")).toBe(false);
  });

  it("never revives a terminal payment", () => {
    for (const terminal of ["cancelled", "refunded", "expired"] as const) {
      expect(isTerminalPaymentStatus(terminal)).toBe(true);
      expect(allowedTransitionsFrom(terminal)).toHaveLength(0);
      for (const target of ALL_STATUSES) {
        if (target === terminal) continue;
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it("has no automatic path from awaiting_bank_transfer to processing", () => {
    // A bank transfer is unpaid until a human (or a future reconciliation API)
    // confirms it. An edge here would be the bug that ships goods for an unpaid
    // invoice.
    expect(canTransition("awaiting_bank_transfer", "processing")).toBe(false);
    expect(canTransition("awaiting_bank_transfer", "paid")).toBe(true);
  });

  it("lets a failed payment be retried but not silently settled", () => {
    expect(canTransition("failed", "pending")).toBe(true);
    expect(canTransition("failed", "paid")).toBe(false);
  });

  it("treats a repeated status as a no-op rather than an error", () => {
    // Duplicate `succeeded` webhooks and status polls after settlement are ordinary
    // traffic, not failures.
    for (const status of ALL_STATUSES) {
      expect(canTransition(status, status)).toBe(true);
    }
  });

  it("throws on an invalid transition", () => {
    expect(() => assertTransition("paid", "pending")).toThrow(/Invalid payment status transition/);
    expect(() => assertTransition("pending", "paid")).not.toThrow();
  });

  it("classifies settled and outstanding statuses", () => {
    expect(isSettled("paid")).toBe(true);
    expect(isSettled("partially_refunded")).toBe(true);
    expect(isSettled("pending")).toBe(false);

    expect(isOutstanding("awaiting_bank_transfer")).toBe(true);
    expect(isOutstanding("processing")).toBe(true);
    expect(isOutstanding("paid")).toBe(false);
    expect(isOutstanding("failed")).toBe(false);
  });

  it("has a label, a tone and an event type for every status", () => {
    // Guards against adding a status and forgetting the admin can't render it.
    for (const status of ALL_STATUSES) {
      expect(PAYMENT_STATUS_LABEL[status]).toBeTruthy();
      expect(PAYMENT_STATUS_TONE[status]).toBeTruthy();
      expect(PAYMENT_EVENT_LABEL[eventTypeForStatus(status)]).toBeTruthy();
    }
  });
});
