import "server-only";
import { prisma } from "@/lib/prisma";

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

/** Best-effort client IP from standard proxy headers — "unknown" in local dev, where nothing sets them. */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") ?? "unknown";
}
