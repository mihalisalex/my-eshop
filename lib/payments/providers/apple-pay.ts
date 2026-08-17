import "server-only";
import { stripeProvider } from "@/lib/payments/providers/stripe";
import type {
  ConfigurationTestResult,
  NormalizedWebhookEvent,
  PaymentConfigField,
  PaymentContext,
  PaymentMethodDefinition,
  PaymentProvider,
  PaymentProviderId,
  PaymentResult,
  PaymentStatusResult,
  RefundContext,
  ResolvedProviderConfig,
  WebhookRequest,
} from "@/lib/payments/types";
import { PaymentError } from "@/lib/payments/types";

/**
 * Apple Pay as a payment CAPABILITY, not a payment rail (§9).
 *
 * Apple Pay never settles money — it's a way of presenting a card that some
 * processor then charges. So this provider owns the Apple-specific configuration
 * and the availability rules, and delegates every actual money operation to
 * whichever processor is selected. The checkout sees only "Apple Pay"; it has no
 * idea Stripe is underneath, and swapping the processor to Piraeus later is a
 * dropdown change here, not a checkout change.
 *
 * The delegation is explicit rather than clever: `processingProviderIdFor` tells
 * the payment service which provider's configuration to resolve, and the service
 * hands it back as `ctx.processingConfig`. Reaching into the registry from inside
 * a provider would be an import cycle and would let any provider read any other
 * provider's credentials.
 *
 * Availability is stricter than for any other method, because a broken Apple Pay
 * button is worse than no button. It requires ALL of: the method enabled, this
 * provider enabled, the processing provider enabled AND configured, and — checked
 * in the browser, on top of everything the server decided — a device that
 * actually supports Apple Pay.
 */

/** Every provider that can present Apple Pay. Adding one means adding a case here and an option below. */
const SUPPORTED_PROCESSORS: Record<string, PaymentProvider> = {
  stripe: stripeProvider,
};

const CONFIG_FIELDS: readonly PaymentConfigField[] = [
  {
    key: "processingProvider",
    label: "Processed by",
    type: "select",
    secret: false,
    required: true,
    options: [{ value: "stripe", label: "Stripe" }],
    help: "Apple Pay is presented by this processor and settled on its account. Its own credentials and environment are used — configure it on its own page.",
  },
  {
    key: "merchantIdentifier",
    label: "Apple merchant identifier",
    type: "text",
    secret: false,
    required: false,
    placeholder: "merchant.gr.alexandris.shop",
    help: "Only needed for an on-site Apple Pay button (Payment Request / Elements). With Stripe's hosted checkout, Stripe presents Apple Pay on its own domain and no merchant identifier is required from this app.",
  },
  {
    key: "merchantDomain",
    label: "Verified domain",
    type: "text",
    secret: false,
    required: false,
    placeholder: "shopalexandris.vercel.app",
    help: "The domain registered with your processor for Apple Pay. Required for an on-site button; not used by hosted checkout.",
  },
  {
    key: "domainAssociationFile",
    label: "Domain association file contents",
    type: "textarea",
    secret: false,
    required: false,
    help: "Contents of apple-developer-merchantid-domain-association, served from /.well-known/ when you move to an on-site button. Leave blank for hosted checkout.",
  },
] as const;

const APPLE_PAY_METHOD: PaymentMethodDefinition = {
  id: "apple-pay",
  providerId: "apple-pay",
  name: "Apple Pay",
  defaultDisplayName: "Apple Pay",
  defaultDescription: "Pay in one touch with the card in your Apple Wallet.",
  type: "wallet",
  defaultEnabled: false,
  requiresRedirect: true,
  requiresManualConfirmation: false,
  requiresWebhook: true,
  supportsRefunds: true,
  supportsPartialRefunds: true,
  supportsCapture: true,
  supportsRecurring: false,
  supportedCurrencies: "any",
  // The extra, browser-side gate. It can only ever REMOVE the method — it can
  // never make an unavailable one available, because the server has already
  // decided that.
  clientCapability: "apple-pay",
  icon: "apple",
};

function processorIdFrom(config: ResolvedProviderConfig): PaymentProviderId | null {
  const selected = config.values.processingProvider?.trim() || "stripe";
  return selected in SUPPORTED_PROCESSORS ? selected : null;
}

function requireProcessor(config: ResolvedProviderConfig): PaymentProvider {
  const id = processorIdFrom(config);
  if (!id) {
    throw new PaymentError(
      "PROVIDER_NOT_CONFIGURED",
      `Apple Pay is configured to be processed by "${config.values.processingProvider}", which is not a registered processor.`
    );
  }
  return SUPPORTED_PROCESSORS[id];
}

/**
 * Guard every delegated operation funnels through. The processor reads its own
 * credentials from `ctx.processingConfig` (see stripe.ts's `ctx.processingConfig ??
 * ctx.config`), so the only thing to enforce here is that the service actually
 * resolved it — a delegate running against Apple Pay's own config would silently
 * find no API key and report "not configured" for the wrong provider.
 */
function delegateContext<T extends PaymentContext>(ctx: T): T {
  if (!ctx.processingConfig) {
    throw new PaymentError(
      "PROVIDER_NOT_CONFIGURED",
      "Apple Pay was invoked without its processing provider's configuration resolved."
    );
  }
  return ctx;
}

export const applePayProvider: PaymentProvider = {
  id: "apple-pay",
  name: "Apple Pay",
  description: "Offer Apple Pay on supported devices, settled through your card processor.",
  methods: [APPLE_PAY_METHOD],
  configFields: CONFIG_FIELDS,
  // Apple Pay has no environment of its own — it inherits the processor's.
  supportsEnvironments: false,
  defaultEnabled: false,
  supportsConnectionTest: true,
  webhookSupported: false,

  processingProviderIdFor: processorIdFrom,

  isConfigured(config: ResolvedProviderConfig): boolean {
    const id = processorIdFrom(config);
    if (!id) return false;
    // Deliberately does NOT check the processor's credentials here — this provider
    // has no access to them. The payment service checks the processor separately
    // when deciding availability, which keeps credentials scoped to their owner.
    return true;
  },

  async validateConfiguration(config: ResolvedProviderConfig): Promise<ConfigurationTestResult> {
    const id = processorIdFrom(config);
    if (!id) {
      return {
        status: "not_configured",
        message: `"${config.values.processingProvider}" is not a registered payment processor.`,
        checkedLive: false,
      };
    }
    return {
      status: "connected",
      message: `Apple Pay will be presented and settled by ${SUPPORTED_PROCESSORS[id].name}. Test that provider's connection to verify the credentials that actually charge the card.`,
      // No Apple-specific API exists to call — saying so is more useful than a
      // tick that means nothing.
      checkedLive: false,
      details: {
        "Processed by": SUPPORTED_PROCESSORS[id].name,
        Integration: "Hosted checkout — the processor presents the Apple Pay sheet on its own verified domain",
        "Merchant identifier": config.values.merchantIdentifier?.trim() || "Not set (not required for hosted checkout)",
      },
    };
  },

  async initializePayment(ctx: PaymentContext): Promise<PaymentResult> {
    const result = await requireProcessor(ctx.config).initializePayment(delegateContext(ctx));
    // Tag the payment so reporting can distinguish an Apple Pay sale from a plain
    // card sale even though both settled through the same processor.
    return { ...result, metadata: { ...result.metadata, wallet: "apple-pay", processedBy: processorIdFrom(ctx.config) } };
  },

  async confirmPayment(ctx: PaymentContext): Promise<PaymentResult> {
    return requireProcessor(ctx.config).confirmPayment(delegateContext(ctx));
  },

  async cancelPayment(ctx: PaymentContext): Promise<PaymentResult> {
    return requireProcessor(ctx.config).cancelPayment(delegateContext(ctx));
  },

  async refundPayment(ctx: RefundContext): Promise<PaymentResult> {
    return requireProcessor(ctx.config).refundPayment(delegateContext(ctx));
  },

  async getPaymentStatus(ctx: PaymentContext): Promise<PaymentStatusResult> {
    return requireProcessor(ctx.config).getPaymentStatus(delegateContext(ctx));
  },
};

/**
 * Apple Pay has no webhook endpoint of its own (`webhookSupported: false`), because
 * its events are the PROCESSOR's events and arrive at that processor's endpoint.
 * That works without special-casing: the Stripe webhook carries our own `paymentId`
 * in its metadata, so the router updates the payment directly regardless of which
 * provider the payment row is attributed to.
 */
export type { NormalizedWebhookEvent, WebhookRequest };
