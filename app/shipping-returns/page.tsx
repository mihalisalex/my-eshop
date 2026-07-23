import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SimplePageContent } from "@/components/shared/SimplePageContent";
import { getShippingReturnsPage, getNavigation, getSiteSettings } from "@/services";

export const metadata: Metadata = {
  title: "Shipping & Returns",
};

export default async function ShippingReturnsPage() {
  const [navigation, settings, page] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    getShippingReturnsPage(),
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
