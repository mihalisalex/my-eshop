import type { MetadataRoute } from "next";
import { getSeoDefaults } from "@/services";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSeoDefaults();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api"],
      },
    ],
    sitemap: `${seo.siteUrl}/sitemap.xml`,
  };
}
