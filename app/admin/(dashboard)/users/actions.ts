"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/admin-session";
import { ADMIN_ROLES, type AdminRole } from "@/types/admin";

export interface UserActionState {
  error?: string;
}

/**
 * Changing an admin's role — previously this was `useState` in RoleSelect that never
 * reached the server, so the dropdown appeared to work and silently reverted on reload.
 */
export async function updateAdminRole(userId: string, role: string): Promise<UserActionState> {
  const session = await requireCapability("admin:users");

  if (!ADMIN_ROLES.includes(role as AdminRole)) {
    return { error: "Unknown role." };
  }
  const nextRole = role as AdminRole;

  const target = await prisma.adminUser.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { error: "That user no longer exists." };
  if (target.role === nextRole) return {};

  // Demoting the last admin would leave nobody able to manage users, settings, or roles —
  // an unrecoverable lockout from the dashboard, since there's no self-service escalation.
  // Checked for any admin -> non-admin move, including demoting yourself.
  if (target.role === "admin" && nextRole !== "admin") {
    const adminCount = await prisma.adminUser.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return { error: "This is the only admin account — promote another user to admin first, or you'll lock everyone out." };
    }
  }

  await prisma.adminUser.update({ where: { id: userId }, data: { role: nextRole } });

  // Self-demotion is allowed once another admin exists, but the current request's own
  // capabilities are now stale — revalidate so the UI reflects what they can still do.
  if (userId === session.sub) revalidatePath("/admin", "layout");
  else revalidatePath("/admin/users");

  return {};
}
