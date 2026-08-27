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
    title: t("womenTitle"),
    description: t("womenDescription"),
    path: "/women",
    // Threaded through so og:locale matches the language the title is actually in.
    locale: locale as Locale,
  });
}

export default async function WomenPage() {
  const [navigation, settings, t] = await Promise.all([getNavigation(), getSiteSettings(), getTranslations("Pages")]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <Suspense fallback={null}>
          <ProductListingPage title={t("womenTitle")} baseFilters={{ gender: "women" }} />
        </Suspense>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
