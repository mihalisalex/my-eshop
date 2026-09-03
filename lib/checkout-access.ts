import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Proof that this browser is the one that started a given checkout (SEC-001).
 *
 * The checkout id alone used to authorize everything: anyone holding one could PATCH a
 * trivial field and receive the whole checkout back — email, phone, shipping and billing
 * address — and, worse, OVERWRITE the delivery address before the order was placed. The
 * ids are unguessable cuids and never appear in a page URL, so this was never
 * brute-forceable; it is the same failure mode a bearer capability always has, which is
 * that anything which learns the id gets full authority with it.
 *
 * Same shape and reasoning as lib/order-access.ts, deliberately: the id stays where it is
 * and keeps naming WHICH checkout, and this cookie decides whether it may be touched.
 *
 * Not tied to a customer account, because guest checkout is the common case here and a
 * guest must still be able to complete their own purchase.
 */

export const CHECKOUT_ACCESS_COOKIE = "alexandris_checkout_access";

/** One browser can hold a few checkouts at once — an abandoned one, a retried one. FIFO-trimmed. */
const MAX_GRANTED = 5;

/**
 * Short by design. A checkout is a single sitting, unlike an order confirmation someone
 * may reopen days later; anything longer just widens the window on a shared device.
 */
const GRANT_TTL = "24h";

function getSecretKey() {
  // Reuses the customer session secret for the same reason lib/order-access.ts does: this
  // grant is exactly as sensitive as a customer session, it is issued and consumed by the
  // same storefront, and a secret nobody rotates because they forgot it exists is worse
  // than one sharing a rotation with something visible.
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) throw new Error("CUSTOMER_SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signCheckoutAccess(checkoutIds: string[]): Promise<string> {
  return new SignJWT({ checkouts: checkoutIds.slice(0, MAX_GRANTED) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(GRANT_TTL)
    .sign(getSecretKey());
}

/** The checkout ids a token covers. Empty for a missing, expired, forged or malformed token. */
export async function readCheckoutAccess(token: string | undefined): Promise<string[]> {
  if (!token) return [];
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const checkouts = payload.checkouts;
    if (!Array.isArray(checkouts)) return [];
    return checkouts.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

/** Records that this browser started `checkoutId`, keeping grants for recent ones. */
export async function grantCheckoutAccess(checkoutId: string): Promise<void> {
  const cookieStore = await cookies();
  const existing = await readCheckoutAccess(cookieStore.get(CHECKOUT_ACCESS_COOKIE)?.value);
  const next = [checkoutId, ...existing.filter((id) => id !== checkoutId)];

  cookieStore.set(CHECKOUT_ACCESS_COOKIE, await signCheckoutAccess(next), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, not Strict — a redirect-based payment provider returns the shopper by a
    // cross-site top-level navigation, and Strict withholds the cookie on exactly that
    // request. The same reasoning as every other cookie in this app.
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

/** Whether this request may read or modify `checkoutId`. */
export async function canAccessCheckout(checkoutId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const granted = await readCheckoutAccess(cookieStore.get(CHECKOUT_ACCESS_COOKIE)?.value);
  return granted.includes(checkoutId);
}
