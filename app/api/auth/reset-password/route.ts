import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { resetPasswordInputSchema } from "@/lib/validation/auth";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { getCustomerById } from "@/services/customers";
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE_OPTIONS,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  signCustomerSession,
} from "@/lib/customer-auth";
import { commerceErrorResponse, invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { getTranslations } from "next-intl/server";


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordInputSchema.safeParse(body);
    if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid input.");

    // The risk here is guessing a valid reset token by volume, not "wrongness" of any
    // one attempt (mirrors sign-up's reasoning) — every attempt counts, generous
    // enough that a real emailed token still works on the first try.
    const ip = getClientIp(request.headers);
    const key = `reset-password:ip:${ip}`;
    const limit = await isRateLimited({ key, limit: 10, windowMs: 60 * 60 * 1000 });
    if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);
    await recordAttempt(key);

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const customerId = await consumePasswordResetToken(parsed.data.token, passwordHash);
    if (!customerId) {
      return NextResponse.json(
        { error: { code: "INVALID_TOKEN", message: (await getTranslations("ApiErrors"))("invalidResetLink") } },
        { status: 400 }
      );
    }

    // Auto sign-in after a successful reset — same UX as sign-up, and there's no
    // reason to make someone type the password they just chose a second time.
    const customer = await getCustomerById(customerId);
    // Deliberately not phrased with "not found": that wording routes to a 404 in
    // commerceErrorResponse, and this is an internal invariant failure — the row was just
    // updated, so its absence is a 500, not something the caller did wrong.
    if (!customer) throw new Error("Customer row missing immediately after password reset");

    const token = await signCustomerSession({ sub: customer.id, email: customer.email, firstName: customer.firstName, lastName: customer.lastName });
    const cookieStore = await cookies();
    cookieStore.set(CUSTOMER_SESSION_COOKIE, token, CUSTOMER_SESSION_COOKIE_OPTIONS);

    return NextResponse.json({
      customer,
      token: "httponly",
      expiresAt: new Date(Date.now() + CUSTOMER_SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
    });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
