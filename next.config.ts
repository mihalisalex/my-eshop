import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { REMOTE_IMAGE_HOSTS } from "./lib/image-hosts";

const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * Still a baseline rather than a hardened policy, but no longer identical in dev and prod.
 *
 * "unsafe-eval" is required by the DEV bundler only (fast refresh evaluates modules at
 * runtime); a production Next build never needs it, and leaving it on was handing back the
 * single most valuable thing a CSP buys you. It is now dev-only.
 *
 * "unsafe-inline" stays in both. Next emits inline bootstrap/flight scripts and this app
 * has its own pre-paint consent script, while Framer Motion writes inline transform styles
 * — removing it needs a nonce generated per request in proxy.ts and threaded through every
 * inline script and style, which is a real change rather than a config tweak. That remains
 * the next step for anyone hardening this further (audit QA-057).
 */
/**
 * Google Analytics hosts, allowed ONLY when a measurement id is actually configured.
 *
 * Adding them unconditionally would widen the policy of every deployment — including this
 * one, which has no analytics — to permit loading and exfiltrating to Google. A CSP that
 * permits what the app does not do is exactly the kind of quiet erosion that makes a policy
 * stop being worth having. The runtime gate is consent (components/shared/Analytics.tsx);
 * this is the build-time half.
 */
const ANALYTICS_ENABLED = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
const GA_SCRIPT_HOSTS = " https://www.googletagmanager.com";
const GA_CONNECT_HOSTS = " https://www.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (IS_DEV ? " 'unsafe-eval'" : "") + (ANALYTICS_ENABLED ? GA_SCRIPT_HOSTS : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://images.unsplash.com" + (ANALYTICS_ENABLED ? " https://www.google-analytics.com" : ""),
  "font-src 'self' data:",
  "connect-src 'self'" + (ANALYTICS_ENABLED ? GA_CONNECT_HOSTS : ""),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
];

const nextConfig: NextConfig = {
  images: {
    // Single source of truth, shared with the runtime check in lib/image-hosts.ts — adding
    // a host in one place and forgetting the other is how you get a fatal next/image error.
    remotePatterns: REMOTE_IMAGE_HOSTS,
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
export default withNextIntl(nextConfig);
