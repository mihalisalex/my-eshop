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

/** Seeded by scripts/seed.ts for local/dev use only — never import this into client-reachable code (see the server-only guard above). */
export const DEMO_ADMIN_EMAIL = "admin@alexandris-demo.example";
export const DEMO_ADMIN_PASSWORD = "admin123";

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
