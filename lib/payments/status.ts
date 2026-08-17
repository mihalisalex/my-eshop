import { TERMINAL_PAYMENT_STATUSES, type PaymentEventType, type PaymentStatus } from "@/lib/payments/types";

/**
 * The payment state machine.
 *
 * Every status change in this app goes through `assertTransition` on the server.
 * Nothing in the browser can set a payment status — the checkout can only ask to
 * *start* a payment, and the admin can only take named actions (mark collected,
 * mark received, refund) whose legality is decided here. That's §12's "do not
 * allow arbitrary status changes from random frontend code", implemented as a
 * single chokepoint rather than as a rule everyone has to remember.
 */
const ALLOWED_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  // A freshly created payment can go anywhere its provider takes it.
  pending: [
    "awaiting_customer_action",
    "awaiting_bank_transfer",
    "processing",
    "paid",
    "failed",
    "cancelled",
    "expired",
  ],
  // 3DS, a redirect, a wallet sheet. The customer may also abandon it.
  awaiting_customer_action: ["processing", "paid", "failed", "cancelled", "expired"],
  // Waiting on a human to send money. Can never jump to `processing` — there is
  // no intermediate machine state; it's unpaid until an admin (or a future
  // reconciliation API) confirms receipt.
  awaiting_bank_transfer: ["paid", "cancelled", "expired", "failed"],
  processing: ["paid", "failed", "cancelled"],
  // Settled money can only move to a refund state.
  paid: ["refunded", "partially_refunded"],
  // A second partial refund is legal, as is topping up to a full one.
  partially_refunded: ["partially_refunded", "refunded"],
  // A failed attempt can legitimately be retried (a shopper fixes their card),
  // which returns the payment to `pending` rather than creating a second row.
  failed: ["pending", "cancelled"],
  cancelled: [],
  refunded: [],
  // Deliberately terminal: a provider that expires a session issues a new one
  // rather than reviving the old, and reviving it would let a stale QR code or
  // redirect settle an order the shopper has since abandoned.
  expired: [],
};

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return TERMINAL_PAYMENT_STATUSES.includes(status);
}

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  // A no-op re-assertion is always allowed: providers and webhooks routinely
  // report the status a payment is already in (a duplicate `succeeded` webhook,
  // a status poll after settlement). Treating that as an error would turn
  // ordinary retry traffic into noise — but it must NOT re-run side effects,
  // which is why services/payments.ts checks for an actual change separately.
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid payment status transition: ${from} → ${to}`);
  }
}

export function allowedTransitionsFrom(status: PaymentStatus): readonly PaymentStatus[] {
  return ALLOWED_TRANSITIONS[status] ?? [];
}

/** The event to log when a payment reaches a given status. */
export function eventTypeForStatus(status: PaymentStatus): PaymentEventType {
  switch (status) {
    case "pending":
      return "payment_pending";
    case "awaiting_customer_action":
      return "payment_requires_action";
    case "awaiting_bank_transfer":
      return "payment_pending";
    case "processing":
      return "payment_processing";
    case "paid":
      return "payment_succeeded";
    case "failed":
      return "payment_failed";
    case "cancelled":
      return "payment_cancelled";
    case "expired":
      return "payment_expired";
    case "refunded":
      return "payment_refunded";
    case "partially_refunded":
      return "payment_partially_refunded";
  }
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  awaiting_customer_action: "Awaiting customer",
  awaiting_bank_transfer: "Awaiting bank transfer",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  expired: "Expired",
};

/** Drives the status pill's colour in the admin. Kept next to the labels so a new status can't be added without a considered tone. */
export const PAYMENT_STATUS_TONE: Record<PaymentStatus, "positive" | "pending" | "negative" | "neutral"> = {
  pending: "pending",
  awaiting_customer_action: "pending",
  awaiting_bank_transfer: "pending",
  processing: "pending",
  paid: "positive",
  failed: "negative",
  cancelled: "neutral",
  refunded: "neutral",
  partially_refunded: "neutral",
  expired: "neutral",
};

export const PAYMENT_EVENT_LABEL: Record<PaymentEventType, string> = {
  payment_created: "Payment created",
  payment_pending: "Payment pending",
  payment_requires_action: "Awaiting customer action",
  payment_processing: "Payment processing",
  payment_succeeded: "Payment succeeded",
  payment_failed: "Payment failed",
  payment_cancelled: "Payment cancelled",
  payment_expired: "Payment expired",
  payment_refunded: "Payment refunded",
  payment_partially_refunded: "Payment partially refunded",
  webhook_received: "Webhook received",
  manual_payment_confirmation: "Manual confirmation",
  provider_error: "Provider error",
  configuration_tested: "Connection tested",
};

/**
 * Statuses that mean "the store has the money". Used by reporting and by the
 * order-side view of a payment — never as a substitute for the payment status
 * itself (§13).
 */
export function isSettled(status: PaymentStatus): boolean {
  return status === "paid" || status === "partially_refunded";
}

/** Statuses that still expect something to happen. Drives the "Pending payments" dashboard card. */
export function isOutstanding(status: PaymentStatus): boolean {
  return (
    status === "pending" ||
    status === "awaiting_customer_action" ||
    status === "awaiting_bank_transfer" ||
    status === "processing"
  );
}
