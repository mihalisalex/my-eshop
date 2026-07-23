import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { signUpInputSchema } from "@/lib/validations/auth";
import { createCustomer, getCustomerByEmail } from "@/services/customers";
import { CUSTOMER_SESSION_COOKIE, signCustomerSession } from "@/lib/customer-auth";
import { commerceErrorResponse, invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { getEmailProvider, welcomeEmail } from "@/lib/email";
import { getSiteSettings } from "@/services/settings";
import { recordReferralSignup } from "@/services/referrals";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
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
      // Rate limiting is the primary defense against scraping this endpoint for
      // registered emails (5/hour/IP, above) — this still tells a legitimate user
      // to sign in instead rather than hiding it behind a generic error, which
      // would be a worse trade for a consumer storefront. To at least remove the
      // response-timing side channel, spend the same bcrypt cost here that the
      // real account-creation path below would have spent.
      await bcrypt.hash(parsed.data.password, BCRYPT_COST);
      return NextResponse.json(
        { error: { code: "EMAIL_IN_USE", message: "An account with that email already exists." } },
        { status: 409 }
      );
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
    cookieStore.set(CUSTOMER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

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
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
    });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
