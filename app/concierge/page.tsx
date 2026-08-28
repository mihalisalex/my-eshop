import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ConciergeForm } from "@/components/shared/ConciergeForm";
import { getNavigation, getSiteSettings } from "@/services";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return {
  title: t("conciergeTitle"),
  };
}

export default async function ConciergePage() {
  const t = await getTranslations("Pages");
  const [navigation, settings] = await Promise.all([getNavigation(), getSiteSettings()]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <div className="container-luxe max-w-3xl py-14 md:py-20">
          <h1 className="font-heading text-4xl md:text-5xl">{t("conciergeTitle")}</h1>
          <p className="mt-4 text-lg text-luxe-gray-dark">
            A little guidance on sizing, an occasion, or building out a look — a real person on our team will reply personally.
          </p>

          <div className="mt-10">
            <ConciergeForm />
          </div>
        </div>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
