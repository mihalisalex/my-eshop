import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { WishlistPageContent } from "@/components/wishlist/WishlistPageContent";
import { getNavigation, getSiteSettings } from "@/services";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export default async function WishlistPage() {
  const [navigation, settings] = await Promise.all([getNavigation(), getSiteSettings()]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <WishlistPageContent />
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
