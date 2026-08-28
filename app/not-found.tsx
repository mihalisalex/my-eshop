import Link from "next/link";
import { Compass } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getNavigation, getSiteSettings } from "@/services";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const [navigation, settings, t] = await Promise.all([getNavigation(), getSiteSettings(), getTranslations("Errors")]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <div className="container-luxe flex flex-col items-center gap-4 py-32 text-center">
          <Compass className="size-12 text-luxe-gray-dark" strokeWidth={1} />
          <p className="text-eyebrow">404</p>
          <h1 className="font-heading text-3xl">{t("notFoundTitle")}</h1>
          <p className="max-w-sm text-sm text-luxe-gray-dark">{t("notFoundBody")}</p>
          <Link
            href="/"
            className="mt-2 flex h-12 items-center justify-center bg-luxe-black px-8 text-xs font-medium tracking-[0.08em] text-luxe-white uppercase"
          >
            {t("backToHome")}
          </Link>
        </div>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
