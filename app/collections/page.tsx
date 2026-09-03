import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FeaturedCollections } from "@/components/sections/FeaturedCollections";
import { getAllCollections, getNavigation, getSiteSettings } from "@/services";
import { getLocale, getTranslations } from "next-intl/server";
import { localizeCollections } from "@/lib/localize";
import type { Locale } from "@/i18n/config";

// Async, unlike the static `metadata` it replaces: the title has to be read from the request
// locale, and a module-level constant is evaluated once with no locale in scope.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return { title: t("collectionsTitle"), description: t("collectionsSubtitle") };
}

export default async function CollectionsPage() {
  const [navigation, settings, rawCollections, t, locale] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    getAllCollections(),
    getTranslations("Pages"),
    getLocale(),
  ]);

  // This page was the one storefront surface reading collections WITHOUT localizing them, so
  // a Greek visitor saw "The Sneaker Edit" here and "Η Συλλογή Σνίκερ" for the same
  // collection on the homepage. The translations existed all along; nothing asked for them.
  const collections = localizeCollections(rawCollections, locale as Locale);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main id="main" className="flex-1 pt-header">
        <FeaturedCollections title={t("collectionsTitle")} subtitle={t("collectionsSubtitle")} collections={collections} />
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
