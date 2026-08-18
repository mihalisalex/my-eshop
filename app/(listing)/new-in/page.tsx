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
    title: "New In",
    description: "The latest arrivals.",
    path: "/new-in",
  });
}

export default async function NewInPage() {
  const [navigation, settings] = await Promise.all([getNavigation(), getSiteSettings()]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <Suspense fallback={null}>
          {/* No isNew filter: that flag is a merchandising badge nobody had set, so this page
              showed "0 items" while the catalog held 175 products. Sorting by when a product
              was actually added is what "New In" means, and it stays correct on its own as
              stock is added. */}
          <ProductListingPage title="New In" description="The latest arrivals." baseFilters={{}} defaultSort="newest" />
        </Suspense>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
