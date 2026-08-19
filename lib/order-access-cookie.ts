import "server-only";
import { cookies } from "next/headers";
import { ORDER_ACCESS_COOKIE, readOrderAccess, signOrderAccess, withGrantedOrder } from "@/lib/order-access";
import { getCustomerSession } from "@/lib/customer-session";
import { prisma } from "@/lib/prisma";

/**
 * The `next/headers` half of the order-access grant — kept separate from lib/order-access.ts
 * so the signing logic stays importable from contexts that have a NextRequest instead
 * (proxy.ts, and anything reading cookies off a request object).
 */

/** Records that this browser placed `orderId`, preserving grants for earlier orders. */
export async function grantOrderAccess(orderId: string): Promise<void> {
  const cookieStore = await cookies();
  const existing = await readOrderAccess(cookieStore.get(ORDER_ACCESS_COOKIE)?.value);
  const token = await signOrderAccess(withGrantedOrder(existing, orderId));

  cookieStore.set(ORDER_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, NOT Strict. A redirect-based payment provider returns the shopper via a
    // cross-site top-level navigation; under Strict the cookie is withheld on exactly that
    // request, so the shopper would come back from paying and be told they cannot see their
    // own order. Lax sends it for top-level GETs, which is precisely this case.
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

/**
 * Whether the current request may see `orderId`.
 *
 * Two independent ways to qualify, checked cheapest-first:
 *   1. this browser placed it (the grant cookie), which is what covers guest checkout; or
 *   2. the signed-in customer owns it, which is stronger and survives losing the cookie —
 *      a customer who clears cookies must still be able to open their order from /account.
 */
export async function canAccessOrder(orderId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const granted = await readOrderAccess(cookieStore.get(ORDER_ACCESS_COOKIE)?.value);
  if (granted.includes(orderId)) return true;

  const session = await getCustomerSession();
  if (!session) return false;

  // Only the id is selected: this is an authorization check, not a read of the order.
  const owned = await prisma.order.findFirst({
    where: { id: orderId, customerId: session.sub },
    select: { id: true },
  });
  return owned !== null;
}
