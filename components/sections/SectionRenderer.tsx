import { getLocale } from "next-intl/server";
import { Hero } from "@/components/sections/Hero";
import { FeaturedCollections } from "@/components/sections/FeaturedCollections";
import { BestSellers } from "@/components/sections/BestSellers";
import { EditorialBanner } from "@/components/sections/EditorialBanner";
import { NewArrivals } from "@/components/sections/NewArrivals";
import { BrandStory } from "@/components/sections/BrandStory";
import { SocialGrid } from "@/components/sections/SocialGrid";
import { Newsletter } from "@/components/sections/Newsletter";
import { getCollectionsByIds, getProductsByIds } from "@/services";
import { localizeCollections, localizeProducts } from "@/lib/localize";
import type { Locale } from "@/i18n/config";
import type { HomepageSection } from "@/types";

interface SectionRendererProps {
  section: HomepageSection;
}

/**
 * Single switchboard from homepage config -> rendered section. Section `data`
 * only carries ids (productIds/collectionIds); this is the one place that
 * resolves them via `services/`, so section components themselves stay pure
 * and prop-driven (and reusable outside the homepage later).
 */
export async function SectionRenderer({ section }: SectionRendererProps) {
  const locale = (await getLocale()) as Locale;

  switch (section.type) {
    case "hero":
      return <Hero data={section.data} />;

    case "featuredCollections": {
      const collections = localizeCollections(await getCollectionsByIds(section.data.collectionIds), locale);
      return (
        <FeaturedCollections
          title={section.data.title}
          subtitle={section.data.subtitle}
          collections={collections}
        />
      );
    }

    case "bestSellers": {
      const products = localizeProducts(await getProductsByIds(section.data.productIds), locale);
      return (
        <BestSellers
          title={section.data.title}
          subtitle={section.data.subtitle}
          products={products}
          viewAllCta={section.data.viewAllCta}
        />
      );
    }

    case "editorialBanner":
      return <EditorialBanner data={section.data} />;

    case "newArrivals": {
      const products = localizeProducts(await getProductsByIds(section.data.productIds), locale);
      return (
        <NewArrivals title={section.data.title} subtitle={section.data.subtitle} products={products} />
      );
    }

    case "brandStory":
      return <BrandStory data={section.data} />;

    case "socialGrid":
      return <SocialGrid data={section.data} />;

    case "newsletter":
      return <Newsletter data={section.data} />;

    default:
      return null;
  }
}
