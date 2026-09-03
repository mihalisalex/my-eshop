import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WishlistPageContent } from "@/components/wishlist/WishlistPageContent";
import { getNavigation, getSiteSettings } from "@/services";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return {
  title: t("wishlistTitle"),
  robots: { index: false, follow: false },
  };
}

export default async function WishlistPage() {
  const [navigation, settings] = await Promise.all([getNavigation(), getSiteSettings()]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main id="main" className="flex-1 pt-header">
        <WishlistPageContent />
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
