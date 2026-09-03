import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Scheduled deletion of personal data this shop no longer has a reason to hold (PRIV-001).
 *
 * The shop operates in Greece, so GDPR applies: personal data may be kept only as long as
 * the purpose it was collected for lasts. Two stores here had no end date at all.
 *
 * Nothing in this module touches an order, a customer or anything a person might later ask
 * for a copy of. It clears operational debris — a forensic copy of a webhook body, and the
 * IP addresses the rate limiter keys on.
 */

/**
 * Webhook bodies are kept for forensics: when a payment goes wrong, the exact bytes the
 * provider signed are what settles the argument. That need is measured in days, but the
 * payloads were kept forever — and a card provider's payload carries the shopper's name,
 * email, billing address and card metadata.
 *
 * Ninety days covers any dispute window a payment provider offers while ending the
 * indefinite hold.
 */
export const WEBHOOK_PAYLOAD_RETENTION_DAYS = 90;

/**
 * Rate-limit rows are IP addresses, which are personal data in the EU. They were pruned
 * opportunistically on ~1% of calls, which is unreliable at low traffic — the tail of a
 * quiet shop is exactly where rows sit longest. This makes it a scheduled certainty.
 *
 * Two days, comfortably past the longest window any limiter in this app uses (one hour).
 */
export const RATE_LIMIT_RETENTION_DAYS = 2;

export interface RetentionSummary {
  webhookPayloadsCleared: number;
  rateLimitRowsDeleted: number;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function runDataRetention(): Promise<RetentionSummary> {
  /**
   * The payload is BLANKED, not the row deleted.
   *
   * The event record itself is the audit trail — which events arrived, when, whether they
   * verified, whether they applied. Deleting the row would destroy that history and, worse,
   * free the `(provider, eventId)` unique constraint that makes replay suppression work: a
   * provider redelivering a two-year-old event would then be processed as new. Clearing
   * only the body removes the personal data and keeps both properties.
   */
  const cleared = await prisma.paymentWebhookEvent.updateMany({
    where: { receivedAt: { lt: daysAgo(WEBHOOK_PAYLOAD_RETENTION_DAYS) }, rawPayload: { not: "" } },
    data: { rawPayload: "" },
  });

  const rateLimits = await prisma.rateLimitAttempt.deleteMany({
    where: { createdAt: { lt: daysAgo(RATE_LIMIT_RETENTION_DAYS) } },
  });

  const summary = {
    webhookPayloadsCleared: cleared.count,
    rateLimitRowsDeleted: rateLimits.count,
  };

  if (summary.webhookPayloadsCleared > 0 || summary.rateLimitRowsDeleted > 0) {
    logger.info("Data retention pass completed", summary);
  }
  return summary;
}
