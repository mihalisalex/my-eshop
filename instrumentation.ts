import * as Sentry from "@sentry/nextjs";

/**
 * Error tracking, server side only (OBS-001).
 *
 * DELIBERATELY not the client SDK. Every failure mode that actually costs this shop money
 * happens on the server — a webhook that stops verifying, a checkout that 500s, a Neon
 * branch that pauses — and the browser bundle already carries unoptimized images because
 * the transform quota ran out, so 30-90KB of tracker is exactly what it does not need. The
 * client half can be added later by creating the usual `instrumentation-client.ts`; nothing
 * here has to change for that.
 *
 * A MISSING DSN IS A NO-OP, not an error. `Sentry.init` with `dsn: undefined` disables the
 * SDK entirely, so the app runs identically before the account exists, in local dev, and in
 * CI — nobody has to remember to set a variable to keep the build green.
 */
export async function register() {
  // Only the Node.js runtime. The Edge runtime here runs proxy.ts, which does route gating
  // and slug redirects — no payment, order or customer writes — and instrumenting it would
  // mean a second SDK bundle on the hottest path in the app for almost no signal.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Vercel sets this; it keeps a staging deploy's noise out of the production project.
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

    /**
     * Never send PII, and say so explicitly rather than relying on the default.
     *
     * This shop applies a GDPR retention policy to its own webhook payloads and rate-limit
     * rows (PRIV-001); shipping customer emails and IP addresses to a US processor would
     * undo that on a different axis. `sendDefaultPii: false` stops the SDK attaching request
     * headers, cookies and IPs on its own — `beforeSend` below handles what our own code
     * passes in.
     */
    sendDefaultPii: false,

    /**
     * Performance tracing off. It is billed separately, answers a question this shop is not
     * yet asking, and every span it records is another chance to carry a URL containing an
     * order or checkout id.
     */
    tracesSampleRate: 0,

    /**
     * Last line of defence for personal data, on top of `sendDefaultPii: false`.
     *
     * The application logger is careful about what it puts in context, but "careful" is a
     * property of every call site and this is a property of the transport. Anything that
     * looks like an email address in the structured context is replaced before the event
     * leaves the process.
     */
    beforeSend(event) {
      if (event.extra) event.extra = scrubEmails(event.extra) as typeof event.extra;
      if (event.contexts?.logger) {
        event.contexts.logger = scrubEmails(event.contexts.logger) as typeof event.contexts.logger;
      }
      return event;
    },
  });
}

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

/** Replaces anything email-shaped with a marker, recursively, leaving structure intact. */
function scrubEmails(value: unknown): unknown {
  if (typeof value === "string") return value.replace(EMAIL_PATTERN, "[redacted-email]");
  if (Array.isArray(value)) return value.map(scrubEmails);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, scrubEmails(inner)]));
  }
  return value;
}

/**
 * Next calls this for every uncaught server error — route handlers, server components,
 * server actions — which is the half `logger.error` cannot see, because nothing caught it
 * to log it.
 */
export const onRequestError = Sentry.captureRequestError;
