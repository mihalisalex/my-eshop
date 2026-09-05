import "server-only";
import { unstable_cache } from "next/cache";
import seoFallback from "@/data/seo.json";
import { getSiteContent, setSiteContent } from "@/lib/site-content";
import type { SiteSeoDefaults } from "@/types";

export async function getSeoDefaults(): Promise<SiteSeoDefaults> {
  return getSiteContent<SiteSeoDefaults>("seo", seoFallback as SiteSeoDefaults);
}

export async function saveSeoDefaults(seo: SiteSeoDefaults): Promise<void> {
  await setSiteContent<SiteSeoDefaults>("seo", seo);
}

/** Cache tag for the site's SEO defaults. Exported so the admin action can invalidate it. */
export const SEO_CACHE_TAG = "seo-defaults";

/**
 * The same read, cached (PERF-002 tier 1).
 *
 * Called from `app/layout.tsx` on every render of every page, to build the metadata. Since
 * nothing in this app is statically prerendered, that is a database round trip per page view
 * for a row the merchant edits occasionally.
 *
 * Invalidated by tag on save, so an edit shows immediately; the hour TTL is only a backstop
 * against a future write path that forgets.
 */
export const getSeoDefaultsCached = unstable_cache(getSeoDefaults, ["seo-defaults"], {
  tags: [SEO_CACHE_TAG],
  revalidate: 3600,
});
