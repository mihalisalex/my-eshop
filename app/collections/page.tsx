import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FeaturedCollections } from "@/components/sections/FeaturedCollections";
import { getAllCollections, getNavigation, getSiteSettings } from "@/services";

export const metadata: Metadata = {
  title: "Collections",
  description: "Shop curated collections.",
};

export default async function CollectionsPage() {
  const [navigation, settings, collections] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    getAllCollections(),
  ]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <FeaturedCollections title="Collections" subtitle="Curated edits, considered." collections={collections} />
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
