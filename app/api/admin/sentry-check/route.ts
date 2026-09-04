import { NextResponse } from "next/server";
import { capabilityDenied } from "@/lib/admin-session";
import { logger } from "@/lib/logger";

/**
 * TEMPORARY — delete this route once the first Sentry event has been confirmed.
 *
 * Verifies end to end that `SENTRY_DSN` is actually set in the deployed environment and
 * that events reach the project. Everything before this was verified locally: the SDK is
 * absent from the client bundle, the logger survives an unconfigured Sentry, the build is
 * clean. The one thing local checks cannot prove is that the production environment
 * variable is present and correct — and "wired but never seen an event arrive" is exactly
 * the state where a typo in the DSN is discovered six weeks later, during an incident.
 *
 * Admin-gated, so it is not a public error generator. It touches no data: no order, no
 * payment, no customer record, no email. The only effect is one log line and one Sentry
 * event carrying a marker string.
 */
export async function GET(request: Request) {
  const denied = await capabilityDenied("admin:settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  // A marker so the event is unambiguous in Sentry — several may arrive if this is retried.
  const marker = `sentry-check-${Date.now().toString(36)}`;
  const mode = new URL(request.url).searchParams.get("mode") === "throw" ? "throw" : "logger";

  if (mode === "throw") {
    /**
     * The OTHER half of the wiring: an uncaught error, which reaches Sentry through Next's
     * `onRequestError` hook rather than through the logger. Nothing catches it to log it,
     * which is precisely why that hook exists — and why it needs its own check.
     */
    throw new Error(`Deliberate uncaught test error (${marker})`);
  }

  // The path every real failure in checkout, payments, orders and webhooks takes.
  logger.error(
    `Deliberate test error via logger (${marker})`,
    new Error("This is a test. Nothing is broken."),
    { marker, source: "sentry-check", note: "safe to ignore and delete" }
  );

  return NextResponse.json({
    sent: true,
    marker,
    via: "logger.error",
    next: "Find this marker in Sentry. Then hit ?mode=throw to test the uncaught-error path too.",
  });
}
