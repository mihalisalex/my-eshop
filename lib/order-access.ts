import { SignJWT, jwtVerify } from "jose";

/**
 * Proof that this browser is the one that placed a given order.
 *
 * QA-041: the confirmation page used to treat the order id in `?order=` as sufficient
 * authority. That made a URL a bearer token for a document containing the customer's name,
 * full shipping address, phone number and what they bought — and unlike a session cookie, a
 * URL is written into browser history, kept in the `Referer` header when the page links
 * out, copied into chat messages, and logged by every proxy on the way. The ids are
 * unguessable cuids, so this was never brute-forceable; it leaks by being *shared*, which
 * is the failure mode a capability token in a URL always has.
 *
 * The id stays in the URL — redirect-based payment providers need a stable return URL they
 * can send the shopper back to, and that URL is built before the payment exists. What
 * changed is that the id alone no longer grants anything: it names which order to show, and
 * this cookie decides whether it may be shown.
 *
 * Deliberately NOT tied to a customer account: most orders here are guest checkouts, and a
 * guest still has to see their own confirmation. Signed-in customers are covered separately
 * by ownership, which is stronger and survives losing the cookie.
 *
 * No `next/headers` import — this file is shared by Route Handlers and Server Components
 * alike, matching lib/customer-auth.ts. See lib/order-access-cookie.ts for the
 * `next/headers` side.
 */
import "server-only";

export const ORDER_ACCESS_COOKIE = "alexandris_order_access";

/**
 * How many recent orders one browser can keep proof for. A shopper placing several orders in
 * a session must not lose access to the earlier ones, but the cookie has to stay small and
 * the list is FIFO-trimmed rather than unbounded.
 */
export const MAX_GRANTED_ORDERS = 10;

/**
 * Long enough that a shopper can reopen the tab tomorrow, short enough that a shared device
 * doesn't carry the grant indefinitely. Signed-in customers keep permanent access to their
 * own orders through /account/orders, so this expiring is not a loss of access to anything
 * that matters.
 */
const GRANT_TTL = "7d";

function getSecretKey() {
  // Reuses the customer session secret rather than adding a fourth: this grant is exactly as
  // sensitive as a customer session (it reads one order), it is issued and consumed by the
  // same storefront, and a secret nobody rotates because they forgot it exists is worse than
  // one that shares a rotation with something visible.
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) throw new Error("CUSTOMER_SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Signs a grant covering `orderIds`, most recent first. */
export async function signOrderAccess(orderIds: string[]): Promise<string> {
  return new SignJWT({ orders: orderIds.slice(0, MAX_GRANTED_ORDERS) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(GRANT_TTL)
    .sign(getSecretKey());
}

/** The order ids a grant token covers. Empty for a missing, expired, forged or malformed token. */
export async function readOrderAccess(token: string | undefined): Promise<string[]> {
  if (!token) return [];
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const orders = payload.orders;
    if (!Array.isArray(orders)) return [];
    return orders.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

/**
 * The new grant after placing `orderId`, given whatever the browser already had.
 *
 * Deduplicated and newest-first, so re-placing does not push an order out of its own list,
 * and the trim drops the oldest rather than the most relevant.
 */
export function withGrantedOrder(existing: string[], orderId: string): string[] {
  return [orderId, ...existing.filter((id) => id !== orderId)].slice(0, MAX_GRANTED_ORDERS);
}
