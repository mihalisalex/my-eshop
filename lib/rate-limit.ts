import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitedResponse } from "@/lib/commerce/http-errors";

interface RateLimitWindow {
  /** Scopes the limit — e.g. "sign-in:{ip}", "sign-in:{email}", "sign-up:{ip}". */
  key: string;
  limit: number;
  windowMs: number;
}

interface RateLimitStatus {
  limited: boolean;
  retryAfterSeconds: number;
}

/**
 * Sliding-window rate limit backed by a row-per-attempt table (see `RateLimitAttempt`
 * in schema.prisma) rather than a running counter column — counting rows in the
 * window is race-free under concurrent requests with no read-then-write locking
 * needed, at the cost of a bit more storage (self-pruned in `recordAttempt` below).
 *
 * Split into peek (`isRateLimited`) and record (`recordAttempt`) rather than one
 * check-and-record call so callers can choose what counts toward the limit — e.g.
 * sign-in only wants to count *failed* attempts (a legitimate user signing in
 * repeatedly shouldn't get themselves locked out), while sign-up/password-reset
 * want to count every attempt regardless of outcome, since the thing being limited
 * there is request volume itself, not "wrongness."
 */
export async function isRateLimited({ key, limit, windowMs }: RateLimitWindow): Promise<RateLimitStatus> {
  const windowStart = new Date(Date.now() - windowMs);
  const [count, oldest] = await Promise.all([
    prisma.rateLimitAttempt.count({ where: { key, createdAt: { gte: windowStart } } }),
    prisma.rateLimitAttempt.findFirst({ where: { key, createdAt: { gte: windowStart } }, orderBy: { createdAt: "asc" } }),
  ]);

  if (count < limit) return { limited: false, retryAfterSeconds: 0 };
  const retryAfterMs = oldest ? oldest.createdAt.getTime() + windowMs - Date.now() : windowMs;
  return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
}

export async function recordAttempt(key: string): Promise<void> {
  await prisma.rateLimitAttempt.create({ data: { key } });

  // Opportunistic cleanup — no cron job in this app, so prune old rows on ~1% of
  // calls instead. A day is comfortably past every window this app uses.
  if (Math.random() < 0.01) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    void prisma.rateLimitAttempt.deleteMany({ where: { createdAt: { lt: oneDayAgo } } });
  }
}

/**
 * The client IP every rate limit in this app is keyed on — including admin sign-in.
 *
 * Header order is a trust decision, not a preference. `x-forwarded-for` is an ordinary
 * request header: anyone can send one. If the platform in front APPENDS to a client-supplied
 * value rather than replacing it, then reading the leftmost entry reads whatever the caller
 * put there — and a single attacker gets a fresh rate-limit bucket per request by varying
 * it, defeating brute-force protection on the login form along with every other limit here.
 *
 * So the platform's own header is preferred. `x-vercel-forwarded-for` is set by Vercel's
 * edge and cannot be spoofed: the `x-vercel-*` prefix is reserved, and inbound copies are
 * stripped before a request reaches the function. `x-real-ip` is likewise set by the
 * platform. Only when neither is present — local dev, or a host that sets nothing — does
 * this fall back to `x-forwarded-for`, where there is no proxy in front to be lied to about
 * in the first place.
 *
 * Deliberately NOT resolved by counting hops from the right: that needs the exact number of
 * trusted proxies, which is a deployment detail this module has no way to know and which
 * changes silently when one is added.
 */
export function getClientIp(headers: Headers): string {
  for (const header of ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]) {
    const value = headers.get(header);
    // A comma-separated list only ever appears in a forwarded-for style header; taking the
    // first entry is correct for the platform-set ones, which name the true client first.
    const first = value?.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/**
 * Check-and-record in one call, returning a 429 response when the caller should stop.
 *
 * The auth routes deliberately keep the two-step peek/record form because they only want
 * FAILED attempts to count. Everything else — cart writes, checkout creation, order
 * completion, the catalog endpoint — is limiting request volume itself, where every call
 * counts and the split was just six lines of ceremony repeated per route. Of 47 API
 * routes only ten had any limit at all, and the ones that could create rows or run the
 * heaviest queries were among those that didn't.
 *
 * Usage: `const limited = await enforceRateLimit(request, {...}); if (limited) return limited;`
 */
export async function enforceRateLimit(
  request: Request,
  { name, limit, windowMs }: { name: string; limit: number; windowMs: number }
): Promise<NextResponse | null> {
  const key = `${name}:ip:${getClientIp(request.headers)}`;
  const status = await isRateLimited({ key, limit, windowMs });
  if (status.limited) return rateLimitedResponse(status.retryAfterSeconds);
  await recordAttempt(key);
  return null;
}
