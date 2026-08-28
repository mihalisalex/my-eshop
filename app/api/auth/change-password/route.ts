import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireCustomerSession } from "@/lib/customer-session";
import { changePasswordInputSchema } from "@/lib/validation/auth";
import { updateCustomerPasswordHash } from "@/services/customers";
import { commerceErrorResponse, invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { getTranslations } from "next-intl/server";

/** Ignores any client-supplied customerId (interface parity only) — identity always comes from the verified session cookie. */
export async function POST(request: Request) {
  try {
    const session = await requireCustomerSession();
    const body = await request.json();
    const parsed = changePasswordInputSchema.safeParse(body);
    if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid input.");

    // Scoped to the signed-in customer, not IP — this is an authenticated action, so
    // the risk is someone with a hijacked/shared session brute-forcing the current
    // password. Only failed attempts count, same reasoning as sign-in.
    const key = `change-password:customer:${session.sub}`;
    const limit = await isRateLimited({ key, limit: 10, windowMs: 15 * 60 * 1000 });
    if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);

    const row = await prisma.customer.findUnique({ where: { id: session.sub } });
    if (!row?.passwordHash) {
      // OAuth-only account (Google/Apple/Facebook), no password to change yet. Not a
      // failed-attempt case for rate-limiting purposes — the account genuinely has no
      // password, this isn't the customer guessing wrong.
      return NextResponse.json(
        {
          error: {
            code: "NO_PASSWORD_SET",
            message: (await getTranslations("ApiErrors"))("noPasswordYet"),
          },
        },
        { status: 400 }
      );
    }

    const matches = await bcrypt.compare(parsed.data.currentPassword, row.passwordHash);
    if (!matches) {
      await recordAttempt(key);
      return NextResponse.json(
        { error: { code: "INVALID_CREDENTIALS", message: (await getTranslations("ApiErrors"))("currentPasswordIncorrect") } },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await updateCustomerPasswordHash(session.sub, passwordHash);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
