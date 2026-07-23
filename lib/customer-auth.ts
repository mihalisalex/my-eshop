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
