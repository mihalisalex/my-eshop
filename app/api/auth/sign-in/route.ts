import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { getCustomerById } from "@/services/customers";
import { CUSTOMER_SESSION_COOKIE, signCustomerSession } from "@/lib/customer-auth";
import { commerceErrorResponse, invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const IP_KEY = (ip: string) => `sign-in:ip:${ip}`;
const EMAIL_KEY = (email: string) => `sign-in:email:${email}`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid input.");

    const email = parsed.data.email.trim().toLowerCase();
    const ip = getClientIp(request.headers);

    // Two independent limits, checked before touching credentials: by IP
    // (credential-stuffing across many accounts from one source) and by email
    // (targeted brute force on one account from anywhere). Only FAILED attempts
    // get recorded below — a legitimate user signing in repeatedly shouldn't lock
    // themselves out.
    const [byIp, byEmail] = await Promise.all([
      isRateLimited({ key: IP_KEY(ip), limit: 15, windowMs: 15 * 60 * 1000 }),
      isRateLimited({ key: EMAIL_KEY(email), limit: 5, windowMs: 15 * 60 * 1000 }),
    ]);
    if (byIp.limited || byEmail.limited) {
      return rateLimitedResponse(Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds));
    }

    const row = await prisma.customer.findUnique({ where: { email } });
    const passwordMatches = row?.passwordHash ? await bcrypt.compare(parsed.data.password, row.passwordHash) : false;
    if (!row || !passwordMatches) {
      await Promise.all([recordAttempt(IP_KEY(ip)), recordAttempt(EMAIL_KEY(email))]);
      return NextResponse.json(
        { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } },
        { status: 401 }
      );
    }

    const token = await signCustomerSession({ sub: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName });
    const cookieStore = await cookies();
    cookieStore.set(CUSTOMER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    const customer = await getCustomerById(row.id);
    return NextResponse.json({
      customer,
      token: "httponly",
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
    });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
