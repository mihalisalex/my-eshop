import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { buildMetadata } from "@/lib/seo";
import { getNavigation, getSeoDefaults, getSiteSettings, getVisibleHomepageSections } from "@/services";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoDefaults();
  return buildMetadata({
    seo,
    title: seo.defaultTitle,
    description: seo.defaultDescription,
    path: "/",
  });
}

export default async function HomePage() {
  const [navigation, settings, sections] = await Promise.all([
    getNavigation(),
    getSiteSettings(),
    getVisibleHomepageSections(),
  ]);

  return (
    <>
      <Header
        navigation={navigation}
        siteName={settings.siteName}
        announcementMessages={settings.announcementMessages}
        transparent
      />
      <main id="main" className="flex-1">
        {sections.map((section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
