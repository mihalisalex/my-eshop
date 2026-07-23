import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CUSTOMER_SESSION_COOKIE, verifyCustomerSession, type CustomerSessionPayload } from "@/lib/customer-auth";

export async function getCustomerSession(): Promise<CustomerSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  return token ? verifyCustomerSession(token) : null;
}

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
