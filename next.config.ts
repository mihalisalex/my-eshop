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

/**
 * `img-src` is derived from the same host list `images.remotePatterns` uses, rather than
 * hand-listed.
 *
 * While the Vercel optimizer was on, every remote image was fetched through /_next/image and
 * so arrived same-origin — `'self'` covered all of them and the policy only ever needed to
 * name Unsplash. Turning the optimizer off (see `images.unoptimized` below) makes the browser
 * fetch each file from its real host, and the CSP silently blocked every one: images that had
 * just been "fixed" still did not render, with nothing in the network tab but a console
 * violation.
 *
 * Deriving it means turning optimization on or off can never again disagree with what the
 * policy permits.
 */
/**
 * The two syntaxes are NOT the same, which is the bug this collapses (SEC-005).
 *
 * `remotePatterns` uses Next's own wildcards: `*.` matches exactly one label and `**.`
 * matches one or more. CSP has only one form — `*.example.com` — and it already matches a
 * subdomain at any depth. Emitting `**.cdninstagram.com` into a policy is not a stricter
 * rule, it is an INVALID source: the browser discards that entry entirely and logs
 * "contains an invalid source: … It will be ignored".
 *
 * The effect was silent and one-directional. Instagram's CDN serves each photo from a
 * region-suffixed host (scontent-ath3-1.xx.fbcdn.net), so the homepage feed's images were
 * covered by `remotePatterns` — Next would render them — while the CSP line meant to permit
 * them was being thrown away, leaving them blocked with only a console violation to say so.
 * Latent today because the feed falls back to curated images until a Meta token is
 * connected; it would have surfaced as "the Instagram section is blank in production".
 */
const REMOTE_IMAGE_SRC = REMOTE_IMAGE_HOSTS.map(
  (host) => ` ${host.protocol}://${host.hostname.replace(/^\*\*\./, "*.")}`
).join("");

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (IS_DEV ? " 'unsafe-eval'" : "") + (ANALYTICS_ENABLED ? GA_SCRIPT_HOSTS : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:" + REMOTE_IMAGE_SRC + (ANALYTICS_ENABLED ? " https://www.google-analytics.com" : ""),
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
  /**
   * PERF-002 tier 2, pre-step. Cache Components turns on Partial Prerendering: a static shell
   * served from the CDN with request-dependent parts streaming behind Suspense.
   *
   * Nothing is faster yet. Every page and layout still carries `export const instant = false`,
   * which opts it out of the new validation, and each of those TODOs is one route waiting to
   * be adopted. The opt-outs are removed top-down, one feature at a time — the highest one
   * wins, so removing a leaf does nothing while an ancestor still holds one.
   */
  cacheComponents: true,
  images: {
    // Single source of truth, shared with the runtime check in lib/image-hosts.ts — adding
    // a host in one place and forgetting the other is how you get a fatal next/image error.
    remotePatterns: REMOTE_IMAGE_HOSTS,

    /**
     * Vercel's image optimizer is off, and this is a live incident fix rather than a
     * preference.
     *
     * Every /_next/image request on production was returning
     * `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED` — the account's image-transformation
     * quota is exhausted. Already-cached sizes kept serving, so the damage looked random:
     * the hero appeared at one viewport and vanished at another, because a different
     * viewport asks for a different `w=` and that one had never been transformed. Product
     * images were broken across the shop.
     *
     * With this on, next/image emits the original URL and the browser fetches it straight
     * from Vercel Blob. The catalogue's images are ~100KB 3:4 JPEGs, which is fine to serve
     * directly — bigger than an optimized WebP, and incomparably better than not loading.
     *
     * `placeholder="blur"` still works: SHIMMER_BLUR_DATA_URL is an inline data URI, not
     * something the optimizer generates.
     *
     * TO TURN OPTIMIZATION BACK ON once the plan allows it, set NEXT_PUBLIC_OPTIMIZE_IMAGES
     * to "true" and redeploy. Default is off, so a fresh deploy can never silently
     * reintroduce broken images.
     */
    unoptimized: process.env.NEXT_PUBLIC_OPTIMIZE_IMAGES !== "true",
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
export default withNextIntl(nextConfig);
