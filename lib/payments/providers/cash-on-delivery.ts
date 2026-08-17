import "server-only";
import type {
  ConfigurationTestResult,
  PaymentContext,
  PaymentMethodDefinition,
  PaymentProvider,
  PaymentResult,
  PaymentStatusResult,
  RefundContext,
} from "@/lib/payments/types";
import { PaymentError } from "@/lib/payments/types";

/**
 * Cash on Delivery — a real payment method, not a checkout special case (§4).
 *
 * The distinction matters: because COD goes through the same provider contract as
 * Stripe, a COD order gets a real Payment row, a real status machine, a real audit
 * trail, real refund handling and a real place in the admin's payment reporting.
 * The version of this that most shops end up with — an `if (method === "cod")`
 * branch that skips payment entirely — is exactly what makes COD invisible to
 * accounting and impossible to reconcile.
 *
 * It has no `configFields` at all: everything a store wants to tune about COD (the
 * fee, the order-value limits, the countries, which shipping rates allow it) is
 * merchandising configuration, which lives in PaymentMethodSetting alongside every
 * other method's. Credentials are the only thing `configFields` is for, and COD
 * has none.
 */

const COD_METHOD: PaymentMethodDefinition = {
  id: "cash-on-delivery",
  providerId: "cash-on-delivery",
  name: "Cash on Delivery",
  defaultDisplayName: "Cash on Delivery",
  defaultDescription: "Pay the courier in cash when your order arrives.",
  type: "offline",
  defaultEnabled: true,
  requiresRedirect: false,
  // The whole point: the money is only real once a human confirms it was handed over.
  requiresManualConfirmation: true,
  requiresWebhook: false,
  supportsRefunds: true,
  supportsPartialRefunds: true,
  // Nothing to authorise, so nothing to capture later.
  supportsCapture: false,
  supportsRecurring: false,
  supportedCurrencies: "any",
  icon: "cash",
};

export const cashOnDeliveryProvider: PaymentProvider = {
  id: "cash-on-delivery",
  name: "Cash on Delivery",
  description: "Collect payment in cash when the courier delivers the order. No external account required.",
  methods: [COD_METHOD],
  configFields: [],
  supportsEnvironments: false,
  defaultEnabled: true,
  supportsConnectionTest: false,
  webhookSupported: false,

  isConfigured() {
    // Nothing to configure, so it is always ready. This is what makes a fresh
    // install have a working checkout before any credentials exist anywhere.
    return true;
  },

  async validateConfiguration(): Promise<ConfigurationTestResult> {
    return {
      status: "connected",
      message: "Cash on Delivery is handled entirely in-house — there is no external service to connect to.",
      // Explicitly false: no request was made, and the type forces us to say so
      // rather than letting a green tick imply a verified integration.
      checkedLive: false,
    };
  },

  async initializePayment(ctx: PaymentContext): Promise<PaymentResult> {
    return {
      status: "pending",
      customerAction: {
        type: "display_instructions",
        message: "Please have the exact amount ready for the courier.",
        instructions: [
          { label: "Amount due on delivery", value: `${ctx.payment.amount.amount.toFixed(2)} ${ctx.payment.amount.currencyCode}` },
          { label: "Order reference", value: orderReference(ctx.payment.orderId) },
        ],
      },
      metadata: { collectedInCash: false },
    };
  },

  /** Reached only through the admin's "Mark as collected" action, which is capability-gated. */
  async confirmPayment(): Promise<PaymentResult> {
    return { status: "paid", metadata: { collectedInCash: true } };
  },

  async cancelPayment(): Promise<PaymentResult> {
    return { status: "cancelled" };
  },

  /**
   * A COD refund is cash handed back, not an API call — so this records the fact
   * and the amount, and the admin performs the actual repayment. Recording it
   * anyway is the point: otherwise refunded COD orders exist only in someone's
   * memory.
   */
  async refundPayment(ctx: RefundContext): Promise<PaymentResult> {
    const alreadyRefunded = ctx.payment.refundedAmount.amount;
    const total = alreadyRefunded + ctx.amount.amount;
    if (total > ctx.payment.amount.amount + 0.005) {
      throw new PaymentError("REFUND_AMOUNT_INVALID", "Refund would exceed the amount collected.");
    }
    const isFull = total >= ctx.payment.amount.amount - 0.005;
    return {
      status: isFull ? "refunded" : "partially_refunded",
      refundedAmount: { amount: total, currencyCode: ctx.payment.amount.currencyCode },
      metadata: { refundMethod: "manual_cash" },
    };
  },

  /** No external system holds a truth we could poll — the stored status IS the truth. */
  async getPaymentStatus(ctx: PaymentContext): Promise<PaymentStatusResult> {
    return { status: ctx.payment.status };
  },
};

/** Same short form the admin order pages already use, so a courier slip and the dashboard agree. */
function orderReference(orderId: string): string {
  return orderId.slice(-8).toUpperCase();
}
