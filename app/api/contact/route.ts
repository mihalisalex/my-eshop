import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/validation/contact";
import { createContactMessage } from "@/services/contact";
import { getEmailProvider, contactMessageNotificationEmail } from "@/lib/email";
import { getSiteSettings } from "@/services/settings";
import { invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const key = `contact:ip:${ip}`;
  const limit = await isRateLimited({ key, limit: 5, windowMs: 60 * 60 * 1000 });
  if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);
  await recordAttempt(key);

  const body = await request.json();
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid input.");

  await createContactMessage(parsed.data);

  // Best-effort — a failed notification email must never fail the submission itself
  // (the message is already persisted and visible in the admin Contact Messages page).
  try {
    const settings = await getSiteSettings();
    const to = process.env.CONTACT_EMAIL || settings.contactEmail;
    const message = contactMessageNotificationEmail({ siteName: settings.siteName, ...parsed.data });
    await getEmailProvider().send({ to, template: "contact-message", ...message });
  } catch (error) {
    console.error("Failed to send contact notification email", error);
  }

  return NextResponse.json({ ok: true });
}
