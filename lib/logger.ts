type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

/**
 * The one place server-side diagnostics go (OBS-001).
 *
 * This existed before as a seam nobody used — two files imported it while the rest called
 * `console.error` directly, so the stated benefit ("swapping in a real backend is a change
 * to this one file") was never actually available. The payment, checkout and webhook paths
 * route through it now, which are the ones whose silent failure costs money.
 *
 * TO CONNECT AN ERROR TRACKER (Sentry, Betterstack, Axiom): implement `reportError` below
 * and call it from the `error` branch. That is the whole integration — no call site
 * changes. It is deliberately left unimplemented rather than stubbed against a service
 * this shop has not chosen, because a fake integration reads as a real one.
 */

/** Errors do not survive JSON.stringify — message and stack both vanish silently. */
function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { value: String(error) };
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
  };

  switch (level) {
    case "debug":
      console.debug(entry);
      break;
    case "info":
      console.info(entry);
      break;
    case "warn":
      console.warn(entry);
      break;
    case "error":
      console.error(entry);
      break;
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),

  /**
   * Takes the caught value as its own argument rather than leaving each caller to remember
   * that `{ error }` serializes to `{}`. Everything a post-mortem needs — message, stack,
   * and whatever identifiers the caller knows — lands in one structured record.
   */
  error: (message: string, error?: unknown, context?: LogContext) =>
    log("error", message, {
      ...(context ?? {}),
      ...(error !== undefined ? { error: serializeError(error) } : {}),
    }),
};
