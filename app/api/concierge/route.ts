import { NextResponse } from "next/server";
import { conciergeSchema } from "@/lib/validation/concierge";
import { createConciergeRequest } from "@/services/concierge";
import { getCustomerSession } from "@/lib/customer-session";
import { invalidInputResponse, rateLimitedResponse } from "@/lib/commerce/http-errors";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const key = `concierge:ip:${ip}`;
  const limit = await isRateLimited({ key, limit: 5, windowMs: 60 * 60 * 1000 });
  if (limit.limited) return rateLimitedResponse(limit.retryAfterSeconds);
  await recordAttempt(key);

  const body = await request.json();
  const parsed = conciergeSchema.safeParse(body);
  if (!parsed.success) return invalidInputResponse(parsed.error.issues[0]?.message ?? "Invalid input.");

  const session = await getCustomerSession();
  await createConciergeRequest(parsed.data, session?.sub);

  return NextResponse.json({ ok: true });
}
