type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

/**
 * Structured logging seam. Every call goes through here instead of raw
 * console.* so swapping in a real backend (Datadog, Sentry breadcrumbs, an
 * internal log shipper) later is a change to this one file, not every call
 * site. Console output is still useful in dev and in server logs today.
 */
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
  error: (message: string, context?: LogContext) => log("error", message, context),
};
