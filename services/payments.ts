import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { toJsonInput } from "@/lib/commerce/postgres/mappers";
import { round2 } from "@/lib/commerce/postgres/cart-totals";
import { paymentProviderRegistry } from "@/lib/payments/registry";
import { getAllMethodSettings, isProviderEnabled, recordConnectionTest, resolveProviderConfig } from "@/lib/payments/config";
import { evaluateMethodAvailability } from "@/lib/payments/availability";
import { computePaymentFee, describePaymentFee } from "@/lib/payments/fees";
import { assertTransition, eventTypeForStatus, isSettled } from "@/lib/payments/status";
import { derivePaymentIdempotencyKey } from "@/lib/payments/idempotency";
import { toPaymentRecord, toTimelineEntry, toWebhookRecord, type PaymentTimelineEntry, type PaymentWebhookRecord } from "@/lib/payments/mappers";
import {
  PaymentError,
  PaymentWebhookVerificationError,
  type ConfigurationTestResult,
  type CustomerAction,
  type NormalizedWebhookEvent,
  type PaymentActorType,
  type PaymentContext,
  type PaymentEventType,
  type PaymentMethodDefinition,
  type PaymentMethodId,
  type PaymentMethodSettings,
  type PaymentOrderContext,
  type PaymentProviderId,
  type PaymentRecord,
  type PaymentResult,
  type PaymentStatus,
  type ResolvedProviderConfig,
} from "@/lib/payments/types";
import type { Money } from "@/types";

export { derivePaymentIdempotencyKey };

/**
 * The payment service — the single seam between the rest of the application and
 * the provider layer.
 *
 * Checkout calls this. The admin calls this. The webhook route calls this. None
 * of them import a provider directly, which is what §1 means by
 * `Checkout → Payment Abstraction Layer → Selected Payment Provider`: adding
 * Viva Wallet or PayPal later touches lib/payments/providers/ and the registry,
 * and nothing else.
 */

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/** Browser-safe description of one method. Contains no credentials by construction. */
export interface AvailablePaymentMethod {
  id: PaymentMethodId;
  providerId: PaymentProviderId;
  displayName: string;
  description: string;
  type: string;
  icon: string;
  /** Server-computed surcharge for this order. Never derived in the browser. */
  fee: Money;
  feeLabel: string | null;
  requiresRedirect: boolean;
  requiresManualConfirmation: boolean;
  /** Extra device gate the checkout applies on top (Apple Pay). Can only remove, never add. */
  clientCapability?: string;
  sortOrder: number;
}

export interface PaymentMethodQuery {
  /** Order total BEFORE any payment fee. */
  amount: number;
  currencyCode: string;
  countryCode?: string;
  shippingRateId?: string;
}

export interface ProviderState {
  enabled: boolean;
  configured: boolean;
  config: ResolvedProviderConfig;
}

/**
 * Resolves every provider's enabled/configured state once. Providers that delegate
 * (Apple Pay) are additionally gated on their processor's state, because a wallet
 * whose processor has no API key would render a button that fails on click.
 *
 * Exported as `getProviderStates` below so the ADMIN reads the same answer the
 * checkout does. Calling `provider.isConfigured()` directly in the admin was a real
 * bug found during verification: Apple Pay reported "Connected" with no Stripe
 * credentials anywhere, because a delegating provider genuinely is configured — it
 * just has nothing to settle through.
 */
async function loadProviderStates(): Promise<Map<PaymentProviderId, ProviderState>> {
  const providers = paymentProviderRegistry.list();
  const entries = await Promise.all(
    providers.map(async (provider) => {
      const [config, enabled] = await Promise.all([
        resolveProviderConfig(provider.id),
        isProviderEnabled(provider.id),
      ]);
      return [provider.id, { enabled, configured: provider.isConfigured(config), config }] as const;
    })
  );
  const states = new Map<PaymentProviderId, ProviderState>(entries);

  for (const provider of providers) {
    const state = states.get(provider.id);
    if (!state || !provider.processingProviderIdFor) continue;
    const processorId = provider.processingProviderIdFor(state.config);
    const processorState = processorId ? states.get(processorId) : undefined;
    // Both conditions matter: a disabled processor means the store deliberately
    // turned that rail off, and an unconfigured one means it cannot charge anything.
    state.configured = state.configured && Boolean(processorState?.configured);
    state.enabled = state.enabled && Boolean(processorState?.enabled);
  }
  return states;
}

/** The admin's view of the same computation the checkout uses. */
export async function getProviderStates(): Promise<Map<PaymentProviderId, ProviderState>> {
  return loadProviderStates();
}

/**
 * The methods this store can accept AT ALL — enabled, and their provider both switched
 * on and configured — ignoring order-specific rules like minimums, destination country
 * or the chosen delivery rate.
 *
 * Deliberately separate from `getAvailablePaymentMethods`, which answers a narrower
 * question ("what may this particular order be paid with"). This one exists for the
 * footer's accepted-payment badges, which previously hardcoded
 * ["Visa","Mastercard","Amex","PayPal"] — advertising four card brands on every page of
 * a shop that could only take cash on delivery, one of which (PayPal) is not implemented
 * anywhere in the codebase.
 */
export async function getAcceptedPaymentMethodNames(): Promise<string[]> {
  const [settingsList, states] = await Promise.all([getAllMethodSettings(), loadProviderStates()]);
  const settingsById = new Map(settingsList.map((settings) => [settings.methodId, settings]));

  return paymentProviderRegistry
    .listMethods()
    .filter((definition) => {
      const settings = settingsById.get(definition.id);
      const state = states.get(definition.providerId);
      return Boolean(settings?.enabled && state?.enabled && state?.configured);
    })
    .sort((a, b) => (settingsById.get(a.id)?.sortOrder ?? 0) - (settingsById.get(b.id)?.sortOrder ?? 0))
    .map((definition) => settingsById.get(definition.id)?.displayName || definition.defaultDisplayName);
}

/**
 * What the checkout is allowed to show (§20/§21). The backend decides — the
 * storefront renders whatever comes back and nothing else, so enabling or
 * disabling a method in the admin changes checkout immediately with no deploy.
 */
export async function getAvailablePaymentMethods(query: PaymentMethodQuery): Promise<AvailablePaymentMethod[]> {
  const [settingsList, states] = await Promise.all([getAllMethodSettings(), loadProviderStates()]);
  const settingsById = new Map(settingsList.map((settings) => [settings.methodId, settings]));

  const available: AvailablePaymentMethod[] = [];
  for (const definition of paymentProviderRegistry.listMethods()) {
    const settings = settingsById.get(definition.id);
    const state = states.get(definition.providerId);
    if (!settings || !state) continue;

    const result = evaluateMethodAvailability({
      definition,
      settings,
      providerEnabled: state.enabled,
      providerConfigured: state.configured,
      amount: query.amount,
      currencyCode: query.currencyCode,
      countryCode: query.countryCode,
      shippingRateId: query.shippingRateId,
    });
    if (!result.available) continue;

    const fee = computePaymentFee(settings, query.amount);
    available.push({
      id: definition.id,
      providerId: definition.providerId,
      displayName: settings.displayName ?? definition.defaultDisplayName,
      description: settings.description ?? definition.defaultDescription,
      type: definition.type,
      icon: definition.icon,
      fee: { amount: fee, currencyCode: query.currencyCode },
      feeLabel: describePaymentFee(settings, query.currencyCode),
      requiresRedirect: definition.requiresRedirect,
      requiresManualConfirmation: definition.requiresManualConfirmation,
      clientCapability: definition.clientCapability,
      sortOrder: settings.sortOrder,
    });
  }

  return available.sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName));
}

/**
 * Re-validates a method at order time and returns its authoritative fee.
 *
 * This is the second half of "the backend validates it again". The checkout
 * already filtered the list, but that list was built from a request the browser
 * could have altered (a different total, a different country) — so the fee that
 * actually gets charged is computed here, from the server's own totals, against
 * settings read fresh from the database.
 */
export async function resolveSelectedMethod(
  methodId: PaymentMethodId,
  query: PaymentMethodQuery
): Promise<{ definition: PaymentMethodDefinition; settings: PaymentMethodSettings; fee: number }> {
  const definition = paymentProviderRegistry.getMethod(methodId);
  if (!definition) {
    throw new PaymentError("METHOD_NOT_AVAILABLE", `Unknown payment method "${methodId}".`, "That payment method isn't available.");
  }
  const [settingsList, states] = await Promise.all([getAllMethodSettings(), loadProviderStates()]);
  const settings = settingsList.find((s) => s.methodId === methodId);
  const state = states.get(definition.providerId);
  if (!settings || !state) {
    throw new PaymentError("METHOD_NOT_AVAILABLE", `No settings for payment method "${methodId}".`);
  }

  const result = evaluateMethodAvailability({
    definition,
    settings,
    providerEnabled: state.enabled,
    providerConfigured: state.configured,
    amount: query.amount,
    currencyCode: query.currencyCode,
    countryCode: query.countryCode,
    shippingRateId: query.shippingRateId,
  });
  if (!result.available) {
    throw new PaymentError(
      "METHOD_NOT_AVAILABLE",
      `Payment method "${methodId}" is not available: ${result.reason}`,
      "That payment method isn't available for this order. Please choose another."
    );
  }

  return { definition, settings, fee: computePaymentFee(settings, query.amount) };
}

// ---------------------------------------------------------------------------
// Creating a payment
// ---------------------------------------------------------------------------

export interface InitiatePaymentInput {
  order: PaymentOrderContext;
  methodId: PaymentMethodId;
  /** Absolute URLs for redirect-based providers. Built server-side from the request origin. */
  returnUrls?: { success: string; cancel: string };
  /** Bumped only when starting a genuinely new attempt after a failure. */
  attempt?: number;
}

export interface InitiatePaymentResult {
  payment: PaymentRecord;
  customerAction: CustomerAction | null;
}

/**
 * Creates (or recovers) the Payment row for an order and asks the provider to
 * start it.
 *
 * The amount comes from `order.totals.total`, which the server computed — never
 * from the request. That is the whole of §23's "server-side amount calculation":
 * there is no code path where a browser-supplied number reaches a provider.
 */
export async function initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
  const { order, methodId } = input;
  const idempotencyKey = derivePaymentIdempotencyKey(order.orderId, methodId, input.attempt ?? 0);

  const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
  if (existing) {
    // The retry path. Returning the stored record — and, for a redirect provider,
    // the stored redirect URL — means a shopper who refreshes mid-payment lands
    // back where they were rather than starting a second charge.
    const record = toPaymentRecord(existing);
    return { payment: record, customerAction: storedCustomerAction(record) };
  }

  const definition = paymentProviderRegistry.requireMethod(methodId);
  const provider = paymentProviderRegistry.require(definition.providerId);
  const config = await resolveProviderConfig(provider.id);

  const amount = order.totals.total;
  let created;
  try {
    created = await prisma.payment.create({
      data: {
        orderId: order.orderId,
        provider: provider.id,
        method: definition.id,
        amountAmount: amount.amount,
        currencyCode: amount.currencyCode,
        status: "pending",
        environment: config.environment,
        idempotencyKey,
        metadata: toJsonInput({}),
      },
    });
  } catch (error) {
    // Two concurrent requests can both pass the findUnique above; the loser hits
    // the unique constraint. Recovering here rather than surfacing a 500 is the
    // same race-tolerant pattern services/checkout.ts already uses for orders.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.payment.findUnique({ where: { idempotencyKey } });
      if (raced) {
        const record = toPaymentRecord(raced);
        return { payment: record, customerAction: storedCustomerAction(record) };
      }
    }
    throw error;
  }

  let record = toPaymentRecord(created);
  await recordTransaction(record.id, {
    eventType: "payment_created",
    status: "pending",
    actorType: "customer",
    actorId: order.customerId,
    amount,
    message: `Payment created via ${provider.name}.`,
    data: { method: definition.id, environment: config.environment },
  });

  const ctx = await buildContext({ provider: provider.id, record, definition, config, order, returnUrls: input.returnUrls });

  let result: PaymentResult;
  try {
    result = await provider.initializePayment(ctx);
  } catch (error) {
    // A provider that refuses (unconfigured, unimplemented, API down) must leave a
    // trail and a coherent status, not an orphaned `pending` row nobody can explain.
    const message = error instanceof Error ? error.message : String(error);
    await recordTransaction(record.id, {
      eventType: "provider_error",
      actorType: "provider",
      message,
      data: { operation: "initializePayment" },
    });
    record = await applyStatus(record, { status: "failed", failureReason: message }, { actorType: "provider" });
    throw error;
  }

  record = await applyStatus(record, result, { actorType: "provider" });
  return { payment: record, customerAction: result.customerAction ?? null };
}

/** Rebuilds the customer action for a recovered payment, so a refresh resumes rather than restarts. */
function storedCustomerAction(record: PaymentRecord): CustomerAction | null {
  const redirectUrl = record.metadata.customerRedirectUrl;
  if (typeof redirectUrl === "string" && record.status === "awaiting_customer_action") {
    return { type: "redirect", redirectUrl };
  }
  const instructions = record.metadata.customerInstructions;
  if (Array.isArray(instructions)) {
    return {
      type: "display_instructions",
      instructions: instructions as { label: string; value: string }[],
      message: typeof record.metadata.customerMessage === "string" ? record.metadata.customerMessage : undefined,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

interface TransitionOptions {
  actorType?: PaymentActorType;
  actorId?: string | null;
  /** Overrides the event type derived from the target status (e.g. a manual confirmation). */
  eventType?: PaymentEventType;
  message?: string;
  data?: Record<string, unknown>;
}

/**
 * THE chokepoint. Every status change in the application funnels through here, so
 * the state machine cannot be bypassed — not by a webhook, not by an admin action,
 * and certainly not by anything client-side, which has no route to it at all.
 */
async function applyStatus(
  record: PaymentRecord,
  result: PaymentResult,
  options: TransitionOptions = {}
): Promise<PaymentRecord> {
  const nextStatus = result.status;
  assertTransition(record.status, nextStatus);

  const now = new Date();
  const changed = nextStatus !== record.status;

  const metadata: Record<string, unknown> = { ...record.metadata, ...(result.metadata ?? {}) };
  // Persist the customer action so a resumed payment can replay it (see
  // storedCustomerAction). Only the browser-safe parts — a client secret is
  // deliberately NOT stored, since it would then sit in the database far longer
  // than the few minutes it is useful for.
  if (result.customerAction?.redirectUrl) metadata.customerRedirectUrl = result.customerAction.redirectUrl;
  if (result.customerAction?.instructions) metadata.customerInstructions = result.customerAction.instructions;
  if (result.customerAction?.message) metadata.customerMessage = result.customerAction.message;
  if (result.customerAction?.qrPayload) metadata.customerQrPayload = result.customerAction.qrPayload;

  const updated = await prisma.payment.update({
    where: { id: record.id },
    data: {
      status: nextStatus,
      ...(result.externalPaymentId ? { externalPaymentId: result.externalPaymentId } : {}),
      ...(result.failureReason === undefined ? {} : { failureReason: result.failureReason }),
      ...(result.refundedAmount ? { refundedAmount: result.refundedAmount.amount } : {}),
      metadata: toJsonInput(metadata),
      // Timestamps are set once, on the transition that earns them — re-applying a
      // duplicate `succeeded` webhook must not move `paidAt` forward.
      ...(changed && nextStatus === "paid" && !record.paidAt ? { paidAt: now } : {}),
      ...(changed && nextStatus === "failed" ? { failedAt: now } : {}),
      ...(changed && nextStatus === "cancelled" ? { cancelledAt: now } : {}),
      ...(changed && (nextStatus === "refunded" || nextStatus === "partially_refunded") ? { refundedAt: now } : {}),
    },
  });

  if (changed) {
    await recordTransaction(record.id, {
      eventType: options.eventType ?? eventTypeForStatus(nextStatus),
      status: nextStatus,
      actorType: options.actorType ?? "system",
      actorId: options.actorId ?? null,
      amount: result.refundedAmount,
      message: options.message ?? result.failureReason ?? null,
      data: options.data,
    });
  }

  return toPaymentRecord(updated);
}

export interface RecordTransactionInput {
  eventType: PaymentEventType;
  status?: PaymentStatus | null;
  actorType?: PaymentActorType;
  actorId?: string | null;
  amount?: Money | null;
  message?: string | null;
  data?: Record<string, unknown>;
}

export async function recordTransaction(paymentId: string, input: RecordTransactionInput): Promise<void> {
  await prisma.paymentTransaction.create({
    data: {
      paymentId,
      eventType: input.eventType,
      status: input.status ?? null,
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
      amountAmount: input.amount?.amount ?? null,
      currencyCode: input.amount?.currencyCode ?? null,
      message: input.message ?? null,
      data: toJsonInput(input.data ?? {}),
    },
  });
}

async function buildContext(input: {
  provider: PaymentProviderId;
  record: PaymentRecord;
  definition: PaymentMethodDefinition;
  config: ResolvedProviderConfig;
  order?: PaymentOrderContext;
  returnUrls?: { success: string; cancel: string };
}): Promise<PaymentContext> {
  const provider = paymentProviderRegistry.require(input.provider);
  let processingConfig: ResolvedProviderConfig | undefined;
  if (provider.processingProviderIdFor) {
    const processorId = provider.processingProviderIdFor(input.config);
    // Resolved HERE rather than inside the delegating provider: it keeps the
    // registry out of the provider layer (an import cycle) and means a provider
    // can only ever read the credentials of the processor it declared.
    if (processorId) processingConfig = await resolveProviderConfig(processorId);
  }
  return {
    config: input.config,
    method: input.definition,
    payment: input.record,
    order: input.order,
    idempotencyKey: input.record.idempotencyKey,
    processingConfig,
    returnUrls: input.returnUrls,
  };
}

async function contextForPayment(record: PaymentRecord): Promise<PaymentContext> {
  const definition = paymentProviderRegistry.requireMethod(record.methodId);
  const config = await resolveProviderConfig(record.providerId);
  return buildContext({ provider: record.providerId, record, definition, config });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getPaymentById(id: string): Promise<PaymentRecord | null> {
  const row = await prisma.payment.findUnique({ where: { id } });
  return row ? toPaymentRecord(row) : null;
}

export async function getPaymentsForOrder(orderId: string): Promise<PaymentRecord[]> {
  const rows = await prisma.payment.findMany({ where: { orderId }, orderBy: { createdAt: "desc" } });
  return rows.map(toPaymentRecord);
}

/** The payment that represents the order's money today — the settled one if there is one, else the latest attempt. */
export async function getPrimaryPaymentForOrder(orderId: string): Promise<PaymentRecord | null> {
  const payments = await getPaymentsForOrder(orderId);
  return payments.find((payment) => isSettled(payment.status)) ?? payments[0] ?? null;
}

export async function getPaymentTimeline(paymentId: string): Promise<PaymentTimelineEntry[]> {
  const rows = await prisma.paymentTransaction.findMany({
    where: { paymentId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toTimelineEntry);
}

export async function getPaymentWebhooks(paymentId: string): Promise<PaymentWebhookRecord[]> {
  const rows = await prisma.paymentWebhookEvent.findMany({
    where: { paymentId },
    orderBy: { receivedAt: "desc" },
  });
  return rows.map(toWebhookRecord);
}

export interface AdminPaymentFilters {
  provider?: string;
  method?: string;
  status?: string;
  orderId?: string;
  customerEmail?: string;
  from?: Date;
  to?: Date;
}

export interface AdminPaymentRow extends PaymentRecord {
  customerEmail: string;
  orderStatus: string;
}

export async function listPaymentsForAdmin(filters: AdminPaymentFilters = {}): Promise<AdminPaymentRow[]> {
  const rows = await prisma.payment.findMany({
    where: {
      ...(filters.provider ? { provider: filters.provider } : {}),
      ...(filters.method ? { method: filters.method } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.orderId ? { orderId: filters.orderId } : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
      ...(filters.customerEmail
        ? { order: { customerEmail: { contains: filters.customerEmail, mode: "insensitive" } } }
        : {}),
    },
    include: { order: { select: { customerEmail: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows.map((row) => ({
    ...toPaymentRecord(row),
    customerEmail: row.order.customerEmail,
    orderStatus: row.order.status,
  }));
}

export interface PaymentDashboardStats {
  paidToday: { count: number; amount: number; currencyCode: string };
  pending: number;
  failed: number;
  awaitingBankTransfer: number;
  enabledMethods: number;
  activeProviders: number;
}

export async function getPaymentDashboardStats(): Promise<PaymentDashboardStats> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [paidToday, pending, failed, awaitingBankTransfer, settings, states] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: startOfToday } },
      select: { amountAmount: true, currencyCode: true },
    }),
    prisma.payment.count({ where: { status: { in: ["pending", "awaiting_customer_action", "processing"] } } }),
    prisma.payment.count({ where: { status: "failed" } }),
    prisma.payment.count({ where: { status: "awaiting_bank_transfer" } }),
    getAllMethodSettings(),
    loadProviderStates(),
  ]);

  return {
    paidToday: {
      count: paidToday.length,
      amount: round2(paidToday.reduce((sum, row) => sum + Number(row.amountAmount), 0)),
      currencyCode: paidToday[0]?.currencyCode ?? "EUR",
    },
    pending,
    failed,
    awaitingBankTransfer,
    enabledMethods: settings.filter((s) => s.enabled).length,
    // "Active" means genuinely usable — enabled AND configured. Counting merely
    // enabled providers would report an unconnected IRIS as active.
    activeProviders: [...states.values()].filter((state) => state.enabled && state.configured).length,
  };
}

// ---------------------------------------------------------------------------
// Admin & lifecycle actions
// ---------------------------------------------------------------------------

/**
 * Verifies a payment against its provider and applies whatever the provider says.
 *
 * This is what runs when a shopper returns from a redirect (§14: never trust a
 * frontend redirect as proof of payment) and behind the admin's "Refresh status".
 * The browser's arrival triggers the check; the provider's answer is the fact.
 */
export async function verifyPaymentWithProvider(paymentId: string): Promise<PaymentRecord> {
  const record = await requirePayment(paymentId);
  const provider = paymentProviderRegistry.require(record.providerId);
  const ctx = await contextForPayment(record);

  try {
    const result = await provider.confirmPayment(ctx);
    return applyStatus(record, result, {
      actorType: "provider",
      message: "Verified server-side with the provider.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordTransaction(record.id, {
      eventType: "provider_error",
      actorType: "provider",
      message,
      data: { operation: "confirmPayment" },
    });
    // Deliberately does NOT fail the payment: a provider being briefly unreachable
    // is not the same as a customer's payment failing, and marking it failed here
    // would cancel a payment that may well have succeeded.
    return record;
  }
}

/**
 * The admin's "Mark as paid / collected" action for manual methods (§4, §5).
 *
 * Restricted to methods that actually settle manually — allowing it on a Stripe
 * payment would let an admin mark an order paid that Stripe never captured, which
 * is a reconciliation hole, not a convenience.
 */
export async function confirmManualPayment(paymentId: string, adminId: string, note?: string): Promise<PaymentRecord> {
  const record = await requirePayment(paymentId);
  const definition = paymentProviderRegistry.requireMethod(record.methodId);
  if (!definition.requiresManualConfirmation) {
    throw new PaymentError(
      "INVALID_STATUS_TRANSITION",
      `${definition.name} settles through its provider — it can't be marked paid by hand. Use "Refresh status" to re-verify it instead.`
    );
  }
  if (record.status === "paid") {
    // The duplicate-confirmation guard. Two admins clicking at once, or one
    // double-clicking, must not append a second "payment received" to the ledger.
    throw new PaymentError("INVALID_STATUS_TRANSITION", "This payment is already marked as paid.");
  }

  const provider = paymentProviderRegistry.require(record.providerId);
  const ctx = await contextForPayment(record);
  const result = await provider.confirmPayment(ctx);
  return applyStatus(record, result, {
    actorType: "admin",
    actorId: adminId,
    eventType: "manual_payment_confirmation",
    message: note?.trim() || `Manually confirmed by an administrator (${definition.name}).`,
  });
}

export async function cancelPayment(paymentId: string, adminId: string, reason?: string): Promise<PaymentRecord> {
  const record = await requirePayment(paymentId);
  const provider = paymentProviderRegistry.require(record.providerId);
  const ctx = await contextForPayment(record);
  const result = await provider.cancelPayment(ctx);
  return applyStatus(record, result, {
    actorType: "admin",
    actorId: adminId,
    message: reason?.trim() || "Cancelled by an administrator.",
  });
}

export async function refundPayment(
  paymentId: string,
  amount: number,
  adminId: string,
  reason?: string
): Promise<PaymentRecord> {
  const record = await requirePayment(paymentId);
  const definition = paymentProviderRegistry.requireMethod(record.methodId);
  if (!definition.supportsRefunds) {
    throw new PaymentError("REFUND_NOT_SUPPORTED", `${definition.name} doesn't support refunds.`);
  }

  const requested = round2(amount);
  const remaining = round2(record.amount.amount - record.refundedAmount.amount);
  if (requested <= 0) throw new PaymentError("REFUND_AMOUNT_INVALID", "Refund amount must be greater than zero.");
  if (requested > remaining + 0.005) {
    throw new PaymentError(
      "REFUND_AMOUNT_INVALID",
      `Only ${remaining.toFixed(2)} ${record.amount.currencyCode} is left to refund on this payment.`
    );
  }
  if (requested < remaining - 0.005 && !definition.supportsPartialRefunds) {
    throw new PaymentError("REFUND_NOT_SUPPORTED", `${definition.name} only supports full refunds.`);
  }

  const provider = paymentProviderRegistry.require(record.providerId);
  const baseCtx = await contextForPayment(record);
  const result = await provider.refundPayment({
    ...baseCtx,
    amount: { amount: requested, currencyCode: record.amount.currencyCode },
    reason,
  });

  return applyStatus(record, result, {
    actorType: "admin",
    actorId: adminId,
    message: reason?.trim() || `Refunded ${requested.toFixed(2)} ${record.amount.currencyCode}.`,
    data: { refundAmount: requested },
  });
}

async function requirePayment(paymentId: string): Promise<PaymentRecord> {
  const record = await getPaymentById(paymentId);
  if (!record) throw new PaymentError("PAYMENT_NOT_FOUND", `No payment with id "${paymentId}".`);
  return record;
}

// ---------------------------------------------------------------------------
// Connection testing
// ---------------------------------------------------------------------------

export async function testProviderConnection(providerId: PaymentProviderId): Promise<ConfigurationTestResult> {
  const provider = paymentProviderRegistry.require(providerId);
  const config = await resolveProviderConfig(providerId);
  let result: ConfigurationTestResult;
  try {
    result = await provider.validateConfiguration(config);
  } catch (error) {
    result = {
      status: "unavailable",
      message: error instanceof Error ? error.message : String(error),
      checkedLive: true,
    };
  }
  await recordConnectionTest(providerId, result.status, result.message);
  return result;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export interface WebhookProcessingResult {
  status: "processed" | "duplicate" | "ignored" | "unverified" | "failed";
  message: string;
}

/**
 * The generic webhook pipeline every provider shares (§14).
 *
 * Order of operations matters and is not arbitrary:
 *   1. Store the raw payload FIRST, before verification. An event that fails its
 *      signature check is exactly the one worth keeping — it's either an attack or
 *      a misconfiguration, and both are invisible if we drop it.
 *   2. Verify the signature against those exact bytes.
 *   3. Deduplicate on (provider, eventId) via a database unique constraint, not an
 *      in-memory set — serverless instances don't share memory, so anything less
 *      than a constraint lets a retried event through on a second instance.
 *   4. Only then apply the status, through the same guarded transition every other
 *      caller uses.
 */
export async function handleProviderWebhook(
  providerId: PaymentProviderId,
  rawBody: string,
  headers: Headers
): Promise<WebhookProcessingResult> {
  const provider = paymentProviderRegistry.get(providerId);
  if (!provider?.parseWebhook) {
    return { status: "ignored", message: `Provider "${providerId}" does not accept webhooks.` };
  }
  const config = await resolveProviderConfig(providerId);

  // A payload-hash fallback id keeps the at-most-once guarantee for providers that
  // don't issue an event id: an identical retried body is recognised as the same event.
  const fallbackEventId = `sha256:${createHash("sha256").update(rawBody).digest("hex")}`;

  let event: NormalizedWebhookEvent | null = null;
  let verificationError: string | null = null;
  try {
    event = await provider.parseWebhook({ rawBody, headers }, config);
  } catch (error) {
    if (error instanceof PaymentWebhookVerificationError) {
      verificationError = error.message;
    } else {
      verificationError = error instanceof Error ? error.message : String(error);
    }
  }

  const eventId = event?.eventId || fallbackEventId;
  const eventType = event?.eventType ?? "unparsed";

  // Resolve our payment before writing, so the stored row is already linked and an
  // operator looking at a failed delivery can see which payment it concerned.
  const payment = event ? await findPaymentForEvent(event) : null;

  let stored;
  try {
    stored = await prisma.paymentWebhookEvent.create({
      data: {
        provider: providerId,
        eventId,
        eventType,
        paymentId: payment?.id ?? null,
        rawPayload: rawBody.slice(0, 100_000),
        verified: verificationError === null,
        processingStatus: "received",
        errorMessage: verificationError,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Already seen. Acknowledged with a 200 by the caller so the provider stops
      // retrying — §15's "receives the same webhook twice" case.
      return { status: "duplicate", message: "This event has already been received." };
    }
    throw error;
  }

  if (verificationError || !event) {
    await prisma.paymentWebhookEvent.update({
      where: { id: stored.id },
      data: { processingStatus: "failed", processedAt: new Date() },
    });
    return { status: "unverified", message: verificationError ?? "Could not parse the webhook payload." };
  }

  if (event.ignored || !event.status || !payment) {
    await prisma.paymentWebhookEvent.update({
      where: { id: stored.id },
      data: { processingStatus: "ignored", processedAt: new Date() },
    });
    return {
      status: "ignored",
      message: payment ? `No action for event type "${event.eventType}".` : "No matching payment for this event.",
    };
  }

  await recordTransaction(payment.id, {
    eventType: "webhook_received",
    actorType: "provider",
    message: `${providerId}: ${event.eventType}`,
    data: { eventId, externalPaymentId: event.externalPaymentId },
  });

  try {
    await applyStatus(
      payment,
      {
        status: event.status,
        externalPaymentId: event.externalPaymentId ?? undefined,
        failureReason: event.failureReason,
        refundedAmount: event.refundedAmount,
      },
      { actorType: "provider", message: `Applied from ${providerId} webhook ${event.eventType}.` }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.paymentWebhookEvent.update({
      where: { id: stored.id },
      data: { processingStatus: "failed", errorMessage: message, processedAt: new Date() },
    });
    // Out-of-order delivery (a `succeeded` arriving after a `refunded`) is a
    // legitimate provider behaviour, and the state machine correctly refuses it.
    // Recording and acknowledging beats a 500 that makes the provider retry
    // forever and eventually disable the endpoint.
    return { status: "failed", message };
  }

  await prisma.paymentWebhookEvent.update({
    where: { id: stored.id },
    data: { processingStatus: "processed", processedAt: new Date() },
  });
  return { status: "processed", message: `Applied ${event.eventType}.` };
}

/**
 * Our own payment id, carried in provider metadata, is the primary key — it
 * survives the provider swapping its own identifiers mid-flow (a Stripe Checkout
 * Session becoming a PaymentIntent, for instance). The external id is the fallback
 * for providers that can't echo custom metadata.
 */
async function findPaymentForEvent(event: NormalizedWebhookEvent): Promise<PaymentRecord | null> {
  if (event.paymentId) {
    const byId = await prisma.payment.findUnique({ where: { id: event.paymentId } });
    if (byId) return toPaymentRecord(byId);
  }
  if (event.externalPaymentId) {
    const byExternal = await prisma.payment.findFirst({
      where: { externalPaymentId: event.externalPaymentId },
      orderBy: { createdAt: "desc" },
    });
    if (byExternal) return toPaymentRecord(byExternal);
  }
  return null;
}
