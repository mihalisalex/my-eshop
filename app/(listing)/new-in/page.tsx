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
    title: t("newInTitle"),
    description: t("newInDescription"),
    locale: locale as Locale,
    path: "/new-in",
  });
}

export default async function NewInPage({ searchParams }: ListingPageProps) {
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
          {/* No isNew filter: that flag is a merchandising badge nobody had set, so this page
              showed "0 items" while the catalog held 175 products. Sorting by when a product
              was actually added is what "New In" means, and it stays correct on its own as
              stock is added. */}
          <ProductListingSection
            title={t("newInTitle")}
            description={t("newInDescription")}
            baseFilters={{}}
            defaultSort="newest"
            searchParams={resolvedSearchParams}
          />
        </Suspense>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
