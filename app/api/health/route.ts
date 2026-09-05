import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Liveness + readiness for uptime monitoring (OBS-001).
 *
 * The app had no way to be asked "are you actually working?" from outside. A Vercel
 * function that boots fine but cannot reach Neon still answers 200 on every page it can
 * render from cache, so "the site loads" was never evidence that checkout would.
 *
 * Deliberately checks the DATABASE, not just process liveness: every meaningful failure
 * mode this app has — connection exhaustion, a paused Neon branch, a rotated credential —
 * shows up as a failed query and nothing else. `SELECT 1` is the cheapest statement that
 * proves the pool can hand out a working connection.
 *
 * Returns 503 rather than 500 when the dependency is down: this is "not ready to serve",
 * which is what an uptime checker and a load balancer both need to hear.
 *
 * Unauthenticated on purpose — an uptime probe cannot hold a session — and it says nothing
 * a stranger could use. No version, no host, no error text: a failure reports only THAT the
 * database is unreachable, never why, since the reason routinely names the host and user.
 * The real diagnosis goes to the server log where an operator can read it.
 */
/**
 * No route segment config. Cache Components rejects `dynamic = "force-dynamic"` outright, and
 * does not need it: a GET handler prerenders only when it accesses no uncached data, and the
 * `SELECT 1` below is exactly that. The route therefore runs on every request, which is the
 * behaviour the old export was asking for.
 *
 * Verify after any change here that `next build` still lists `/api/health` as dynamic. A
 * prerendered health check would answer "healthy" forever — including while the database is
 * unreachable, which is the one failure this endpoint exists to report.
 */

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error("[health] database check failed", error);
    return NextResponse.json(
      { status: "unhealthy", database: "unreachable" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  return NextResponse.json(
    { status: "healthy", database: "ok", latencyMs: Date.now() - startedAt },
    { headers: { "cache-control": "no-store" } }
  );
}
