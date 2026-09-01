/**
 * Real customer authentication: a Customer row (Postgres, bcrypt-hashed
 * password) plus a jose-signed JWT session cookie — same pattern as
 * lib/auth.ts's admin session, with its own secret (CUSTOMER_SESSION_SECRET,
 * separate from ADMIN_SESSION_SECRET so compromising one doesn't compromise
 * the other) and a longer expiry (7 days, matching the old mock's
 * SESSION_TTL_MS) since customers expect to stay signed in across visits.
 *
 * No `next/headers` import here on purpose — shared by proxy.ts (which uses
 * NextRequest/NextResponse cookies, not next/headers) and Route Handlers
 * alike. See lib/customer-session.ts for the next/headers-based helpers used
 * inside Server Components/Route Handlers.
 */
import { SignJWT, jwtVerify } from "jose";

export const CUSTOMER_SESSION_COOKIE = "alexandris_customer_session";

export const CUSTOMER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * One definition of how the session cookie is set, because there are four places that set
 * it — sign-in, sign-up, password reset and the OAuth callback — and four copies of a
 * security policy is four chances for one to drift.
 *
 * It already had. Every copy was missing `secure`, while lib/order-access-cookie.ts (a
 * strictly less sensitive cookie, granting a view of one order) set it correctly. Without
 * it the browser will send the session over plain http:// — which on a site behind HSTS is
 * a narrow window, but the cookie that authenticates a customer should not be the one
 * relying on a header to protect it.
 *
 * `secure` is conditional on production only so http://localhost still works in dev, the
 * same condition order-access-cookie already uses.
 *
 * SameSite stays "lax" rather than "strict": a redirect-based payment provider returns the
 * shopper by cross-site top-level navigation, and Strict withholds the cookie on exactly
 * that request.
 */
export const CUSTOMER_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
};

export interface CustomerSessionPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
}

function getSecretKey() {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) throw new Error("CUSTOMER_SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signCustomerSession(payload: CustomerSessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, firstName: payload.firstName, lastName: payload.lastName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifyCustomerSession(token: string): Promise<CustomerSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.firstName !== "string" ||
      typeof payload.lastName !== "string"
    ) {
      return null;
    }
    return { sub: payload.sub, email: payload.email, firstName: payload.firstName, lastName: payload.lastName };
  } catch {
    return null;
  }
}
