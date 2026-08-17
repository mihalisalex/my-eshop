import "server-only";
import { createHmac } from "node:crypto";
import { safeCompare } from "@/lib/payments/crypto";
import type {
  ConfigurationTestResult,
  NormalizedWebhookEvent,
  PaymentConfigField,
  PaymentContext,
  PaymentMethodDefinition,
  PaymentProvider,
  PaymentResult,
  PaymentStatus,
  PaymentStatusResult,
  RefundContext,
  ResolvedProviderConfig,
  WebhookRequest,
} from "@/lib/payments/types";
import { PaymentError, PaymentWebhookVerificationError } from "@/lib/payments/types";

/**
 * Stripe — ONE provider among several, never the payment architecture itself (§7).
 *
 * Two deliberate implementation choices, both worth knowing before extending this:
 *
 * 1. **Stripe's REST API over `fetch`, not the `stripe` SDK.** Same approach as
 *    `lib/courier/providers/acs.ts` and `lib/oauth/*`, which already talk to
 *    external services this way. It keeps webhook signature verification explicit
 *    (below) instead of hidden behind a helper, adds no dependency, and works
 *    unchanged on any runtime with `fetch`.
 *
 * 2. **Hosted Checkout Sessions, not Elements.** Collecting a card in our own form
 *    needs Stripe.js in the browser, which this app's CSP does not allow and which
 *    pulls PCI scope back toward us. A hosted session redirects the shopper to
 *    Stripe's own page, so no card data ever touches this application — and Apple
 *    Pay / Google Pay appear there automatically on capable devices, which is
 *    exactly the abstraction §9 asks for. A Session creates a real PaymentIntent
 *    underneath, so `externalPaymentId`, refunds and status polling all work
 *    against the normal PaymentIntent APIs. Moving to Elements later replaces this
 *    one file; checkout, orders and the admin are unaffected. See PAYMENTS.md.
 */

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2024-06-20";

/** Stripe expects the smallest currency unit. These currencies have no minor unit at all. */
const ZERO_DECIMAL_CURRENCIES = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

export function toStripeAmount(amount: number, currencyCode: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase())) return Math.round(amount);
  return Math.round(amount * 100);
}

export function fromStripeAmount(amount: number, currencyCode: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase())) return amount;
  return Math.round(amount) / 100;
}

const CONFIG_FIELDS: readonly PaymentConfigField[] = [
  {
    key: "testPublishableKey",
    label: "Test publishable key",
    type: "text",
    secret: false,
    required: false,
    environment: "sandbox",
    placeholder: "pk_test_…",
    help: "Safe to expose. Only needed if you later switch this provider to a browser-side integration.",
  },
  {
    key: "testSecretKey",
    label: "Test secret key",
    type: "secret",
    secret: true,
    required: true,
    environment: "sandbox",
    placeholder: "sk_test_…",
  },
  {
    key: "testWebhookSecret",
    label: "Test webhook signing secret",
    type: "secret",
    secret: true,
    required: false,
    environment: "sandbox",
    placeholder: "whsec_…",
    help: "From the Stripe dashboard's webhook endpoint. Without it, incoming webhooks are stored but never applied.",
  },
  {
    key: "livePublishableKey",
    label: "Live publishable key",
    type: "text",
    secret: false,
    required: false,
    environment: "production",
    placeholder: "pk_live_…",
  },
  {
    key: "liveSecretKey",
    label: "Live secret key",
    type: "secret",
    secret: true,
    required: true,
    environment: "production",
    placeholder: "sk_live_…",
  },
  {
    key: "liveWebhookSecret",
    label: "Live webhook signing secret",
    type: "secret",
    secret: true,
    required: false,
    environment: "production",
    placeholder: "whsec_…",
  },
  {
    key: "statementDescriptor",
    label: "Statement descriptor",
    type: "text",
    secret: false,
    required: false,
    placeholder: "ALEXANDRIS",
    help: "What the customer sees on their bank statement. Max 22 characters.",
  },
] as const;

const CARD_METHOD: PaymentMethodDefinition = {
  id: "stripe-card",
  providerId: "stripe",
  name: "Cards (Stripe)",
  defaultDisplayName: "Credit / Debit Card",
  defaultDescription: "Visa, Mastercard, American Express and more. Secured by Stripe.",
  type: "card",
  // Requires credentials, so it can never be on before someone supplies them.
  defaultEnabled: false,
  requiresRedirect: true,
  requiresManualConfirmation: false,
  requiresWebhook: true,
  supportsRefunds: true,
  supportsPartialRefunds: true,
  supportsCapture: true,
  supportsRecurring: true,
  supportedCurrencies: "any",
  icon: "card",
};

/** The secret key for whichever environment the provider is currently in. */
export function stripeSecretKey(config: ResolvedProviderConfig): string | undefined {
  return config.environment === "production" ? config.secrets.liveSecretKey : config.secrets.testSecretKey;
}

export function stripeWebhookSecret(config: ResolvedProviderConfig): string | undefined {
  return config.environment === "production" ? config.secrets.liveWebhookSecret : config.secrets.testWebhookSecret;
}

interface StripeRequestOptions {
  method?: "GET" | "POST";
  body?: Record<string, string | number | undefined>;
  idempotencyKey?: string;
}

/**
 * One place where every Stripe call is made. Errors are normalised into
 * `PaymentError` with a deliberately generic `publicMessage` — Stripe's own error
 * text is written for developers and occasionally names internal state, so it goes
 * to the audit log rather than to a shopper.
 */
export async function stripeRequest<T = Record<string, unknown>>(
  config: ResolvedProviderConfig,
  path: string,
  options: StripeRequestOptions = {}
): Promise<T> {
  const secretKey = stripeSecretKey(config);
  if (!secretKey) {
    throw new PaymentError("PROVIDER_NOT_CONFIGURED", `Stripe ${config.environment} secret key is not set.`);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };
  let body: string | undefined;
  if (options.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.body)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    body = params.toString();
  }
  // Stripe replays the original response for a repeated key rather than acting
  // twice — this is the mechanism behind §15 for every write we make.
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers,
    body,
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new PaymentError("PROVIDER_ERROR", `Stripe returned a non-JSON response (${response.status}): ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    const error = (parsed as { error?: { message?: string; code?: string; type?: string } }).error;
    throw new PaymentError(
      response.status === 401 ? "PROVIDER_NOT_CONFIGURED" : "PROVIDER_ERROR",
      `Stripe ${response.status} ${error?.type ?? ""} ${error?.code ?? ""}: ${error?.message ?? text.slice(0, 300)}`
    );
  }
  return parsed as T;
}

interface StripePaymentIntent {
  id: string;
  status: string;
  amount_received?: number;
  currency?: string;
  last_payment_error?: { message?: string; code?: string };
  latest_charge?: string;
}

/**
 * Stripe's PaymentIntent statuses mapped into our vocabulary. `requires_payment_method`
 * is ambiguous on its own — it's both the initial state and the state after a
 * declined card — so the presence of `last_payment_error` is what distinguishes
 * "not started" from "failed".
 */
export function mapStripeStatus(intent: Pick<StripePaymentIntent, "status" | "last_payment_error">): PaymentStatus {
  switch (intent.status) {
    case "requires_payment_method":
      return intent.last_payment_error ? "failed" : "pending";
    case "requires_confirmation":
      return "pending";
    case "requires_action":
      return "awaiting_customer_action";
    case "processing":
      // Authorised but not captured. Money isn't ours yet, so it is emphatically
      // not `paid` — treating `requires_capture` as settled is how shops end up
      // shipping against authorisations that later expire.
      return "processing";
    case "requires_capture":
      return "processing";
    case "succeeded":
      return "paid";
    case "canceled":
      return "cancelled";
    default:
      return "processing";
  }
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  name: "Stripe",
  description: "Cards and wallets through Stripe's hosted checkout. No card data touches this application.",
  methods: [CARD_METHOD],
  configFields: CONFIG_FIELDS,
  supportsEnvironments: true,
  defaultEnabled: false,
  supportsConnectionTest: true,
  webhookSupported: true,

  isConfigured(config: ResolvedProviderConfig): boolean {
    return Boolean(stripeSecretKey(config));
  },

  async validateConfiguration(config: ResolvedProviderConfig): Promise<ConfigurationTestResult> {
    const secretKey = stripeSecretKey(config);
    if (!secretKey) {
      return {
        status: "not_configured",
        message: `No Stripe ${config.environment === "production" ? "live" : "test"} secret key has been set.`,
        checkedLive: false,
      };
    }
    // A live key in sandbox mode (or the reverse) authenticates perfectly and then
    // charges real money — or fails to. Catching it here is cheap; catching it
    // after a customer's card is charged is not.
    const expectedPrefix = config.environment === "production" ? "sk_live_" : "sk_test_";
    if (!secretKey.startsWith(expectedPrefix) && !secretKey.startsWith("rk_")) {
      return {
        status: "auth_failed",
        message: `This key doesn't look like a ${config.environment} key (expected it to start with "${expectedPrefix}"). Check you haven't pasted the wrong environment's key.`,
        checkedLive: false,
      };
    }

    try {
      // A real, authenticated read against the exact resource this integration
      // uses — not a generic ping. It proves the key works AND has access.
      const result = await stripeRequest<{ data: unknown[] }>(config, "/payment_intents?limit=1");
      return {
        status: "connected",
        message: `Connected to Stripe in ${config.environment} mode.`,
        checkedLive: true,
        details: {
          Mode: config.environment,
          "Webhook secret": stripeWebhookSecret(config) ? "Set" : "Not set — webhooks will be stored but not applied",
          "Recent payment intents": String(result.data?.length ?? 0),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isAuth = error instanceof PaymentError && error.code === "PROVIDER_NOT_CONFIGURED";
      return {
        status: isAuth ? "auth_failed" : "unavailable",
        message: isAuth ? "Stripe rejected these credentials." : `Could not reach Stripe: ${message}`,
        checkedLive: true,
      };
    }
  },

  async initializePayment(ctx: PaymentContext): Promise<PaymentResult> {
    const config = ctx.processingConfig ?? ctx.config;
    const order = ctx.order;
    if (!order) throw new PaymentError("PROVIDER_ERROR", "Stripe requires order context to create a payment.");
    if (!ctx.returnUrls) throw new PaymentError("PROVIDER_ERROR", "Stripe requires return URLs to create a hosted session.");

    const currency = ctx.payment.amount.currencyCode.toLowerCase();
    // ONE line item for the order total rather than an itemised basket. The total
    // already has discounts, gift cards, shipping, gift wrap, tax and the payment
    // fee folded in by resolveCartAmounts; re-deriving it from line items here
    // would create a second source of truth that can disagree with what we charge.
    const session = await stripeRequest<{ id: string; url?: string; payment_intent?: string; expires_at?: number }>(
      config,
      "/checkout/sessions",
      {
        idempotencyKey: ctx.idempotencyKey,
        body: {
          mode: "payment",
          "line_items[0][quantity]": 1,
          "line_items[0][price_data][currency]": currency,
          "line_items[0][price_data][unit_amount]": toStripeAmount(ctx.payment.amount.amount, currency),
          "line_items[0][price_data][product_data][name]": `Order ${orderReference(order.orderId)}`,
          customer_email: order.customerEmail,
          success_url: ctx.returnUrls.success,
          cancel_url: ctx.returnUrls.cancel,
          "payment_intent_data[statement_descriptor_suffix]": ctx.config.values.statementDescriptor?.slice(0, 22),
          // Carried through to the PaymentIntent and echoed on every webhook, which
          // is how a webhook finds the payment it belongs to even if the session id
          // was never persisted.
          "payment_intent_data[metadata][paymentId]": ctx.payment.id,
          "payment_intent_data[metadata][orderId]": order.orderId,
          "metadata[paymentId]": ctx.payment.id,
          "metadata[orderId]": order.orderId,
        },
      }
    );

    if (!session.url) {
      throw new PaymentError("PROVIDER_ERROR", "Stripe created a session without a redirect URL.");
    }

    return {
      status: "awaiting_customer_action",
      // The PaymentIntent id isn't assigned until the shopper begins paying, so the
      // session id is what we can reconcile against right now. The webhook (and the
      // return-path verification) replaces it with the real intent id.
      externalPaymentId: session.payment_intent ?? session.id,
      customerAction: {
        type: "redirect",
        redirectUrl: session.url,
        message: "You'll be taken to Stripe's secure page to complete your payment.",
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : undefined,
      },
      metadata: { stripeCheckoutSessionId: session.id, stripeMode: config.environment },
    };
  },

  /**
   * Server-side verification after the shopper returns. §14: a browser landing on
   * the success URL proves only that a browser landed on the success URL — the
   * payment is whatever Stripe says it is when we ask Stripe.
   */
  async confirmPayment(ctx: PaymentContext): Promise<PaymentResult> {
    const config = ctx.processingConfig ?? ctx.config;
    const sessionId = typeof ctx.payment.metadata.stripeCheckoutSessionId === "string"
      ? ctx.payment.metadata.stripeCheckoutSessionId
      : null;

    if (sessionId) {
      const session = await stripeRequest<{ payment_status?: string; payment_intent?: string; status?: string }>(
        config,
        `/checkout/sessions/${sessionId}`
      );
      const intentId = session.payment_intent ?? ctx.payment.externalPaymentId;
      if (session.payment_status === "paid") {
        return { status: "paid", externalPaymentId: intentId ?? undefined };
      }
      if (session.status === "expired") {
        return { status: "expired", externalPaymentId: intentId ?? undefined, failureReason: "The Stripe checkout session expired." };
      }
      if (intentId && intentId.startsWith("pi_")) {
        const intent = await stripeRequest<StripePaymentIntent>(config, `/payment_intents/${intentId}`);
        return {
          status: mapStripeStatus(intent),
          externalPaymentId: intent.id,
          failureReason: intent.last_payment_error?.message,
        };
      }
      return { status: ctx.payment.status, externalPaymentId: intentId ?? undefined };
    }

    if (!ctx.payment.externalPaymentId) {
      throw new PaymentError("PROVIDER_ERROR", "This Stripe payment has no session or intent to verify against.");
    }
    const intent = await stripeRequest<StripePaymentIntent>(config, `/payment_intents/${ctx.payment.externalPaymentId}`);
    return { status: mapStripeStatus(intent), externalPaymentId: intent.id, failureReason: intent.last_payment_error?.message };
  },

  async cancelPayment(ctx: PaymentContext): Promise<PaymentResult> {
    const config = ctx.processingConfig ?? ctx.config;
    const intentId = ctx.payment.externalPaymentId;
    // A session that was never started has no intent to cancel — expiring our own
    // record is the correct and complete action.
    if (!intentId || !intentId.startsWith("pi_")) {
      return { status: "cancelled", metadata: { cancelledLocally: true } };
    }
    const intent = await stripeRequest<StripePaymentIntent>(config, `/payment_intents/${intentId}/cancel`, {
      idempotencyKey: `${ctx.idempotencyKey}:cancel`,
      body: {},
    });
    return { status: mapStripeStatus(intent), externalPaymentId: intent.id };
  },

  async refundPayment(ctx: RefundContext): Promise<PaymentResult> {
    const config = ctx.processingConfig ?? ctx.config;
    const intentId = ctx.payment.externalPaymentId;
    if (!intentId || !intentId.startsWith("pi_")) {
      throw new PaymentError("REFUND_NOT_SUPPORTED", "This payment has no Stripe PaymentIntent to refund against.");
    }
    const currency = ctx.payment.amount.currencyCode;
    await stripeRequest(config, "/refunds", {
      // Derived from the running refunded total, so a retried partial refund of the
      // same amount is replayed by Stripe rather than applied twice.
      idempotencyKey: `${ctx.idempotencyKey}:refund:${ctx.payment.refundedAmount.amount}:${ctx.amount.amount}`,
      body: {
        payment_intent: intentId,
        amount: toStripeAmount(ctx.amount.amount, currency),
        "metadata[paymentId]": ctx.payment.id,
        "metadata[reason]": ctx.reason ?? "",
      },
    });

    const total = ctx.payment.refundedAmount.amount + ctx.amount.amount;
    const isFull = total >= ctx.payment.amount.amount - 0.005;
    return {
      status: isFull ? "refunded" : "partially_refunded",
      refundedAmount: { amount: total, currencyCode: currency },
    };
  },

  async getPaymentStatus(ctx: PaymentContext): Promise<PaymentStatusResult> {
    const config = ctx.processingConfig ?? ctx.config;
    const intentId = ctx.payment.externalPaymentId;
    if (!intentId) return { status: ctx.payment.status };
    if (!intentId.startsWith("pi_")) {
      const session = await stripeRequest<{ payment_status?: string; payment_intent?: string }>(
        config,
        `/checkout/sessions/${intentId}`
      );
      if (session.payment_status === "paid") return { status: "paid", externalPaymentId: session.payment_intent };
      return { status: ctx.payment.status, externalPaymentId: session.payment_intent };
    }
    const intent = await stripeRequest<StripePaymentIntent>(config, `/payment_intents/${intentId}`);
    return { status: mapStripeStatus(intent), externalPaymentId: intent.id, failureReason: intent.last_payment_error?.message };
  },

  async parseWebhook(request: WebhookRequest, config: ResolvedProviderConfig): Promise<NormalizedWebhookEvent> {
    const signingSecret = stripeWebhookSecret(config);
    if (!signingSecret) {
      throw new PaymentWebhookVerificationError(
        "No Stripe webhook signing secret is configured, so this event cannot be verified."
      );
    }
    verifyStripeSignature(request.rawBody, request.headers.get("stripe-signature"), signingSecret);
    return normalizeStripeEvent(JSON.parse(request.rawBody), config);
  },
};

/**
 * Stripe's documented signature scheme: the header is a comma-separated list of
 * `t=<unix-timestamp>` and one or more `v1=<hex hmac>` values, where the HMAC is
 * SHA-256 over `"<timestamp>.<raw body>"` keyed with the endpoint's signing secret.
 *
 * The timestamp tolerance is not optional decoration: without it, a signature
 * captured from a genuine past event stays valid forever, so anyone who ever saw
 * one delivery could replay it at will.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  signingSecret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000)
): void {
  if (!signatureHeader) {
    throw new PaymentWebhookVerificationError("Missing Stripe-Signature header.");
  }
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) {
    throw new PaymentWebhookVerificationError("Malformed Stripe-Signature header.");
  }
  const age = Math.abs(nowSeconds - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) {
    throw new PaymentWebhookVerificationError(`Stripe webhook timestamp is outside the ${toleranceSeconds}s tolerance.`);
  }

  const expected = createHmac("sha256", signingSecret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  // Constant-time comparison — see lib/payments/crypto.ts's safeCompare.
  if (!signatures.some((signature) => safeCompare(signature, expected))) {
    throw new PaymentWebhookVerificationError("Stripe webhook signature did not match.");
  }
}

interface StripeEventEnvelope {
  id?: string;
  type?: string;
  created?: number;
  data?: { object?: Record<string, unknown> };
}

/** Exported separately from `parseWebhook` so the mapping is unit-testable without a signature. */
export function normalizeStripeEvent(event: StripeEventEnvelope, config: ResolvedProviderConfig): NormalizedWebhookEvent {
  const object = event.data?.object ?? {};
  const metadata = (object.metadata as Record<string, string> | undefined) ?? {};
  const eventId = event.id ?? "";
  const eventType = event.type ?? "unknown";
  const occurredAt = event.created ? new Date(event.created * 1000).toISOString() : undefined;

  const base = {
    eventId,
    eventType,
    paymentId: metadata.paymentId ?? null,
    occurredAt,
  };

  switch (eventType) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const intentId = typeof object.payment_intent === "string" ? object.payment_intent : null;
      // `completed` fires when the session finishes, which for delayed methods is
      // NOT the same as being paid — hence checking payment_status rather than
      // assuming success from the event name.
      const isPaid = object.payment_status === "paid";
      return {
        ...base,
        externalPaymentId: intentId,
        status: isPaid ? "paid" : "processing",
      };
    }
    case "checkout.session.async_payment_failed":
      return {
        ...base,
        externalPaymentId: typeof object.payment_intent === "string" ? object.payment_intent : null,
        status: "failed",
        failureReason: "The delayed payment method failed.",
      };
    case "checkout.session.expired":
      return {
        ...base,
        externalPaymentId: typeof object.payment_intent === "string" ? object.payment_intent : null,
        status: "expired",
      };
    case "payment_intent.succeeded":
      return { ...base, externalPaymentId: (object.id as string) ?? null, status: "paid" };
    case "payment_intent.processing":
      return { ...base, externalPaymentId: (object.id as string) ?? null, status: "processing" };
    case "payment_intent.requires_action":
      return { ...base, externalPaymentId: (object.id as string) ?? null, status: "awaiting_customer_action" };
    case "payment_intent.canceled":
      return { ...base, externalPaymentId: (object.id as string) ?? null, status: "cancelled" };
    case "payment_intent.payment_failed": {
      const error = object.last_payment_error as { message?: string } | undefined;
      return {
        ...base,
        externalPaymentId: (object.id as string) ?? null,
        status: "failed",
        failureReason: error?.message ?? "The payment was declined.",
      };
    }
    case "charge.refunded": {
      const currency = typeof object.currency === "string" ? object.currency.toUpperCase() : "EUR";
      const refunded = fromStripeAmount(Number(object.amount_refunded ?? 0), currency);
      const captured = fromStripeAmount(Number(object.amount_captured ?? object.amount ?? 0), currency);
      return {
        ...base,
        externalPaymentId: typeof object.payment_intent === "string" ? object.payment_intent : null,
        status: refunded >= captured - 0.005 ? "refunded" : "partially_refunded",
        refundedAmount: { amount: refunded, currencyCode: currency },
      };
    }
    default:
      // Stripe sends dozens of event types by default. Anything we don't act on is
      // recorded and acknowledged — returning an error would make Stripe retry an
      // event forever and eventually disable the endpoint.
      return { ...base, externalPaymentId: null, status: null, ignored: true, metadata: { environment: config.environment } };
  }
}

function orderReference(orderId: string): string {
  return `#${orderId.slice(-8).toUpperCase()}`;
}
