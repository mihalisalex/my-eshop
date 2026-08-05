import { NextResponse } from "next/server";
import { newsletterSchema } from "@/lib/validation/newsletter";
import { subscribeToNewsletter } from "@/services/newsletter";
import { invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

/** Public, unauthenticated by nature — rate limited per IP so it can't be used to bulk-stuff the list. */
export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const key = `newsletter:ip:${ip}`;
  const limit = await isRateLimited({ key, limit: 5, windowMs: 60 * 60 * 1000 });
  if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);
  await recordAttempt(key);

  const body = await request.json().catch(() => null);
  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid input.");

  const source = typeof (body as { source?: unknown })?.source === "string" ? (body as { source: string }).source : undefined;
  await subscribeToNewsletter(parsed.data.email, source);

  return NextResponse.json({ ok: true });
}
