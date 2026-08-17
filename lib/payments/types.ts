import type { Money } from "@/types";
import type { Address, CartLineItem, CartTotals } from "@/lib/commerce/types";

/**
 * The vendor-neutral payment vocabulary. Nothing in this file knows that Stripe,
 * Piraeus or IRIS exist — checkout, the order system and the admin dashboard all
 * speak only these types, which is what makes a new provider an implementation
 * task rather than an architectural rewrite.
 *
 * Same "one interface, many vendors" shape as lib/courier/types.ts and
 * lib/email/types.ts, with one structural difference: payments needs a REGISTRY
 * rather than a single factory, because several providers are active at once
 * (a store legitimately offers COD *and* cards *and* bank transfer). That mirrors
 * lib/oauth/, which already registers three simultaneously active providers.
 */

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * Provider ids are stable strings, not an enum, because a future provider (Viva
 * Wallet, PayPal, Adyen, another Greek bank) must be addable without a migration
 * on every table that stores one. They're persisted in `payments.provider`.
 */
export type PaymentProviderId = string;

/**
 * A method is what a shopper picks at checkout. One provider may expose several
 * (Stripe → cards *and* Apple Pay), and one logical method may be served by
 * different providers over time (Apple Pay could move from Stripe to Piraeus
 * without checkout changing), which is exactly why method and provider are
 * separate ids rather than one compound field.
 */
export type PaymentMethodId = string;

export type PaymentEnvironment = "sandbox" | "production";

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Deliberately NOT reusing Order["status"]. An order's lifecycle (confirmed →
 * processing → shipped → delivered) and a payment's lifecycle are independent
 * facts: a Cash-on-Delivery order is legitimately `processing` while its payment
 * is still `pending`, and a delivered order can later become `refunded` without
 * the shipment un-happening. Collapsing the two is the classic e-commerce
 * modelling mistake and it makes accounting impossible to reconstruct.
 */
export type PaymentStatus =
  | "pending"
  | "awaiting_customer_action"
  | "awaiting_bank_transfer"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "expired";

/** Statuses from which nothing further can happen — see lib/payments/status.ts. */
export const TERMINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "cancelled",
  "refunded",
  "expired",
] as const;

/** Every recordable event on a payment's audit trail. */
export type PaymentEventType =
  | "payment_created"
  | "payment_pending"
  | "payment_requires_action"
  | "payment_processing"
  | "payment_succeeded"
  | "payment_failed"
  | "payment_cancelled"
  | "payment_expired"
  | "payment_refunded"
  | "payment_partially_refunded"
  | "webhook_received"
  | "manual_payment_confirmation"
  | "provider_error"
  | "configuration_tested";

/** Who caused an event — matters for accounting and for spotting a mis-set manual confirmation. */
export type PaymentActorType = "customer" | "admin" | "provider" | "system";

// ---------------------------------------------------------------------------
// Method capabilities (code-level facts, NOT admin-editable)
// ---------------------------------------------------------------------------

export type PaymentMethodType =
  /** Settled outside the system entirely — cash handed to a courier. */
  | "offline"
  /** Customer transfers manually; an admin reconciles it. */
  | "manual_bank_transfer"
  | "card"
  | "wallet"
  | "bank_redirect";

/**
 * What a method can *technically* do. These are properties of the integration,
 * so they live in code next to the provider that implements them — an admin
 * cannot toggle "supports refunds" into being true. Admin-editable merchandising
 * settings are a separate type (PaymentMethodSettings) stored in Postgres.
 */
export interface PaymentMethodDefinition {
  id: PaymentMethodId;
  providerId: PaymentProviderId;
  /** Internal name, e.g. "Cards (Stripe)". The customer-facing string is `defaultDisplayName`, overridable per store. */
  name: string;
  defaultDisplayName: string;
  defaultDescription: string;
  type: PaymentMethodType;
  /**
   * Whether the method is on before an admin has touched anything. True only for
   * the two internal methods that need no external account — a fresh install has
   * a working checkout on day one, and a method that needs credentials can never
   * default to on and then fail a real shopper.
   */
  defaultEnabled: boolean;
  /** Sends the shopper to the provider's own page/app to finish paying. */
  requiresRedirect: boolean;
  /** Reaches `paid` only when a human confirms it (COD, bank transfer). */
  requiresManualConfirmation: boolean;
  /** Cannot be trusted as settled without a verified server-side callback. */
  requiresWebhook: boolean;
  supportsRefunds: boolean;
  supportsPartialRefunds: boolean;
  supportsCapture: boolean;
  supportsRecurring: boolean;
  /** `"any"` means the provider settles whatever the store's currency is. */
  supportedCurrencies: readonly string[] | "any";
  /**
   * Some methods additionally depend on the visitor's own device — Apple Pay must
   * not be offered to a Windows/Chrome shopper even when fully configured. The
   * backend still decides *availability*; this only names an extra client-side
   * gate the checkout UI applies on top. It can never make an unavailable method
   * available.
   */
  clientCapability?: "apple-pay";
  /** Key the checkout/admin UI maps to a rendered mark. Avoids putting markup in the domain layer. */
  icon: "cash" | "bank" | "card" | "apple" | "iris" | "wallet";
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type PaymentConfigFieldType = "text" | "secret" | "url" | "textarea" | "boolean" | "select";

/**
 * Declarative description of one configuration input. The admin UI renders itself
 * from these — adding a field to a provider needs no UI change at all, which is
 * the point: connecting Piraeus later must not mean editing React components.
 */
export interface PaymentConfigField {
  key: string;
  label: string;
  type: PaymentConfigFieldType;
  /**
   * `secret: true` fields are encrypted at rest, never returned to the browser in
   * full, and never logged. The distinction is enforced in lib/payments/config.ts,
   * not left to each provider to remember.
   */
  secret: boolean;
  required: boolean;
  /** Only relevant in one environment, e.g. a test key vs a live key. */
  environment?: PaymentEnvironment;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
}

/** Plain (non-secret) config values, safe to send to an authorised admin's browser. */
export type PublicConfigValues = Record<string, string>;

/**
 * A provider's configuration as the server sees it: public values plus decrypted
 * secrets. This type is `server-only` by convention — it must never be returned
 * from a Route Handler or passed into a Client Component. `toAdminConfigView` in
 * lib/payments/config.ts produces the masked, browser-safe projection instead.
 */
export interface ResolvedProviderConfig {
  providerId: PaymentProviderId;
  environment: PaymentEnvironment;
  values: PublicConfigValues;
  secrets: Record<string, string>;
  /** True when the value came from an environment variable rather than the database. */
  sourcedFromEnv: Set<string>;
}

/** Admin-editable merchandising/availability settings for one method. */
export interface PaymentMethodSettings {
  methodId: PaymentMethodId;
  enabled: boolean;
  sortOrder: number;
  /** Overrides `PaymentMethodDefinition.defaultDisplayName` when set. */
  displayName: string | null;
  description: string | null;
  feeType: "none" | "fixed" | "percentage";
  /** Euros for `fixed`, percent (2 = 2%) for `percentage`. */
  feeValue: number;
  minimumAmount: number | null;
  maximumAmount: number | null;
  /** ISO country codes. Empty = every country. */
  countries: string[];
  /** Shipping rate ids this method is restricted to. Empty = every rate. */
  shippingRateIds: string[];
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** The order context a provider needs to create a payment. Never sourced from the browser. */
export interface PaymentOrderContext {
  orderId: string;
  customerEmail: string;
  customerId: string | null;
  lineItems: CartLineItem[];
  totals: CartTotals;
  shippingAddress: Address;
  billingAddress: Address;
}

/** The payment row as providers see it — no Prisma types leak into the provider layer. */
export interface PaymentRecord {
  id: string;
  orderId: string;
  providerId: PaymentProviderId;
  methodId: PaymentMethodId;
  externalPaymentId: string | null;
  amount: Money;
  refundedAmount: Money;
  status: PaymentStatus;
  environment: PaymentEnvironment;
  idempotencyKey: string;
  failureReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
}

export interface PaymentContext {
  config: ResolvedProviderConfig;
  method: PaymentMethodDefinition;
  payment: PaymentRecord;
  /** Present on initialize; omitted on later lifecycle calls, which work off the stored payment. */
  order?: PaymentOrderContext;
  /**
   * Stable per logical operation. Sent to providers that support it (Stripe's
   * `Idempotency-Key` header) so a retried request can never double-charge.
   */
  idempotencyKey: string;
  /**
   * Set when the selected provider settles through a different one (Apple Pay →
   * Stripe). The payment service resolves it from `processingProviderIdFor`, so a
   * delegating provider never has to reach into the registry itself — which would
   * be an import cycle, and would also let it read a provider it wasn't
   * authorised to use.
   */
  processingConfig?: ResolvedProviderConfig;
  /** Absolute URLs a redirecting provider sends the customer back to. Built server-side. */
  returnUrls?: { success: string; cancel: string };
}

export interface RefundContext extends PaymentContext {
  /** Refund amount. Callers pass the full remaining amount for a full refund. */
  amount: Money;
  reason?: string;
}

/**
 * What the customer must do next. `none` means the payment needs no further
 * customer interaction — either it's settled, or it's waiting on an admin
 * (COD/bank transfer) or on an external event (webhook).
 */
export type CustomerActionType = "none" | "redirect" | "display_instructions" | "display_qr" | "client_confirmation";

export interface CustomerAction {
  type: CustomerActionType;
  /** For `redirect`: where to send the shopper. Always provider-issued, never client-supplied. */
  redirectUrl?: string;
  /**
   * For `client_confirmation`: opaque, PUBLISHABLE handle the browser SDK needs
   * (e.g. a Stripe PaymentIntent client secret). Only ever a value the provider
   * explicitly designates as browser-safe — never an API secret.
   */
  clientSecret?: string;
  /** For `display_qr`: the payload to encode, plus an optional provider-rendered image. */
  qrPayload?: string;
  qrImageUrl?: string;
  /** For `display_instructions`: ordered, already-localised lines to show the customer. */
  instructions?: { label: string; value: string }[];
  message?: string;
  /** After this moment the action is void; the payment expires. */
  expiresAt?: string;
}

export interface PaymentResult {
  status: PaymentStatus;
  /** The provider's own id for this payment, stored for reconciliation. */
  externalPaymentId?: string;
  customerAction?: CustomerAction;
  failureReason?: string;
  /** Merged into the payment's metadata. Must never contain credentials. */
  metadata?: Record<string, unknown>;
  /** Amount actually refunded, for refund results. */
  refundedAmount?: Money;
}

export interface PaymentStatusResult {
  status: PaymentStatus;
  externalPaymentId?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

export type ConfigurationTestStatus = "connected" | "auth_failed" | "not_configured" | "unavailable" | "not_implemented";

export interface ConfigurationTestResult {
  status: ConfigurationTestStatus;
  message: string;
  /**
   * False when the result was determined without contacting the provider (missing
   * credentials, or an integration whose official spec we don't have yet). The
   * admin UI shows this verbatim so a "not configured" is never mistaken for a
   * verified connection — §19's "do not claim success if no real API request was
   * made", enforced in the type system rather than by convention.
   */
  checkedLive: boolean;
  details?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export interface WebhookRequest {
  /** Raw, unparsed body — signature verification must run against the exact bytes received. */
  rawBody: string;
  headers: Headers;
}

/**
 * A provider's webhook translated into the shared event vocabulary. Returning
 * `paymentId: null` (with `ignored: true`) is the correct response to a genuine
 * event about something we don't track, and is not an error.
 */
export interface NormalizedWebhookEvent {
  /** The provider's own event id — the idempotency key for duplicate suppression. */
  eventId: string;
  eventType: string;
  /** Our payment id, resolved by the provider from its payload. */
  paymentId: string | null;
  /** The provider's payment id, used as a fallback lookup when `paymentId` is absent. */
  externalPaymentId: string | null;
  status: PaymentStatus | null;
  failureReason?: string;
  refundedAmount?: Money;
  occurredAt?: string;
  ignored?: boolean;
  metadata?: Record<string, unknown>;
}

export class PaymentWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentWebhookVerificationError";
  }
}

// ---------------------------------------------------------------------------
// The provider contract
// ---------------------------------------------------------------------------

/**
 * Every payment integration implements exactly this. Checkout never sees it —
 * checkout talks to services/payments.ts, which resolves the provider from the
 * registry. That indirection is what lets a provider be swapped, disabled or
 * added without touching the checkout, the order model, or the database.
 *
 * Providers are stateless singletons: configuration arrives per call via
 * `PaymentContext.config` rather than being captured in a constructor, so a
 * credential change in the admin takes effect on the next request with no
 * process restart and no cache to invalidate.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly name: string;
  /** Short line shown on the admin settings card. */
  readonly description: string;
  readonly methods: readonly PaymentMethodDefinition[];
  readonly configFields: readonly PaymentConfigField[];
  /** False for internal providers (COD, bank transfer) that have no sandbox/live split. */
  readonly supportsEnvironments: boolean;
  /**
   * Whether the provider is on before an admin has touched anything. True only for
   * the two internal providers, matching `PaymentMethodDefinition.defaultEnabled` —
   * the two switches must agree, or a fresh install ships methods that are enabled
   * but whose provider is off, and checkout silently offers nothing.
   */
  readonly defaultEnabled: boolean;
  /** False for providers with no external API at all — the admin hides "Test Connection". */
  readonly supportsConnectionTest: boolean;
  readonly webhookSupported: boolean;
  /**
   * True for a provider whose boundary exists but whose real API isn't connected
   * (IRIS, Piraeus). The admin renders "Integration pending" rather than "Not
   * configured" for these, because the two are genuinely different problems: one is
   * solved by entering credentials, the other by supplying the bank's specification.
   * Collapsing them would let a fully filled-in form read as ready to take money.
   */
  readonly integrationPending?: boolean;
  /** Shown verbatim in the admin when `integrationPending` — what is actually needed to finish. */
  readonly pendingReason?: string;

  /**
   * Set when this provider doesn't settle money itself but routes through another
   * registered provider — Apple Pay is a presentation layer over whichever
   * processor is configured, not an acquirer. Returning an id makes the payment
   * service resolve that provider's configuration into `PaymentContext.processingConfig`.
   */
  readonly processingProviderIdFor?: (config: ResolvedProviderConfig) => PaymentProviderId | null;

  /** Cheap, synchronous, no network: are the required credentials present? */
  isConfigured(config: ResolvedProviderConfig): boolean;

  /** May contact the provider. Must never report success without a real check — see ConfigurationTestResult.checkedLive. */
  validateConfiguration(config: ResolvedProviderConfig): Promise<ConfigurationTestResult>;

  initializePayment(ctx: PaymentContext): Promise<PaymentResult>;
  confirmPayment(ctx: PaymentContext): Promise<PaymentResult>;
  cancelPayment(ctx: PaymentContext): Promise<PaymentResult>;
  refundPayment(ctx: RefundContext): Promise<PaymentResult>;
  getPaymentStatus(ctx: PaymentContext): Promise<PaymentStatusResult>;

  /** Present only when `webhookSupported`. Throws PaymentWebhookVerificationError on a bad signature. */
  parseWebhook?(request: WebhookRequest, config: ResolvedProviderConfig): Promise<NormalizedWebhookEvent>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type PaymentErrorCode =
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_NOT_IMPLEMENTED"
  | "METHOD_NOT_AVAILABLE"
  | "PAYMENT_NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "REFUND_NOT_SUPPORTED"
  | "REFUND_AMOUNT_INVALID"
  | "PROVIDER_ERROR"
  | "CONFIGURATION_INVALID";

export class PaymentError extends Error {
  code: PaymentErrorCode;
  /** Safe to show a shopper. Provider error text often is not, so it defaults to a generic line. */
  publicMessage: string;

  constructor(code: PaymentErrorCode, message: string, publicMessage?: string) {
    super(message);
    this.code = code;
    this.name = "PaymentError";
    this.publicMessage = publicMessage ?? "We couldn't process that payment. Please try another method.";
  }
}
