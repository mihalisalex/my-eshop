import "server-only";
import type {
  ConfigurationTestResult,
  NormalizedWebhookEvent,
  PaymentConfigField,
  PaymentContext,
  PaymentMethodDefinition,
  PaymentProvider,
  PaymentResult,
  PaymentStatusResult,
  RefundContext,
  ResolvedProviderConfig,
  WebhookRequest,
} from "@/lib/payments/types";
import { PaymentError, PaymentWebhookVerificationError } from "@/lib/payments/types";

/**
 * A real integration BOUNDARY for a provider whose official API specification we
 * don't have yet (§29).
 *
 * This is the shape the instruction "do not pretend the integration works" takes
 * in code. Everything structural exists and is real — the provider is registered,
 * it appears in the admin, its configuration fields are stored and encrypted like
 * any other's, its webhook endpoint is routable, and it participates in the same
 * status machine — but the three operations that would require guessing an
 * endpoint, a request body or an authentication scheme refuse loudly instead of
 * fabricating a result.
 *
 * Two consequences worth stating plainly, because they're the whole point:
 *
 * - `validateConfiguration` returns `not_implemented`, never `connected`. Filling
 *   in every credential does NOT turn the badge green, because credentials being
 *   present is not the same as the integration existing.
 * - `isConfigured` returns false unconditionally, which is what keeps the method
 *   out of `getAvailablePaymentMethods` and therefore off the checkout. A shopper
 *   can never select a method that would fail.
 *
 * Connecting the real API later means replacing this factory call with a full
 * `PaymentProvider` implementation in the same file. Nothing else in the codebase
 * changes — not checkout, not the order model, not the database, not the admin.
 */
export interface PendingIntegrationProviderInput {
  id: string;
  name: string;
  description: string;
  methods: PaymentMethodDefinition[];
  configFields: readonly PaymentConfigField[];
  supportsEnvironments: boolean;
  webhookSupported: boolean;
  /** What is actually needed to finish this integration. Shown verbatim in the admin. */
  pendingReason: string;
}

export function createPendingIntegrationProvider(input: PendingIntegrationProviderInput): PaymentProvider {
  const unavailable = (operation: string) =>
    new PaymentError(
      "PROVIDER_NOT_IMPLEMENTED",
      `${input.name}: ${operation} is not implemented yet. ${input.pendingReason}`,
      `${input.name} isn't available yet. Please choose another payment method.`
    );

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    methods: input.methods,
    configFields: input.configFields,
    supportsEnvironments: input.supportsEnvironments,
    // An unconnected integration is never on by default, and enabling it changes
    // nothing at checkout while `isConfigured` returns false.
    defaultEnabled: false,
    // The button is shown — testing is exactly how an admin learns the honest
    // status — but the result can never be a false "connected".
    supportsConnectionTest: true,
    webhookSupported: input.webhookSupported,
    integrationPending: true,
    pendingReason: input.pendingReason,

    isConfigured() {
      return false;
    },

    async validateConfiguration(config: ResolvedProviderConfig): Promise<ConfigurationTestResult> {
      const relevant = input.configFields.filter(
        (field) => !field.environment || field.environment === config.environment
      );
      const provided = relevant.filter((field) =>
        field.secret ? Boolean(config.secrets[field.key]) : Boolean(config.values[field.key]?.trim())
      );
      return {
        status: "not_implemented",
        message: input.pendingReason,
        // No request was made and none could be. The admin UI renders this as an
        // explicit "not verified" rather than a tick.
        checkedLive: false,
        details: {
          "Credentials stored": `${provided.length} of ${relevant.length} fields`,
          Environment: config.environment,
          "Available at checkout": "No — the integration is not connected",
        },
      };
    },

    async initializePayment(): Promise<PaymentResult> {
      throw unavailable("creating a payment");
    },
    async confirmPayment(): Promise<PaymentResult> {
      throw unavailable("confirming a payment");
    },
    async cancelPayment(): Promise<PaymentResult> {
      throw unavailable("cancelling a payment");
    },
    async refundPayment(_ctx: RefundContext): Promise<PaymentResult> {
      throw unavailable("refunding a payment");
    },
    async getPaymentStatus(ctx: PaymentContext): Promise<PaymentStatusResult> {
      // Deliberately does NOT throw: an admin looking at a historical payment row
      // shouldn't hit an error page. The stored status is returned unchanged,
      // which is accurate — nothing external can have moved it.
      return { status: ctx.payment.status };
    },

    ...(input.webhookSupported
      ? {
          async parseWebhook(_request: WebhookRequest): Promise<NormalizedWebhookEvent> {
            // The endpoint exists and records the delivery (the route stores the raw
            // body before calling this), so a provider testing their callback sees a
            // real response and we keep the payload. But with no documented signature
            // scheme there is nothing to verify against, and an unverified event must
            // never move money — §14.
            throw new PaymentWebhookVerificationError(
              `${input.name} webhooks cannot be verified yet: ${input.pendingReason} The payload has been stored for inspection.`
            );
          },
        }
      : {}),
  };
}
