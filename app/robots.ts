import type { MetadataRoute } from "next";
import { getSeoDefaults } from "@/services";

/**
 * Crawl budget, spent deliberately.
 *
 * The rule this file follows: robots.txt controls CRAWLING, not indexing, and the two are
 * not interchangeable. A URL disallowed here can still be indexed from a link elsewhere —
 * Google simply indexes it without being able to see it, which is how "Indexed, though
 * blocked by robots.txt" happens. So this only blocks paths that must never be fetched at
 * all, and every "keep this out of search" decision is made with noindex and canonicals
 * where a crawler can actually read it.
 *
 * That is why the FILTER PARAMETERS ARE NOT BLOCKED HERE, despite being the obvious
 * candidates. `?color=`, `?size=` and the rest resolve to pages that canonicalise back to
 * their clean category URL — and Google has to fetch them to see that canonical. Blocking
 * them would leave a pile of URLs it knows about, cannot read, and cannot consolidate.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSeoDefaults();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Privileged, and nothing here should ever appear in a result.
          "/admin",
          // Data endpoints. Nothing a crawler fetches here renders as a page, and several
          // of them are rate-limited — crawler traffic against them is pure cost.
          "/api",
          // A shopper's own state. Unique per visitor, useless to everyone else, and in
          // the case of the shared-wishlist token, a private URL.
          "/cart",
          "/checkout",
          "/account",
          "/wishlist",
          // Order confirmations reached with a one-time grant. Never linkable content.
          "/checkout/confirmation",
        ],
      },
    ],
    sitemap: `${seo.siteUrl}/sitemap.xml`,
  };
}
