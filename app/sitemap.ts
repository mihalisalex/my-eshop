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
  const now = new Date().toISOString();

  return [
    ...STATIC_ROUTES.map(({ path, priority }) => ({
      url: toUrl(path),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority,
    })),
    ...collections.map((collection) => ({
      url: toUrl(ROUTES.collection(collection.slug)),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...categories
      .filter((category) => category.isVisible)
      .map((category) => ({
        url: toUrl(ROUTES.category(category.slug)),
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...products.map((product) => ({
      url: toUrl(ROUTES.product(product.slug)),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
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
