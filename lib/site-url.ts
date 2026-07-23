import "server-only";

/**
 * Absolute site URL for building links inside emails sent from contexts that have no
 * `request` object to derive one from (writeProductRow's back-in-stock notifications,
 * the daily cron job's follow-up emails) — every other email template in this app
 * builds its URL from `request.url` at the Route Handler that already has one.
 */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
