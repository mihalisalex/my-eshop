/**
 * A generic shimmer blur placeholder for product/editorial images that don't carry
 * their own `blurDataURL` (none of the mock catalog images do). A real CMS/DAM would
 * generate a proper per-image LQIP; this shimmer tone matches `luxe-gray-light` so it
 * reads as an intentional loading state rather than a missing-image flash.
 */
function shimmer(width: number, height: number): string {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#F5F5F5" offset="20%" />
      <stop stop-color="#EEEEEE" offset="50%" />
      <stop stop-color="#F5F5F5" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#F5F5F5" />
  <rect width="${width}" height="${height}" fill="url(#g)" />
</svg>`;
}

function toBase64(value: string): string {
  return typeof window === "undefined" ? Buffer.from(value).toString("base64") : window.btoa(value);
}

export const SHIMMER_BLUR_DATA_URL = `data:image/svg+xml;base64,${toBase64(shimmer(700, 933))}`;
