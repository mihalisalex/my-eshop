import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductListingPage } from "@/components/plp/ProductListingPage";
import { getNavigation, getSiteSettings, getSeoDefaults } from "@/services";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoDefaults();
  return buildMetadata({
    seo,
    title: "Men",
    description: "Shop men's shoes — oxfords, derbies, sneakers, and boots.",
    path: "/men",
  });
}

export default async function MenPage() {
  const [navigation, settings] = await Promise.all([getNavigation(), getSiteSettings()]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <Suspense fallback={null}>
          <ProductListingPage title="Men" baseFilters={{ gender: "men" }} />
        </Suspense>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
