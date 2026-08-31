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
    title: t("menTitle"),
    description: t("menDescription"),
    locale: locale as Locale,
    path: "/men",
  });
}

export default async function MenPage({ searchParams }: ListingPageProps) {
  const [navigation, settings, t, resolvedSearchParams] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    getTranslations("Pages"),
    searchParams,
  ]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <Suspense fallback={null}>
          <ProductListingSection
            title={t("menTitle")}
            baseFilters={{ gender: "men" }}
            searchParams={resolvedSearchParams}
          />
        </Suspense>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
