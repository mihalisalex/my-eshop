import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SimplePageContent } from "@/components/shared/SimplePageContent";
import { getSustainabilityPage, getNavigation, getSiteSettings } from "@/services";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return {
  title: t("sustainabilityTitle"),
  };
}

export default async function SustainabilityPage() {
  const [navigation, settings, page] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    getSustainabilityPage(),
  ]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <SimplePageContent page={page} />
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
