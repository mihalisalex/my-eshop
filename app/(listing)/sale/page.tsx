import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductListingSection } from "@/components/plp/ProductListingSection";
import type { ListingPageProps } from "@/components/plp/listing-query";
import { getNavigation, getSiteSettings, getSeoDefaults } from "@/services";
import { buildMetadata } from "@/lib/seo";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const [seo, t, locale] = await Promise.all([getSeoDefaults(), getTranslations("Pages"), getLocale()]);
  return buildMetadata({
    seo,
    title: t("saleTitle"),
    description: t("saleDescription"),
    locale: locale as Locale,
    path: "/sale",
  });
}

export default async function SalePage({ searchParams }: ListingPageProps) {
  const [navigation, settings, t, resolvedSearchParams] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    getTranslations("Pages"),
    searchParams,
  ]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main id="main" className="flex-1 pt-header">
        <Suspense fallback={null}>
          {/* Deepest discount first — on a page whose entire purpose is the discount, "relevance"
              (which falls back to oldest-first) buried the best offers wherever they happened to sit. */}
          <ProductListingSection
            title={t("saleTitle")}
            description={t("saleDescription")}
            baseFilters={{ isSale: true }}
            defaultSort="discount"
            searchParams={resolvedSearchParams}
          />
        </Suspense>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
