import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartPageContent } from "@/components/cart/CartPageContent";
import { getNavigation, getSiteSettings } from "@/services";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Cart");
  return { title: t("yourBag"), robots: { index: false, follow: false } };
}

export default async function CartPage() {
  const [navigation, settings] = await Promise.all([getNavigation(), getSiteSettings()]);

  return (
    <>
      <Header
        navigation={navigation}
        siteName={settings.siteName}
        announcementMessages={settings.announcementMessages}
      />
      <main id="main" className="flex-1 pt-header">
        <CartPageContent />
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
