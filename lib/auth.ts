/**
 * Real admin authentication: an AdminUser row (Postgres, bcrypt-hashed
 * password) plus a jose-signed JWT session cookie. `jose` is chosen for
 * runtime portability (no native deps), not because it's strictly required —
 * Next 16 defaults proxy.ts/middleware to the Node.js runtime, so
 * `jsonwebtoken` would work here too.
 *
 * No `next/headers` import here on purpose: this module is shared by
 * proxy.ts (middleware, which uses NextRequest/NextResponse cookies, not
 * next/headers) and Server Actions alike. See lib/admin-session.ts for the
 * next/headers-based helpers used inside Server Components/Actions.
 *
 * `import "server-only"` is a hard build-time guard against this module
 * (which used to export a plaintext demo password) ever being pulled into a
 * client bundle again — a prior version of app/admin/login/page.tsx imported
 * DEMO_ADMIN_PASSWORD directly into a "use client" component to pre-fill the
 * login form, which shipped the plaintext password to every visitor's
 * browser regardless of whether the UI displayed it. Fixed by removing that
 * import entirely; this guard makes the same mistake a build error, not a
 * silent regression.
 */
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { AdminRole } from "@/types/admin";

export const ADMIN_SESSION_COOKIE = "alexandris_admin_session";

/**
 * The admin session cookie's attributes. `secure` was missing, which mattered more here
 * than anywhere else in the app: this cookie authenticates the account that edits prices,
 * reads customer addresses and issues refunds, and without the flag a browser will send it
 * over plain http://.
 *
 * Conditional on production so http://localhost still works in development — the same
 * condition lib/order-access-cookie.ts already used.
 */
export const ADMIN_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24,
};

/**
 * Removed deliberately — do not reintroduce.
 *
 * This module used to export DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD
 * ("admin@alexandris-demo.example" / "admin123"), which scripts/seed.ts wrote into the
 * database and README.md published. This repository is public and the shop is live, so a
 * fixed, well-known password for the account that can edit prices, read customer addresses
 * and delete orders is a credential leak by design rather than by accident — the seed only
 * had to run once against a real database for it to be real.
 *
 * The first admin's credentials now come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD, and
 * seed.ts generates a random password and prints it once when they are unset. Nothing that
 * grants access should be a constant in source control.
 */

export interface AdminSession {
  name: string;
  email: string;
  /** Was the literal `"admin"` — the type itself hardcoded the assumption that every
   * signed-in user is an admin, which is exactly what let editors through unchecked. */
  role: AdminRole;
}

export interface AdminSessionPayload {
  sub: string;
  email: string;
  name: string;
}

function getSecretKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signAdminSession(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(getSecretKey());
}

export async function verifyAdminSession(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string" || typeof payload.name !== "string") {
      return null;
    }
    return { sub: payload.sub, email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}
