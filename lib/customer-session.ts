import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_SESSION_COOKIE, verifyCustomerSession, type CustomerSessionPayload } from "@/lib/customer-auth";
import { isSessionStillValid } from "@/lib/session-validity";

/**
 * A cryptographically valid JWT is not by itself proof the customer still
 * exists — the row can be deleted (or the database reseeded) while a 7-day
 * cookie lives on in the browser. Every caller treats `session.sub` as a live
 * customer id and hands it straight to Prisma, so a dangling session used to
 * surface as a foreign-key violation (an unhandled 500) rather than a clean
 * "signed out": `/api/wishlist` threw P2003 on `wishlists_customerId_fkey` for
 * every request carrying such a cookie, and the same latent failure existed on
 * every other write keyed by customerId (addresses, returns, back-in-stock).
 *
 * So the existence check is part of what "valid session" means here. It's
 * wrapped in React's `cache` so the extra indexed PK lookup happens at most
 * once per render pass no matter how many callers ask — the Data Access Layer
 * pattern the Next.js authentication guide recommends for exactly this.
 *
 * Note this deliberately can't clear the stale cookie: Server Components may
 * not mutate cookies. Callers redirect to login instead, and signing in issues
 * a fresh one. proxy.ts keeps its JWT-only check (it runs before the DB is
 * reachable) — it's the optimistic pass, this is the authoritative one.
 */
export const getCustomerSession = cache(async (): Promise<CustomerSessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifyCustomerSession(token);
  if (!session) return null;

  const customer = await prisma.customer.findUnique({
    where: { id: session.sub },
    select: { id: true, sessionsValidFrom: true },
  });
  if (!customer) return null;

  // A password change retires every session that predates it — see lib/session-validity.ts
  // (AUTH-001). Free here: the row was already being read for the existence check above.
  if (!isSessionStillValid(session.issuedAt, customer.sessionsValidFrom)) return null;

  return session;
});

/** For Route Handlers / mutations, where a thrown error becomes a 401 response, not a redirect. */
export async function requireCustomerSession(): Promise<CustomerSessionPayload> {
  const session = await getCustomerSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

/** For Server Component pages/layouts, where a redirect is the right failure mode. */
export async function requireCustomerSessionOrRedirect(): Promise<CustomerSessionPayload> {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");
  return session;
}
