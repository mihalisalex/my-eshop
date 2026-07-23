import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession, type AdminSessionPayload } from "@/lib/auth";

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return token ? verifyAdminSession(token) : null;
}

/**
 * Server Actions must re-verify the session themselves — proxy.ts's
 * route-level gating alone isn't sufficient (Next's own guidance: a matcher
 * change can silently miss a Server Action's actual POST target). Throws
 * rather than redirecting since callers are mutations, not page renders.
 */
export async function requireAdminSession(): Promise<AdminSessionPayload> {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

/** For Server Component pages/layouts, where a redirect is the right failure mode. */
export async function requireAdminSessionOrRedirect(): Promise<AdminSessionPayload> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
