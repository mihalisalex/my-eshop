"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, signAdminSession } from "@/lib/auth";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const ip = getClientIp(await headers());
  const key = `admin-sign-in:ip:${ip}`;
  const limit = await isRateLimited({ key, limit: 10, windowMs: 15 * 60 * 1000 });
  if (limit.limited) {
    return { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).` };
  }

  const user = await prisma.adminUser.findUnique({ where: { email } });
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !passwordMatches) {
    await recordAttempt(key);
    return { error: "Invalid email or password." };
  }

  const token = await signAdminSession({ sub: user.id, email: user.email, name: user.name });
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  redirect("/admin");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
