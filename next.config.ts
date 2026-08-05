import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        // Product photos for the WooCommerce-imported catalog batch, still hosted
        // on the original store's WordPress media library rather than re-uploaded.
        protocol: "https",
        hostname: "alexandrisstores.gr",
      },
      {
        // Vercel Blob (Media Library uploads, CSV-import image uploads, and the
        // WooCommerce-import re-host) — each store gets its own subdomain.
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
export default withNextIntl(nextConfig);
