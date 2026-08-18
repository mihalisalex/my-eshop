"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCapability, requireAdminSession } from "@/lib/admin-session";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth";
import { changeOwnPasswordSchema, createAdminUserSchema } from "@/lib/validation/admin-user";
import { ADMIN_ROLES, type AdminRole } from "@/types/admin";

export interface UserActionState {
  error?: string;
  success?: string;
}

/** Matches the sign-in path, so a password created here verifies at the same cost. */
const BCRYPT_ROUNDS = 12;

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

/**
 * Creates a dashboard account.
 *
 * Until now this did not exist in any form: the Users page could only change a role, so
 * adding a colleague, or creating the second admin that stops one lost password becoming
 * an unrecoverable lockout, meant writing to the database by hand. That is the whole of
 * audit finding QA-017.
 *
 * The password is taken from the form and hashed here. It is never logged, never
 * returned, and never stored in plaintext — the creator types it once and shares it out
 * of band, exactly as the sign-in flow expects.
 */
export async function createAdminUser(formData: FormData): Promise<UserActionState> {
  await requireCapability("admin:users");

  const parsed = createAdminUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  }
  const { name, email, password, role } = parsed.data;

  try {
    await prisma.adminUser.create({
      data: { name, email, role, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
    });
  } catch (error) {
    // The unique constraint is the authority on duplicates rather than a prior lookup,
    // which would race two admins adding the same colleague at once.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An account with that email already exists." };
    }
    throw error;
  }

  revalidatePath("/admin/users");
  return { success: `${name} can now sign in.` };
}

/**
 * Removes a dashboard account.
 *
 * Two guards, and the order matters. Deleting yourself is refused outright — it would
 * invalidate the very session performing the request and drop you on the login page
 * mid-action. Deleting the last remaining admin is refused for the same reason
 * `updateAdminRole` refuses the last demotion: nobody would be left who can manage users,
 * settings or payments, and there is no self-service way back in.
 */
export async function deleteAdminUser(userId: string): Promise<UserActionState> {
  const session = await requireCapability("admin:users");

  if (userId === session.sub) {
    return { error: "You can't delete the account you're signed in with." };
  }

  const target = await prisma.adminUser.findUnique({ where: { id: userId }, select: { role: true, name: true } });
  if (!target) return { error: "That user no longer exists." };

  if (target.role === "admin") {
    const adminCount = await prisma.adminUser.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return { error: "This is the only admin account — create another admin before deleting this one." };
    }
  }

  await prisma.adminUser.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  return { success: `${target.name} no longer has access.` };
}

/**
 * Changes the signed-in admin's own password.
 *
 * Scoped to self on purpose: an admin cannot set someone else's password, because that
 * would let one staff member take over another's account silently. Requires the current
 * password, so a borrowed unlocked laptop is not enough to lock the real owner out.
 *
 * The session cookie is cleared afterwards. The JWT would otherwise stay valid for its
 * full day, meaning a password changed *because* it may be compromised would not actually
 * end the sessions using it.
 */
export async function changeOwnPassword(formData: FormData): Promise<UserActionState> {
  const session = await requireAdminSession();

  const parsed = changeOwnPasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  }

  const user = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { passwordHash: true } });
  if (!user) return { error: "Your account no longer exists — sign in again." };

  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return { error: "That current password isn't right." };
  }
  if (await bcrypt.compare(parsed.data.newPassword, user.passwordHash)) {
    return { error: "That's your current password — choose a different one." };
  }

  await prisma.adminUser.update({
    where: { id: session.sub },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS) },
  });

  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  revalidatePath("/admin", "layout");
  return { success: "Password changed. Sign in again with your new password." };
}
