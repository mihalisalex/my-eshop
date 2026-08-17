import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PaymentEnvironment, PaymentRecord, PaymentStatus } from "@/lib/payments/types";

/**
 * Row → domain projection, mirroring lib/commerce/postgres/mappers.ts.
 *
 * The point of the boundary is that no provider, no Route Handler and no React
 * component ever touches a Prisma type or a `Decimal`. Money crosses as
 * `{ amount, currencyCode }` exactly like everywhere else in this app.
 */

type PaymentRow = Prisma.PaymentGetPayload<object>;

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === "number" ? value : Number(value);
}

function asMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function toPaymentRecord(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    providerId: row.provider,
    methodId: row.method,
    externalPaymentId: row.externalPaymentId,
    amount: { amount: toNumber(row.amountAmount), currencyCode: row.currencyCode },
    refundedAmount: { amount: toNumber(row.refundedAmount), currencyCode: row.currencyCode },
    // Cast rather than parse: the column is only ever written through
    // lib/payments/status.ts's guarded transitions, so an unknown value here would
    // mean someone edited the database by hand — which no amount of runtime
    // validation could make safe anyway.
    status: row.status as PaymentStatus,
    environment: (row.environment === "production" ? "production" : "sandbox") as PaymentEnvironment,
    idempotencyKey: row.idempotencyKey,
    failureReason: row.failureReason,
    metadata: asMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    refundedAt: row.refundedAt?.toISOString() ?? null,
  };
}

export interface PaymentTimelineEntry {
  id: string;
  eventType: string;
  status: string | null;
  actorType: string;
  actorId: string | null;
  amount: { amount: number; currencyCode: string } | null;
  message: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export function toTimelineEntry(row: Prisma.PaymentTransactionGetPayload<object>): PaymentTimelineEntry {
  return {
    id: row.id,
    eventType: row.eventType,
    status: row.status,
    actorType: row.actorType,
    actorId: row.actorId,
    amount:
      row.amountAmount === null
        ? null
        : { amount: toNumber(row.amountAmount), currencyCode: row.currencyCode ?? "EUR" },
    message: row.message,
    data: asMetadata(row.data),
    createdAt: row.createdAt.toISOString(),
  };
}

export interface PaymentWebhookRecord {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  verified: boolean;
  processingStatus: string;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
}

export function toWebhookRecord(row: Prisma.PaymentWebhookEventGetPayload<object>): PaymentWebhookRecord {
  return {
    id: row.id,
    provider: row.provider,
    eventId: row.eventId,
    eventType: row.eventType,
    verified: row.verified,
    processingStatus: row.processingStatus,
    errorMessage: row.errorMessage,
    receivedAt: row.receivedAt.toISOString(),
    processedAt: row.processedAt?.toISOString() ?? null,
  };
}
