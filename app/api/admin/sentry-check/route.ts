import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
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
 * That is not hypothetical here: the variable was first deployed as SENTRY_DNS, which
 * `Sentry.init` accepts in silence because `dsn: undefined` simply disables the SDK.
 * Hence the `configured` block below — it distinguishes "sent and did not arrive" from
 * "never sent at all", which are different faults with different fixes.
 *
 * Admin-gated, so it is not a public error generator. It touches no data: no order, no
 * payment, no customer record, no email. The only effect is one log line and one Sentry
 * event carrying a marker string.
 */
export async function GET(request: Request) {
  const denied = await capabilityDenied("admin:settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  /**
   * The authoritative answer, read from the initialised SDK rather than from the raw
   * environment: if `Sentry.init` ran without a usable DSN there is no client at all, and
   * nothing this route does afterwards can possibly arrive.
   *
   * The DSN itself is never returned. Its host is enough to confirm the right project
   * region was pasted, and the public key stays out of the response.
   */
  const client = Sentry.getClient();
  const dsn = client?.getOptions().dsn;
  const configured = {
    sdkActive: Boolean(client),
    dsnPresent: Boolean(dsn),
    dsnHost: typeof dsn === "string" ? safeHost(dsn) : null,
    environment: client?.getOptions().environment ?? null,
    // Names the env var actually found, so a misspelling shows up as a missing name.
    envVarSeen: process.env.SENTRY_DSN ? "SENTRY_DSN" : null,
  };

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

  /**
   * Waits for the event to leave the process. Serverless functions are frozen the moment
   * the response is returned, so an event still sitting in the transport queue is simply
   * lost — which would look exactly like a broken DSN.
   */
  const flushed = await Sentry.flush(4000).catch(() => false);

  return NextResponse.json({
    configured,
    sent: true,
    flushed,
    marker,
    via: "logger.error",
    next: "Find this marker in Sentry. Then hit ?mode=throw to test the uncaught-error path too.",
  });
}

function safeHost(dsn: string): string | null {
  try {
    return new URL(dsn).host;
  } catch {
    return "unparseable";
  }
}
