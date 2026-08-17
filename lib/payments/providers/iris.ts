import "server-only";
import { createPendingIntegrationProvider } from "@/lib/payments/providers/pending-integration";
import type { PaymentConfigField, PaymentMethodDefinition } from "@/lib/payments/types";

/**
 * IRIS — its own provider module, NOT a relabelled bank transfer (§6).
 *
 * The distinction is real: a bank transfer is a manual push that a human
 * reconciles, whereas IRIS e-commerce is an initiated payment request that the
 * customer approves in their banking app and the provider confirms back to the
 * merchant. Modelling it as a bank transfer would mean an IRIS order sat in
 * "awaiting manual confirmation" forever even after the customer had genuinely
 * paid, and would leave no callback seam to connect when credentials arrive.
 *
 * So the module exists, the method exists, both redirect and QR flows are
 * declared in the customer-action vocabulary (`CustomerAction.type` already has
 * `redirect` and `display_qr`), the webhook endpoint routes here — and payment
 * creation refuses, because the endpoints, request bodies and authentication
 * scheme are only obtainable from the acquirer's own integration guide.
 *
 * Deliberately NOT specified here: any URL, path, header name, field name or
 * signing algorithm. Guessing those is exactly the failure mode §29 forbids —
 * it produces code that looks finished, passes review, and fails the first time
 * real money is involved.
 */

const CONFIG_FIELDS: readonly PaymentConfigField[] = [
  {
    key: "acquirerName",
    label: "Acquirer / PSP",
    type: "text",
    secret: false,
    required: true,
    placeholder: "e.g. Piraeus Bank",
    help: "IRIS e-commerce is reached through an acquiring bank or PSP, not directly. Record which one your merchant agreement is with.",
  },
  {
    key: "apiBaseUrl",
    label: "API base URL",
    type: "url",
    secret: false,
    required: true,
    help: "From your acquirer's IRIS integration guide. Left blank deliberately — this app does not guess payment endpoints.",
  },
  { key: "merchantId", label: "Merchant ID", type: "text", secret: false, required: true },
  { key: "apiKey", label: "API key", type: "secret", secret: true, required: true },
  { key: "apiSecret", label: "API secret", type: "secret", secret: true, required: false },
  {
    key: "webhookSecret",
    label: "Webhook / callback secret",
    type: "secret",
    secret: true,
    required: false,
    help: "Used to verify inbound payment confirmations. Until the signing scheme is documented, callbacks are stored but never applied.",
  },
  {
    key: "flow",
    label: "Customer flow",
    type: "select",
    secret: false,
    required: false,
    options: [
      { value: "redirect", label: "Redirect to the IRIS payment page" },
      { value: "qr", label: "Display a QR code for the banking app" },
    ],
    help: "Both are supported by the architecture. Which your acquirer offers is set by your agreement with them.",
  },
] as const;

const IRIS_METHOD: PaymentMethodDefinition = {
  id: "iris",
  providerId: "iris",
  name: "IRIS",
  defaultDisplayName: "IRIS",
  defaultDescription: "Pay instantly from your bank account with IRIS.",
  type: "bank_redirect",
  defaultEnabled: false,
  requiresRedirect: true,
  // The opposite of bank transfer: settlement is confirmed by the provider, not
  // by an admin eyeballing a bank statement.
  requiresManualConfirmation: false,
  requiresWebhook: true,
  supportsRefunds: true,
  supportsPartialRefunds: false,
  supportsCapture: false,
  supportsRecurring: false,
  supportedCurrencies: ["EUR"],
  icon: "iris",
};

export const irisProvider = createPendingIntegrationProvider({
  id: "iris",
  name: "IRIS",
  description: "Instant bank-to-bank payments. Requires an IRIS e-commerce agreement through an acquiring bank.",
  methods: [IRIS_METHOD],
  configFields: CONFIG_FIELDS,
  supportsEnvironments: true,
  webhookSupported: true,
  pendingReason:
    "The IRIS integration boundary is built, but no official API specification or merchant credentials have been supplied yet. Provide your acquirer's IRIS e-commerce integration guide (endpoints, authentication and callback signing) and this provider can be completed without any change to checkout, orders or the admin dashboard.",
});
