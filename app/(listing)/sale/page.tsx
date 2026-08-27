import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductListingPage } from "@/components/plp/ProductListingPage";
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

export default async function SalePage() {
  const [navigation, settings, t] = await Promise.all([getNavigation(), getSiteSettings(), getTranslations("Pages")]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <Suspense fallback={null}>
          <ProductListingPage title={t("saleTitle")} description={t("saleDescription")} baseFilters={{ isSale: true }} />
        </Suspense>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
