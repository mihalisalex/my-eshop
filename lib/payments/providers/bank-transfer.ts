import "server-only";
import type {
  ConfigurationTestResult,
  PaymentConfigField,
  PaymentContext,
  PaymentMethodDefinition,
  PaymentProvider,
  PaymentResult,
  PaymentStatusResult,
  RefundContext,
  ResolvedProviderConfig,
} from "@/lib/payments/types";
import { PaymentError } from "@/lib/payments/types";

/**
 * Direct Bank Transfer (§5).
 *
 * The critical rule this provider encodes: creating the order does NOT mark it
 * paid. The payment lands in `awaiting_bank_transfer` and stays there until a
 * human — or, later, a reconciliation API — confirms the money actually arrived.
 * Any implementation that flips it to paid at checkout is handing out goods for
 * an unpaid invoice, which is why the state machine has no
 * `awaiting_bank_transfer → processing` edge at all: there is no automatic path
 * to settlement.
 *
 * None of these config fields are secrets: an IBAN is printed on invoices and
 * given to customers by design. They are still stored server-side and rendered
 * through the same configuration pipeline as real credentials, so a future bank
 * API's key (see `reconciliationNote`) slots in with no structural change.
 */

const CONFIG_FIELDS: readonly PaymentConfigField[] = [
  {
    key: "bankName",
    label: "Bank name",
    type: "text",
    secret: false,
    required: true,
    placeholder: "Piraeus Bank",
  },
  {
    key: "accountHolder",
    label: "Account holder",
    type: "text",
    secret: false,
    required: true,
    placeholder: "ALEXANDRIS S.A.",
    help: "The name exactly as it appears on the account — some banks reject transfers where it doesn't match.",
  },
  { key: "iban", label: "IBAN", type: "text", secret: false, required: true, placeholder: "GR96 0000 0000 0000 0000 0000 000" },
  { key: "swift", label: "SWIFT / BIC", type: "text", secret: false, required: false, placeholder: "PIRBGRAA" },
  { key: "branch", label: "Branch", type: "text", secret: false, required: false },
  {
    key: "instructions",
    label: "Payment instructions",
    type: "textarea",
    secret: false,
    required: false,
    help: "Shown to the customer under the bank details. Use it for anything specific to your bank, e.g. how long transfers take to clear.",
  },
  {
    key: "useOrderNumberAsReference",
    label: "Use the order number as the payment reference",
    type: "boolean",
    secret: false,
    required: false,
    help: "Strongly recommended — it is what lets you match an incoming transfer to an order.",
  },
] as const;

const BANK_TRANSFER_METHOD: PaymentMethodDefinition = {
  id: "bank-transfer",
  providerId: "bank-transfer",
  name: "Direct Bank Transfer",
  defaultDisplayName: "Bank Transfer",
  defaultDescription: "Transfer the total to our bank account. Your order ships once the payment clears.",
  type: "manual_bank_transfer",
  defaultEnabled: true,
  requiresRedirect: false,
  requiresManualConfirmation: true,
  // No webhook today. The seam exists (see `reconciliationNote`) for a bank API
  // that can confirm receipt automatically — connecting one would not change
  // anything about how checkout or the order system behaves.
  requiresWebhook: false,
  supportsRefunds: true,
  supportsPartialRefunds: true,
  supportsCapture: false,
  supportsRecurring: false,
  supportedCurrencies: "any",
  icon: "bank",
};

function isTruthy(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "on";
}

export const bankTransferProvider: PaymentProvider = {
  id: "bank-transfer",
  name: "Direct Bank Transfer",
  description: "Show your bank details at checkout and confirm each transfer manually once it lands.",
  methods: [BANK_TRANSFER_METHOD],
  configFields: CONFIG_FIELDS,
  supportsEnvironments: false,
  defaultEnabled: true,
  // There is no bank API connected, so offering a "Test Connection" button would
  // be offering to test nothing. The admin screen instead validates that the
  // required details are filled in.
  supportsConnectionTest: false,
  webhookSupported: false,

  isConfigured(config: ResolvedProviderConfig): boolean {
    return Boolean(config.values.accountHolder?.trim() && config.values.iban?.trim() && config.values.bankName?.trim());
  },

  async validateConfiguration(config: ResolvedProviderConfig): Promise<ConfigurationTestResult> {
    const missing = CONFIG_FIELDS.filter((field) => field.required && !config.values[field.key]?.trim()).map(
      (field) => field.label
    );
    if (missing.length > 0) {
      return {
        status: "not_configured",
        message: `Missing required bank details: ${missing.join(", ")}.`,
        checkedLive: false,
      };
    }
    return {
      status: "connected",
      message: "Bank details are complete. Transfers are confirmed manually from the payment's detail page.",
      checkedLive: false,
    };
  },

  async initializePayment(ctx: PaymentContext): Promise<PaymentResult> {
    const { values } = ctx.config;
    if (!this.isConfigured(ctx.config)) {
      throw new PaymentError(
        "PROVIDER_NOT_CONFIGURED",
        "Bank transfer is enabled but its bank details are incomplete.",
        "Bank transfer isn't available right now. Please choose another payment method."
      );
    }

    const reference = isTruthy(values.useOrderNumberAsReference) ? orderReference(ctx.payment.orderId) : null;

    const instructions = [
      { label: "Bank", value: values.bankName ?? "" },
      { label: "Account holder", value: values.accountHolder ?? "" },
      { label: "IBAN", value: values.iban ?? "" },
      ...(values.swift ? [{ label: "SWIFT / BIC", value: values.swift }] : []),
      ...(values.branch ? [{ label: "Branch", value: values.branch }] : []),
      {
        label: "Amount",
        value: `${ctx.payment.amount.amount.toFixed(2)} ${ctx.payment.amount.currencyCode}`,
      },
      ...(reference ? [{ label: "Payment reference", value: reference }] : []),
    ];

    return {
      status: "awaiting_bank_transfer",
      customerAction: {
        type: "display_instructions",
        message:
          values.instructions?.trim() ||
          "Please include the payment reference so we can match your transfer to this order. We'll confirm by email once it clears.",
        instructions,
      },
      metadata: { reference, iban: values.iban ?? null },
    };
  },

  /** The admin's "Mark as received" action. Duplicate confirmations are stopped upstream by the state machine, not here. */
  async confirmPayment(): Promise<PaymentResult> {
    return { status: "paid", metadata: { confirmedManually: true } };
  },

  async cancelPayment(): Promise<PaymentResult> {
    return { status: "cancelled" };
  },

  async refundPayment(ctx: RefundContext): Promise<PaymentResult> {
    const total = ctx.payment.refundedAmount.amount + ctx.amount.amount;
    if (total > ctx.payment.amount.amount + 0.005) {
      throw new PaymentError("REFUND_AMOUNT_INVALID", "Refund would exceed the amount received.");
    }
    const isFull = total >= ctx.payment.amount.amount - 0.005;
    return {
      status: isFull ? "refunded" : "partially_refunded",
      refundedAmount: { amount: total, currencyCode: ctx.payment.amount.currencyCode },
      metadata: { refundMethod: "manual_bank_transfer" },
    };
  },

  async getPaymentStatus(ctx: PaymentContext): Promise<PaymentStatusResult> {
    // Nothing to poll: no bank API is connected. When one is, this is the single
    // function that changes — it would look the transfer up by reference and
    // return `paid` on a match. Checkout, orders and the admin stay untouched.
    return { status: ctx.payment.status };
  },
};

function orderReference(orderId: string): string {
  return orderId.slice(-8).toUpperCase();
}
