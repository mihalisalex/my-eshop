import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { REMOTE_IMAGE_HOSTS } from "./lib/image-hosts";

// Baseline, not hardened: unsafe-inline/unsafe-eval are here because Next.js dev/hydration
// and Framer Motion's inline transform styles need them without a nonce-based CSP wired
// through middleware. Before shipping this for real, replace this CSP with a nonce or hash
// strategy and drop unsafe-inline/unsafe-eval — that's a bigger change (a proxy.ts nonce
// generator + every inline script/style tagged) than fits alongside the rest of this header.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://images.unsplash.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
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
