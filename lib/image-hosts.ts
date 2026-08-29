/**
 * The one list of remote image hosts. `next.config.ts` builds its `images.remotePatterns`
 * from this, and app code checks against the same array — so the runtime check can't drift
 * from what the optimizer actually accepts.
 *
 * Deliberately free of `server-only` and of any Next import: it's read by the config
 * loader and by client components alike.
 */
export interface RemoteImageHost {
  protocol: "https";
  /**
   * May start with a wildcard, using Next's own two levels of it:
   *   `*.`  matches exactly one label   — Vercel Blob gives each store its own subdomain
   *   `**.` matches one or more labels  — Meta's CDN nests them (scontent-ath3-1.xx.fbcdn.net)
   *
   * `**.` is the looser of the two and is only worth reaching for when a host genuinely
   * varies in depth, because it also matches everything `*.` would.
   */
  hostname: string;
}

export const REMOTE_IMAGE_HOSTS: RemoteImageHost[] = [
  { protocol: "https", hostname: "images.unsplash.com" },
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
  {
    // Instagram's media CDN, for the homepage feed. Meta serves each photo from a
    // region-suffixed host (scontent-ath3-1, scontent-fra5-2, …) that varies per request,
    // so the wildcard is the host, not a convenience.
    protocol: "https",
    hostname: "**.cdninstagram.com",
  },
  {
    // Some Instagram media comes back on fbcdn.net instead. Same feed, same images —
    // Meta simply does not commit to which of its two CDNs a given file is served from.
    protocol: "https",
    hostname: "**.fbcdn.net",
  },
];

function hostnameMatches(hostname: string, pattern: string): boolean {
  // Checked before `*.`, since every `**.` pattern also starts with `*.`.
  if (pattern.startsWith("**.")) {
    const suffix = pattern.slice(2); // ".fbcdn.net"
    if (!hostname.endsWith(suffix)) return false;
    // One or more labels, but still at least one: `fbcdn.net` itself must not match, or the
    // pattern would permit the apex domain nobody meant to allow.
    return hostname.length > suffix.length;
  }
  if (!pattern.startsWith("*.")) return hostname === pattern;
  const suffix = pattern.slice(1); // ".public.blob.vercel-storage.com"
  if (!hostname.endsWith(suffix)) return false;
  // `*.` matches exactly one label, matching Next's own wildcard semantics.
  const label = hostname.slice(0, -suffix.length);
  return label.length > 0 && !label.includes(".");
}

/**
 * Whether `next/image` can render this URL. Calling it with an unconfigured host doesn't
 * degrade — it throws a fatal error that takes down the whole route — so anywhere that
 * renders arbitrary stored URLs (the Media Library) must check first and fall back to a
 * plain <img>, which merely shows a broken thumbnail.
 */
export function isOptimizableImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return REMOTE_IMAGE_HOSTS.some((host) => hostnameMatches(parsed.hostname, host.hostname));
}
