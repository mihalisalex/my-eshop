import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { signUpInputSchema } from "@/lib/validation/auth";
import { createCustomer, getCustomerByEmail } from "@/services/customers";
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE_OPTIONS,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  signCustomerSession,
} from "@/lib/customer-auth";
import { commerceErrorResponse, invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { getEmailProvider, welcomeEmail, accountAlreadyExistsEmail } from "@/lib/email";
import { getSiteSettings } from "@/services/settings";
import { recordReferralSignup } from "@/services/referrals";

const BCRYPT_COST = 12;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signUpInputSchema.safeParse(body);
    if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid input.");

    const ip = getClientIp(request.headers);
    // Every attempt counts here (unlike sign-in) — what's being limited is sign-up
    // volume itself (mass fake-account creation, or this endpoint used as an
    // email-enumeration oracle), not "wrongness" of any individual attempt.
    const ipLimit = await isRateLimited({ key: `sign-up:ip:${ip}`, limit: 5, windowMs: 60 * 60 * 1000 });
    if (ipLimit.limited) return rateLimitedResponse(ipLimit.retryAfterSeconds);
    await recordAttempt(`sign-up:ip:${ip}`);

    const email = parsed.data.email.trim().toLowerCase();
    const existing = await getCustomerByEmail(email);
    if (existing) {
      // Mirrors request-password-reset's anti-enumeration shape: same 200 status and a
      // session-free body regardless of whether the email is registered, with rate
      // limiting (5/hour/IP, above) as the primary defense. Unlike password reset, sign-up
      // can't return a byte-for-byte identical body on both branches — the "new account"
      // branch below returns real customer data + a session cookie, and doing the same
      // here (for someone else's account) would be account takeover. So this branch stays
      // distinguishable at the body-shape level (no `customer`/session) but not at the
      // status-code level, and never signs the requester in. Spend the same bcrypt cost
      // the real account-creation path would have, removing the timing side channel.
      await bcrypt.hash(parsed.data.password, BCRYPT_COST);
      try {
        const settings = await getSiteSettings();
        const message = accountAlreadyExistsEmail({
          siteName: settings.siteName,
          loginUrl: new URL("/account/login", request.url).toString(),
        });
        await getEmailProvider().send({ to: email, template: "account-already-exists", ...message });
      } catch (emailError) {
        console.error("Failed to send account-already-exists email", emailError);
      }
      return NextResponse.json({ ok: true, requiresLogin: true });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_COST);
    const customer = await createCustomer({
      email,
      passwordHash,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
    });

    const token = await signCustomerSession({
      sub: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
    });
    const cookieStore = await cookies();
    cookieStore.set(CUSTOMER_SESSION_COOKIE, token, CUSTOMER_SESSION_COOKIE_OPTIONS);

    // Best-effort — a failed welcome email must never fail account creation.
    try {
      const settings = await getSiteSettings();
      const message = welcomeEmail({
        siteName: settings.siteName,
        firstName: customer.firstName,
        shopUrl: new URL("/", request.url).toString(),
      });
      await getEmailProvider().send({ to: customer.email, template: "welcome", ...message });
    } catch (emailError) {
      console.error("Failed to send welcome email", emailError);
    }

    // Best-effort — an invalid/missing referral code must never fail account creation.
    if (parsed.data.referralCode) {
      try {
        await recordReferralSignup(parsed.data.referralCode, customer.id);
      } catch (referralError) {
        console.error("Failed to record referral signup", referralError);
      }
    }

    return NextResponse.json({
      customer,
      token: "httponly",
      expiresAt: new Date(Date.now() + CUSTOMER_SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
    });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
