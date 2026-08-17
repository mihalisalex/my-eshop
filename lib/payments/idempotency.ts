import { createHash } from "node:crypto";

/**
 * Deterministic idempotency key for a payment attempt (§15).
 *
 * Kept as its own pure module rather than living inside services/payments.ts so it
 * is testable without a database — this is the single mechanism standing between a
 * double-clicked Pay button and two charges, and it deserves direct coverage.
 *
 * The key is derived from the order, the method and an attempt counter:
 *  - Same order + same method → same key, so a refresh, a retried request after a
 *    dropped connection, or a return from a payment provider all find the existing
 *    payment instead of creating a second one.
 *  - Different method → different key, which is correct: switching from a declined
 *    card to Cash on Delivery genuinely is a new attempt.
 *  - `attempt` is bumped only when deliberately retrying the SAME method after a
 *    failure, which is the one case where a fresh provider-side payment is wanted.
 *
 * Hashed rather than concatenated so the key is fixed-length and reveals nothing
 * about internal ids if it ever appears in a provider's dashboard or logs.
 */
export function derivePaymentIdempotencyKey(orderId: string, methodId: string, attempt = 0): string {
  const hash = createHash("sha256").update(`${orderId}:${methodId}:${attempt}`).digest("hex").slice(0, 32);
  return `pay_${hash}`;
}
