import "server-only";
import { createPendingIntegrationProvider } from "@/lib/payments/providers/pending-integration";
import type { PaymentConfigField, PaymentMethodDefinition } from "@/lib/payments/types";

/**
 * Piraeus Bank — a dedicated provider boundary (§8).
 *
 * The field list below is EXACTLY the one specified for this screen and nothing
 * more. That constraint is deliberate: without the official Piraeus integration
 * documentation, any field I added of my own accord would be an invented
 * parameter presented to a store owner as if the bank required it, and any field
 * I removed might be one they do. So the set is neither guessed at nor trimmed —
 * it is provisional, and says so, until the real specification arrives.
 *
 * Every field is marked `required: false` for the same reason: enforcing a
 * requirement I can't verify would block a valid configuration. `isConfigured`
 * returns false regardless (see createPendingIntegrationProvider), so no partial
 * configuration can leak onto the storefront.
 */

const CONFIG_FIELDS: readonly PaymentConfigField[] = [
  { key: "merchantId", label: "Merchant ID", type: "text", secret: false, required: false },
  { key: "terminalId", label: "Terminal ID", type: "text", secret: false, required: false },
  { key: "apiKey", label: "API key", type: "secret", secret: true, required: false },
  { key: "apiSecret", label: "API secret", type: "secret", secret: true, required: false },
  { key: "clientId", label: "Client ID", type: "text", secret: false, required: false },
  { key: "clientSecret", label: "Client secret", type: "secret", secret: true, required: false },
  {
    key: "webhookSecret",
    label: "Webhook secret",
    type: "secret",
    secret: true,
    required: false,
    help: "Used to verify inbound notifications once the signing scheme is documented.",
  },
  {
    key: "returnUrl",
    label: "Return URL",
    type: "url",
    secret: false,
    required: false,
    help: "Where the bank sends the customer's browser after payment. A browser landing here is never treated as proof of payment — the server verifies independently.",
  },
  {
    key: "callbackUrl",
    label: "Callback URL",
    type: "url",
    secret: false,
    required: false,
    help: "Server-to-server notification endpoint. This app already exposes /api/payments/webhooks/piraeus for it.",
  },
] as const;

const PIRAEUS_CARD_METHOD: PaymentMethodDefinition = {
  id: "piraeus-card",
  providerId: "piraeus",
  name: "Cards (Piraeus Bank)",
  defaultDisplayName: "Credit / Debit Card",
  defaultDescription: "Card payments processed by Piraeus Bank.",
  type: "card",
  defaultEnabled: false,
  requiresRedirect: true,
  requiresManualConfirmation: false,
  requiresWebhook: true,
  supportsRefunds: true,
  supportsPartialRefunds: true,
  supportsCapture: true,
  supportsRecurring: false,
  supportedCurrencies: ["EUR"],
  icon: "card",
};

export const piraeusProvider = createPendingIntegrationProvider({
  id: "piraeus",
  name: "Piraeus Bank",
  description: "Card acquiring through Piraeus Bank. Requires a merchant agreement and the bank's integration documentation.",
  methods: [PIRAEUS_CARD_METHOD],
  configFields: CONFIG_FIELDS,
  supportsEnvironments: true,
  webhookSupported: true,
  pendingReason:
    "The Piraeus provider boundary is built (create payment, redirect, callback, webhook, verification, refund and status all have their place in the interface), but no official Piraeus API specification or merchant credentials have been supplied. The configuration fields shown here are provisional and must be reconciled with the bank's own integration guide — this app does not invent bank API parameters.",
});
