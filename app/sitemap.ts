import type { MetadataRoute } from "next";
import { ROUTES } from "@/constants/routes";
import { getAllCategories, getAllCollections, getAllPosts, getAllProducts, getLegalPages, getSeoDefaults } from "@/services";

const STATIC_ROUTES: { path: string; priority: number }[] = [
  { path: ROUTES.home, priority: 1 },
  { path: ROUTES.women, priority: 0.9 },
  { path: ROUTES.men, priority: 0.9 },
  { path: ROUTES.newIn, priority: 0.8 },
  { path: ROUTES.collections, priority: 0.8 },
  { path: ROUTES.sale, priority: 0.7 },
  { path: ROUTES.journal, priority: 0.6 },
  { path: ROUTES.about, priority: 0.5 },
  { path: ROUTES.sustainability, priority: 0.4 },
  { path: ROUTES.faq, priority: 0.4 },
  { path: ROUTES.sizeGuide, priority: 0.4 },
  { path: ROUTES.shippingReturns, priority: 0.4 },
  { path: ROUTES.contact, priority: 0.3 },
  { path: ROUTES.careers, priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getSeoDefaults();
  const [products, collections, categories, posts, legalPages] = await Promise.all([
    getAllProducts(),
    getAllCollections(),
    getAllCategories(),
    getAllPosts(),
    getLegalPages(),
  ]);

  const toUrl = (path: string) => new URL(path, seo.siteUrl).toString();

  /**
   * `lastModified` is the row's real `updatedAt`, not the build time.
   *
   * Every URL here used to carry `new Date()`, so each deploy told crawlers that all 207
   * pages had changed simultaneously — including a deploy that only touched CSS. A
   * `<lastmod>` that is always "now" is indistinguishable from no `<lastmod>` at all, and a
   * crawler that learns to ignore it also ignores the one time a price genuinely changed.
   *
   * The static routes are the honest exception: they have no row and no edit history, so
   * the build IS the last time their markup could have changed.
   */
  const buildTime = new Date().toISOString();

  return [
    ...STATIC_ROUTES.map(({ path, priority }) => ({
      url: toUrl(path),
      lastModified: buildTime,
      changeFrequency: "weekly" as const,
      priority,
    })),
    /**
     * A sitemap is a request to index, so anything marked noindex is excluded — listing a
     * page in both places asks for two opposite things and is one of the contradictions
     * Search Console reports as "Indexed, though blocked" or simply ignores.
     *
     * Drafts and archived products never reach here at all: getAllProducts() filters on
     * publication status by default, so they are absent rather than filtered out.
     */
    ...collections
      .filter((collection) => !collection.seo?.noIndex)
      .map((collection) => ({
        url: toUrl(ROUTES.collection(collection.slug)),
        lastModified: collection.updatedAt ?? buildTime,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...categories
      .filter((category) => category.isVisible && !category.seo?.noIndex)
      .map((category) => ({
        url: toUrl(ROUTES.category(category.slug)),
        lastModified: category.updatedAt ?? buildTime,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...products
      .filter((product) => !product.seo?.noIndex)
      .map((product) => ({
        url: toUrl(ROUTES.product(product.slug)),
        lastModified: product.updatedAt ?? buildTime,
        changeFrequency: "weekly" as const,
        priority: 0.6,
        /**
         * Image sitemap entries, which matter more here than on most shops: this is a
         * footwear catalogue, so a meaningful share of the demand arrives through image
         * search, and product photography is the one asset the shop has plenty of.
         *
         * They also solve a discovery problem specific to this deployment. Vercel's image
         * optimizer is off (see next.config.ts), so images are served straight from Blob on
         * a different host — and a crawler has no reason to associate a Blob URL with this
         * product page unless the sitemap says so.
         *
         * Capped at the first four per product: Google indexes what it finds here, and a
         * gallery's fifth angle of the same shoe adds crawl cost rather than coverage.
         */
        images: product.images.slice(0, 4).map((image) => image.src),
      })),
    ...posts.map((post) => ({
      url: toUrl(ROUTES.journalPost(post.slug)),
      lastModified: post.publishedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...legalPages.map((page) => ({
      url: toUrl(ROUTES.legal(page.slug)),
      lastModified: page.updatedAt,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
