import { NextResponse } from "next/server";
import { magicLinkSchema } from "@/lib/validations/auth";
import { invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { createPasswordResetToken } from "@/lib/password-reset";
import { getCustomerByEmail } from "@/services/customers";
import { getEmailProvider, passwordResetEmail } from "@/lib/email";
import { getSiteSettings } from "@/services/settings";

/** Always 200 on valid input, regardless of whether the email exists — the response can't be used to enumerate accounts, matching the sign-up route's rate-limit-as-primary-defense approach for the same class of leak. */
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = magicLinkSchema.safeParse(body);
  if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid input.");

  const ip = getClientIp(request.headers);
  const key = `password-reset:ip:${ip}`;
  const limit = await isRateLimited({ key, limit: 5, windowMs: 60 * 60 * 1000 });
  if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);
  await recordAttempt(key);

  const email = parsed.data.email.trim().toLowerCase();
  const customer = await getCustomerByEmail(email);
  if (customer) {
    try {
      const { rawToken, expiresInMinutes } = await createPasswordResetToken(customer.id);
      const resetUrl = new URL(`/account/reset-password?token=${rawToken}`, request.url).toString();
      const settings = await getSiteSettings();
      const message = passwordResetEmail({ siteName: settings.siteName, resetUrl, expiresInMinutes });
      await getEmailProvider().send({ to: email, template: "password-reset", ...message });
    } catch (error) {
      // Still 200 below regardless — a failed send shouldn't leak "this email exists"
      // any more than a successful one already unavoidably does for the requester.
      console.error("Failed to send password reset email", error);
    }
  }

  return NextResponse.json({ ok: true });
}
