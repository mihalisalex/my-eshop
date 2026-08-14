import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSession, type AdminSessionPayload } from "@/lib/auth";
import { roleHasCapability, type Capability } from "@/constants/permissions";
import type { AdminRole } from "@/types/admin";

export interface AdminSessionWithRole extends AdminSessionPayload {
  role: AdminRole;
}

/**
 * The role is read from the AdminUser row, NOT from the JWT, and the row's existence
 * doubles as session validation.
 *
 * Reading it from the token would have three problems: existing sessions were issued
 * before roles were carried at all and would have no role to read; a demotion wouldn't
 * take effect until the token expired (up to a day of continued elevated access); and a
 * deleted admin's token would keep working until expiry. Reading it live fixes all three
 * — revoking or demoting someone is immediate.
 *
 * Wrapped in React's `cache` so the extra indexed PK lookup happens at most once per
 * render pass regardless of how many guards run, the same Data Access Layer pattern used
 * for customer sessions in lib/customer-session.ts.
 */
export const getAdminSession = cache(async (): Promise<AdminSessionWithRole | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyAdminSession(token);
  if (!payload) return null;

  const user = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    select: { role: true },
  });
  if (!user) return null;

  // Anything unrecognised in the column degrades to the least-privileged role rather than
  // being trusted — a bad value must not become an accidental promotion.
  const role: AdminRole = user.role === "admin" ? "admin" : "editor";
  return { ...payload, role };
});

/**
 * Server Actions must re-verify the session themselves — proxy.ts's
 * route-level gating alone isn't sufficient (Next's own guidance: a matcher
 * change can silently miss a Server Action's actual POST target). Throws
 * rather than redirecting since callers are mutations, not page renders.
 */
export async function requireAdminSession(): Promise<AdminSessionWithRole> {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

/** For Server Component pages/layouts, where a redirect is the right failure mode. */
export async function requireAdminSessionOrRedirect(): Promise<AdminSessionWithRole> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

/**
 * The authorization gate. Every mutating admin action pairs its existing authentication
 * check with one of these — being signed in has never been the same thing as being
 * allowed, and until now the codebase only checked the former.
 *
 * Throws a message safe to surface: it names the capability so an editor hitting a wall
 * learns what they'd need, without leaking anything about other accounts.
 */
export async function requireCapability(capability: Capability): Promise<AdminSessionWithRole> {
  const session = await requireAdminSession();
  if (!roleHasCapability(session.role, capability)) {
    throw new Error(`Your role (${session.role}) does not have permission to do this (${capability}).`);
  }
  return session;
}

/**
 * Page-level equivalent of `requireCapability`, for Server Components where a redirect
 * beats an error boundary. Hiding a nav link isn't protection — the URL is still typeable —
 * so any admin page whose link is capability-gated calls this too.
 */
export async function requireCapabilityOrRedirect(capability: Capability): Promise<AdminSessionWithRole> {
  const session = await requireAdminSessionOrRedirect();
  if (!roleHasCapability(session.role, capability)) redirect("/admin?denied=" + encodeURIComponent(capability));
  return session;
}

/**
 * Returning variant of `requireCapability`, for actions whose signature already carries an
 * `{ error }` channel. A thrown permission error inside a Server Action reaches the client
 * as a rejected promise, which the callers' `if (result?.error)` never sees — so the guard
 * held but the button appeared to do nothing at all. Returning the message instead makes a
 * refusal visible, which matters: a silent no-op reads as a broken app, not a permission
 * boundary. Actions that only redirect (and so have no error channel) keep throwing.
 */
export async function capabilityDenied(capability: Capability): Promise<string | null> {
  const session = await getAdminSession();
  if (!session) return "Your session has expired — sign in again.";
  if (!roleHasCapability(session.role, capability)) {
    return `Your role (${session.role}) doesn't have permission to do this.`;
  }
  return null;
}

/** Non-throwing variant, for hiding UI a role can't use. The server guard is still the real gate. */
export async function currentRoleHasCapability(capability: Capability): Promise<boolean> {
  const session = await getAdminSession();
  return session ? roleHasCapability(session.role, capability) : false;
}
